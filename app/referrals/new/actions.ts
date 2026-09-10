"use server";

import { database } from "@/lib/db";
import { createReferralEntry, type EntryState } from "@/lib/referral-entry";
import { getAdmin } from "@/lib/session";

export async function saveReferral(
  _state: EntryState,
  form: FormData,
): Promise<EntryState> {
  if (!(await getAdmin()))
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
      errors: {},
    };
  try {
    return await createReferralEntry(database(), form);
  } catch {
    return {
      status: "error",
      message: "The entry could not be saved. Please try again.",
      errors: {},
    };
  }
}
