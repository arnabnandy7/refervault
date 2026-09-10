import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClient } from "@libsql/client";
import { verify } from "@node-rs/argon2";
import { provisionAdmin } from "../lib/admin-provisioning";

test("production provisioning is allowlisted and limited to one admin", async () => {
  const db = createClient({ url: "file::memory:" });
  await db.executeMultiple(await readFile("db/schema.sql", "utf8"));
  const password = "production-only-test-password";

  await assert.rejects(
    provisionAdmin(db, {
      email: "other@example.test",
      password,
      production: true,
      authorizedEmail: "owner@example.test",
    }),
    /not authorized/,
  );
  await provisionAdmin(db, {
    email: "OWNER@example.test",
    password,
    production: true,
    authorizedEmail: "owner@example.test",
  });
  await assert.rejects(
    provisionAdmin(db, {
      email: "owner@example.test",
      password: "another-production-test-password",
      production: true,
      authorizedEmail: "owner@example.test",
    }),
    /already exists/,
  );

  const admins = await db.execute("SELECT email, password_hash FROM admins");
  assert.equal(admins.rows.length, 1);
  assert.equal(admins.rows[0].email, "owner@example.test");
  assert.equal(
    await verify(String(admins.rows[0].password_hash), password),
    true,
  );
  assert.equal(String(admins.rows[0].password_hash).includes(password), false);
  db.close();
});
