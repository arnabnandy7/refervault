"use server";

import { database } from "@/lib/db";
import { updateReferralEntry, type EntryState } from "@/lib/referral-entry";
import { getAdmin } from "@/lib/session";

export async function updateReferral(
  referralId: number,
  _state: EntryState,
  form: FormData,
): Promise<EntryState> {
  if (!(await getAdmin()))
    return { status: "error", message: "Your session has expired. Sign in again.", errors: {} };
  if (!Number.isSafeInteger(referralId) || referralId < 1)
    return { status: "error", message: "Invalid referral.", errors: {} };
  try {
    return await updateReferralEntry(database(), referralId, form);
  } catch {
    return { status: "error", message: "The changes could not be saved. Please try again.", errors: {} };
  }
}
