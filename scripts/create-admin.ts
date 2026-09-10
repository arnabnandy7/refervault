import { loadEnvFile } from "node:process";
import { input, password } from "@inquirer/prompts";
import { createClient } from "@libsql/client";
import { provisionAdmin } from "../lib/admin-provisioning";

async function main() {
  const environment = process.argv[2];
  if (environment !== "development" && environment !== "production")
    throw new Error("Usage: npm run admin:create -- development|production");
  loadEnvFile(`.env.${environment}.local`);
  const production = environment === "production";
  if (production && !process.env.REFERVAULT_ADMIN_EMAIL)
    throw new Error("Production admin provisioning is not authorized.");
  if (!process.stdin.isTTY)
    throw new Error("Use an interactive terminal to enter a hidden password.");
  const email = (
    await input({
      message: `Admin email (${environment}):`,
      validate: (value) =>
        (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
          value.trim().length <= 254 &&
          (!production ||
            value.trim().toLowerCase() ===
              process.env.REFERVAULT_ADMIN_EMAIL?.trim().toLowerCase())) ||
        "Enter a valid email.",
    })
  )
    .trim()
    .toLowerCase();
  const minimumLength = production ? 20 : 15;
  const secret = await password({
    message: `Password (at least ${minimumLength} characters):`,
    mask: "*",
    validate: (value) =>
      (value.length >= minimumLength && value.length <= 1024) ||
      `Use ${minimumLength}–1024 characters.`,
  });
  const confirmation = await password({
    message: "Confirm password:",
    mask: "*",
  });
  if (confirmation !== secret) throw new Error("Passwords do not match.");
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
    throw new Error("Turso credentials are missing.");
  if (
    production &&
    !process.env.TURSO_DATABASE_URL.startsWith("libsql:") &&
    !process.env.TURSO_DATABASE_URL.startsWith("https:")
  )
    throw new Error("Production database transport must use TLS.");
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  try {
    await provisionAdmin(db, {
      email,
      password: secret,
      production,
      authorizedEmail: process.env.REFERVAULT_ADMIN_EMAIL,
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
