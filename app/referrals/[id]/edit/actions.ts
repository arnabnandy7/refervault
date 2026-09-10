"use server";

import { database } from "@/lib/db";
import { submittedEntryValues, updateReferralEntry, type EntryState } from "@/lib/referral-entry";
import { getAdmin } from "@/lib/session";

export async function updateReferral(
  referralId: number,
  state: EntryState,
  form: FormData,
): Promise<EntryState> {
  if (!(await getAdmin()))
    return { status: "error", message: "Your session has expired. Sign in again.", errors: {}, values: submittedEntryValues(form), attempt: (state.attempt ?? 0) + 1 };
  if (!Number.isSafeInteger(referralId) || referralId < 1)
    return { status: "error", message: "Invalid referral.", errors: {}, values: submittedEntryValues(form), attempt: (state.attempt ?? 0) + 1 };
  try {
    const result = await updateReferralEntry(database(), referralId, form);
    return result.status === "error"
      ? { ...result, attempt: (state.attempt ?? 0) + 1 }
      : result;
  } catch {
    return { status: "error", message: "The changes could not be saved. Please try again.", errors: {}, values: submittedEntryValues(form), attempt: (state.attempt ?? 0) + 1 };
  }
}
