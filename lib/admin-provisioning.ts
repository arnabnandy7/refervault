import { hash } from "@node-rs/argon2";
import type { Client } from "@libsql/client";
import { passwordOptions } from "./auth-service";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function provisionAdmin(
  db: Client,
  options: {
    email: string;
    password: string;
    production: boolean;
    authorizedEmail?: string;
  },
) {
  const email = options.email.trim().toLowerCase();
  const authorizedEmail = options.authorizedEmail?.trim().toLowerCase();
  const minimumLength = options.production ? 20 : 15;

  if (!emailPattern.test(email) || email.length > 254)
    throw new Error("Invalid admin email.");
  if (options.password.length < minimumLength || options.password.length > 1024)
    throw new Error(`Password must be ${minimumLength}–1024 characters.`);
  if (options.production && (!authorizedEmail || email !== authorizedEmail))
    throw new Error(
      "This email is not authorized for production provisioning.",
    );

  const passwordHash = await hash(options.password, passwordOptions);
  const result = options.production
    ? await db.execute({
        sql: "INSERT INTO admins (email, password_hash) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM admins)",
        args: [email, passwordHash],
      })
    : await db.execute({
        sql: "INSERT INTO admins (email, password_hash) VALUES (?, ?)",
        args: [email, passwordHash],
      });
  if (result.rowsAffected !== 1)
    throw new Error("Production administrator already exists.");
}
