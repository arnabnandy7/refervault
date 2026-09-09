import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { hash } from "@node-rs/argon2";
import {
  authenticate,
  currentAdmin,
  passwordOptions,
  revokeSession,
} from "../lib/auth-service";

test("admin authentication, revocation, expiry, and shared attempt limits", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await db.executeMultiple(await readFile("db/schema.sql", "utf8"));
    const secret = "test-only-long-password";
    const passwordHash = await hash(secret, passwordOptions);
    await db.execute({
      sql: "INSERT INTO admins (id, email, password_hash) VALUES (1, 'admin@example.test', ?)",
      args: [passwordHash],
    });
    assert.equal(
      (await authenticate(db, "admin@example.test", "wrong")).error,
      "Email or password is incorrect.",
    );
    assert.equal(
      (await authenticate(db, "unknown@example.test", "wrong")).error,
      "Email or password is incorrect.",
    );
    const login = await authenticate(db, " ADMIN@example.test ", secret);
    assert.ok(login.token);
    assert.equal(
      (await currentAdmin(db, login.token))?.email,
      "admin@example.test",
    );
    assert.equal(await currentAdmin(db, "tampered"), null);
    const stored = await db.execute("SELECT token_hash FROM admin_sessions");
    assert.notEqual(stored.rows[0].token_hash, login.token);
    await revokeSession(db, login.token);
    assert.equal(await currentAdmin(db, login.token), null);
    const second = await authenticate(db, "admin@example.test", secret);
    assert.ok(second.token);
    await db.execute("UPDATE admins SET is_active = 0");
    assert.equal(await currentAdmin(db, second.token), null);
    assert.equal(
      (await authenticate(db, "admin@example.test", secret)).error,
      "Email or password is incorrect.",
    );
    await db.execute("UPDATE admins SET is_active = 1");
    await db.execute({
      sql: "UPDATE admins SET password_hash = ?",
      args: [await hash("changed-test-password", passwordOptions)],
    });
    assert.equal(await currentAdmin(db, second.token), null);
    await db.execute("DELETE FROM auth_rate_limits");
    const third = await authenticate(
      db,
      "admin@example.test",
      "changed-test-password",
    );
    assert.ok(third.token);
    await db.execute(
      "UPDATE admin_sessions SET expires_at = '2000-01-01T00:00:00.000Z'",
    );
    assert.equal(await currentAdmin(db, third.token), null);
    await db.execute("DELETE FROM auth_rate_limits");
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        authenticate(db, "blocked@example.test", "wrong"),
      ),
    );
    assert.equal(
      attempts.filter((result) => result.error?.includes("Too many")).length,
      1,
    );
  } finally {
    db.close();
  }
});
