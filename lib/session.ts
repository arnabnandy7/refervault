import "server-only";
import { cookies } from "next/headers";
import { database } from "./db";
import { currentAdmin } from "./auth-service";

export const COOKIE_NAME = "refervault_session";
export async function getAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return currentAdmin(database(), token);
}
