"use server";

import { database } from "@/lib/db";
import { createReferralEntry, submittedEntryValues, type EntryState } from "@/lib/referral-entry";
import { getAdmin } from "@/lib/session";

export async function saveReferral(
  state: EntryState,
  form: FormData,
): Promise<EntryState> {
  if (!(await getAdmin()))
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
      errors: {},
      values: submittedEntryValues(form),
      attempt: (state.attempt ?? 0) + 1,
    };
  try {
    const result = await createReferralEntry(database(), form);
    return result.status === "error"
      ? { ...result, attempt: (state.attempt ?? 0) + 1 }
      : result;
  } catch {
    return {
      status: "error",
      message: "The entry could not be saved. Please try again.",
      errors: {},
      values: submittedEntryValues(form),
      attempt: (state.attempt ?? 0) + 1,
    };
  }
}
