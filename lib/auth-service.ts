import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { Client } from "@libsql/client";

export const SESSION_SECONDS = 60 * 60 * 8;
// @node-rs/argon2 defaults to Argon2id.
export const passwordOptions = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
let dummyHash: Promise<string> | undefined;

export async function authenticate(
  db: Client,
  emailInput: string,
  password: string,
) {
  const email = emailInput.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > 1024
  ) {
    return { error: "Enter a valid email and password." } as const;
  }
  const now = Date.now();
  // Shared, atomic fixed windows: five attempts/account/15 min and 100 total/min.
  const buckets = [
    { key: `email:${digest(email)}:${Math.floor(now / 900000)}`, limit: 5 },
    { key: `global:${Math.floor(now / 60000)}`, limit: 100 },
  ];
  const counts = await db.batch(
    buckets.map(({ key }) => ({
      sql: "INSERT INTO auth_rate_limits (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
      args: [key, new Date(now + 900000).toISOString()],
    })),
    "write",
  );
  if (
    counts.some(
      (result, index) => Number(result.rows[0].attempts) > buckets[index].limit,
    )
  ) {
    return {
      error: "Too many attempts. Please try again in 15 minutes.",
    } as const;
  }
  await db.batch(
    [
      {
        sql: "DELETE FROM auth_rate_limits WHERE expires_at < ?",
        args: [new Date(now).toISOString()],
      },
      {
        sql: "DELETE FROM admin_sessions WHERE expires_at < ?",
        args: [new Date(now).toISOString()],
      },
    ],
    "write",
  );
  const result = await db.execute({
    sql: "SELECT id, password_hash, is_active FROM admins WHERE email = ? COLLATE NOCASE",
    args: [email],
  });
  const admin = result.rows[0];
  dummyHash ??= hash(randomBytes(32), passwordOptions);
  const passwordHash = admin ? String(admin.password_hash) : await dummyHash;
  let valid = false;
  try {
    valid = await verify(passwordHash, password);
  } catch {
    /* Invalid stored hashes fail closed. */
  }
  if (!valid || !admin || admin.is_active !== 1)
    return { error: "Email or password is incorrect." } as const;

  const token = randomBytes(32).toString("hex");
  // Conditional insert prevents a password change/disable race during verification.
  const saved = await db.batch(
    [
      {
        sql: "INSERT INTO admin_sessions (token_hash, admin_id, credential_version, expires_at) SELECT ?, id, ?, ? FROM admins WHERE id = ? AND password_hash = ? AND is_active = 1",
        args: [
          digest(token),
          digest(passwordHash),
          new Date(now + SESSION_SECONDS * 1000).toISOString(),
          admin.id,
          passwordHash,
        ],
      },
      {
        sql: "UPDATE admins SET last_login_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM admin_sessions WHERE token_hash = ?)",
        args: [new Date(now).toISOString(), admin.id, digest(token)],
      },
    ],
    "write",
  );
  if (saved[0].rowsAffected !== 1)
    return { error: "Email or password is incorrect." } as const;
  return { token } as const;
}

export async function currentAdmin(db: Client, token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await db.execute({
    sql: "SELECT a.id, a.email, a.password_hash, s.credential_version FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > ? AND a.is_active = 1",
    args: [digest(token), new Date().toISOString()],
  });
  const row = result.rows[0];
  if (!row || row.credential_version !== digest(String(row.password_hash)))
    return null;
  return { id: Number(row.id), email: String(row.email) };
}

export async function revokeSession(db: Client, token: string) {
  await db.execute({
    sql: "DELETE FROM admin_sessions WHERE token_hash = ?",
    args: [digest(token)],
  });
}
