import "server-only";
import { createClient, type Client } from "@libsql/client";

let client: Client | undefined;
export function database() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || (!url.startsWith("file:") && !authToken))
      throw new Error("Database configuration missing");
    if (
      process.env.NODE_ENV === "production" &&
      !url.startsWith("libsql:") &&
      !url.startsWith("https:")
    )
      throw new Error("Production database transport must use TLS");
    client = createClient({ url, authToken });
  }
  return client;
}
