"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { database } from "@/lib/db";
import {
  authenticate,
  revokeSession,
  SESSION_SECONDS,
} from "@/lib/auth-service";
import { COOKIE_NAME } from "@/lib/session";

export async function login(_previous: { error: string }, form: FormData) {
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string")
    return { error: "Enter your email and password." };
  try {
    const result = await authenticate(database(), email, password);
    if (result.error) return { error: result.error };
    const jar = await cookies();
    const previous = jar.get(COOKIE_NAME)?.value;
    if (previous) await revokeSession(database(), previous);
    jar.set(COOKIE_NAME, result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
  } catch {
    return {
      error: "We couldn’t sign you in right now. Please try again shortly.",
    };
  }
  redirect("/dashboard");
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await revokeSession(database(), token);
  jar.delete(COOKIE_NAME);
  redirect("/login");
}
