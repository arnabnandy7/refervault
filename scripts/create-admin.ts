import { loadEnvFile } from "node:process";
import { input, password } from "@inquirer/prompts";
import { createClient } from "@libsql/client";
import { hash } from "@node-rs/argon2";
import { passwordOptions } from "../lib/auth-service";

async function main() {
  const environment = process.argv[2];
  if (environment !== "development" && environment !== "production")
    throw new Error("Usage: npm run admin:create -- development|production");
  loadEnvFile(`.env.${environment}.local`);
  if (!process.stdin.isTTY)
    throw new Error("Use an interactive terminal to enter a hidden password.");
  const email = (
    await input({
      message: `Admin email (${environment}):`,
      validate: (value) =>
        (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
          value.trim().length <= 254) ||
        "Enter a valid email.",
    })
  )
    .trim()
    .toLowerCase();
  const secret = await password({
    message: "Password (at least 15 characters):",
    mask: "*",
    validate: (value) =>
      (value.length >= 15 && value.length <= 1024) || "Use 15–1024 characters.",
  });
  const confirmation = await password({
    message: "Confirm password:",
    mask: "*",
  });
  if (confirmation !== secret) throw new Error("Passwords do not match.");
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
    throw new Error("Turso credentials are missing.");
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  try {
    await db.execute({
      sql: "INSERT INTO admins (email, password_hash) VALUES (?, ?)",
      args: [email, await hash(secret, passwordOptions)],
    });
    console.log("Admin created. You can now sign in.");
  } finally {
    db.close();
  }
}
main().catch(() => {
  console.error(
    "Admin was not created. Check the environment, write access, matching passwords, and whether the email already exists.",
  );
  process.exitCode = 1;
});
