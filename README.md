# refervault
A lightweight personal referral tracker for organizing candidate profiles, referral history, and application status.

Database setup and spreadsheet mapping: [db/README.md](db/README.md).

## Run the application

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Next.js loads `.env.development.local` during
development and `.env.production.local` for production builds/start. Both require
`TURSO_DATABASE_URL` and a write-enabled `TURSO_AUTH_TOKEN`. Credentials stay on
the server. The current environment files point to the same Turso database.

## Create your admin

In an interactive terminal, run:

```sh
npm run admin:create -- development
```

Enter an email and a password of at least 15 characters. Password entry is masked;
only the Argon2id hash is saved. The command creates a new account and never
overwrites an existing email. Use `production` instead to select that environment
file. No default account is shipped.

## Login behavior

- `/login` verifies the existing `admins` credentials. `/dashboard` requires a valid
  session and currently shows a signed-in landing page. Referral management is next.
- Eight-hour sessions use random 256-bit tokens in HTTP-only, SameSite=Lax cookies,
  with Secure enabled in production. Only token hashes are stored in Turso.
- Every protected request checks expiry, active status, and password version.
  Sign-out revokes the database session; password changes invalidate existing sessions.
- Shared database counters limit attempts to five per email per 15-minute fixed
  window and 100 globally per minute. Inactive/unknown accounts get the same error.
- Successful logins update `last_login_at`. Expired sessions/counters are cleaned
  during allowed login attempts. Production requires HTTPS.
- Next.js Server Actions provide same-origin checks for login/logout. Keep the
  framework updated and do not broadly allow cross-origin actions.

Apply `db/migrations/003_admin_sessions.sql` once to an existing v2 database;
new databases use `db/schema.sql` which includes all migrations.

```sh
npm test
npm run typecheck
npm run build
python -m unittest discover -s db/tests -v
```

Authentication tests use an isolated in-memory database with synthetic credentials.
