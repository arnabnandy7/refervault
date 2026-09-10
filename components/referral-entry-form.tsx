"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveReferral } from "@/app/referrals/new/actions";
import { DateFilterPicker } from "@/components/date-filter-picker";
import { StoredSuggestionField } from "@/components/stored-suggestion-field";
import type { EntryState } from "@/lib/referral-entry";

type Status = { code: string; label: string };
export type ReferralFormValues = Partial<Record<
  | "candidateName" | "dob" | "originalEmails" | "mobileNumbers"
  | "experience" | "skillset" | "currentLocation" | "preferredLocation"
  | "noticePeriod" | "linkedin" | "referredEmail" | "referredDate"
  | "statusCode" | "referredTo" | "company" | "jobCodes" | "poc" | "remarks",
  string
>>;
const initialEntryState: EntryState = {
  status: "idle",
  message: "",
  errors: {},
};

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  error,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  defaultValue?: string;
}) {
  return (
    <label className="entry-field">
      <span>
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        defaultValue={defaultValue}
      />
      {error ? <small id={`${name}-error`}>{error}</small> : null}
    </label>
  );
}

export function ReferralEntryForm({
  statuses,
  initialValues = {},
  submitAction = saveReferral,
  mode = "create",
}: {
  statuses: Status[];
  initialValues?: ReferralFormValues;
  submitAction?: (state: EntryState, form: FormData) => Promise<EntryState>;
  mode?: "create" | "edit";
}) {
  const [state, action, pending] = useActionState(
    submitAction,
    initialEntryState,
  );
  const displayedValues = { ...initialValues, ...state.values };
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (mode === "create" && state.status === "success") form.current?.reset();
  }, [mode, state.status, state.message]);
  return (
    <form key={state.attempt ?? 0} ref={form} action={action} className="entry-form">
      <div className="entry-section-heading">
        <span>01</span>
        <div>
          <h2>Candidate profile</h2>
          <p>Who are you referring?</p>
        </div>
      </div>
      <div className="entry-grid">
        <Field
          label="Candidate name"
          name="candidateName"
          required
          placeholder="Full name"
          error={state.errors.candidateName}
          defaultValue={displayedValues.candidateName}
        />
        <DateFilterPicker
          label="Date of birth"
          name="dob"
          error={state.errors.dob}
          variant="entry"
          defaultValue={displayedValues.dob}
        />
        <Field
          label="Original email ID"
          name="originalEmails"
          type="text"
          placeholder="Separate multiple emails with commas"
          error={state.errors.originalEmails}
          defaultValue={displayedValues.originalEmails}
        />
        <Field
          label="Mobile number"
          name="mobileNumbers"
          type="text"
          placeholder="Separate multiple numbers with commas"
          defaultValue={displayedValues.mobileNumbers}
        />
        <Field
          label="Experience"
          name="experience"
          placeholder="For example, 5+ or 4.6"
          defaultValue={displayedValues.experience}
        />
        <Field
          label="Skillset"
          name="skillset"
          placeholder="Primary skills and technologies"
          defaultValue={displayedValues.skillset}
        />
        <Field
          label="Current location"
          name="currentLocation"
          placeholder="City"
          defaultValue={displayedValues.currentLocation}
        />
        <Field
          label="Preferred location"
          name="preferredLocation"
          placeholder="City or cities"
          defaultValue={displayedValues.preferredLocation}
        />
        <Field
          label="Notice period"
          name="noticePeriod"
          placeholder="Days, LWD, or availability note"
          defaultValue={displayedValues.noticePeriod}
        />
        <Field
          label="LinkedIn"
          name="linkedin"
          type="url"
          placeholder="https://linkedin.com/in/..."
          error={state.errors.linkedin}
          defaultValue={displayedValues.linkedin}
        />
      </div>
      <div className="entry-section-heading">
        <span>02</span>
        <div>
          <h2>Referral details</h2>
          <p>Where is this opportunity headed?</p>
        </div>
      </div>
      <div className="entry-grid">
        <Field
          label="Referred email ID"
          name="referredEmail"
          type="email"
          placeholder="Email used for the referral"
          error={state.errors.referredEmail}
          defaultValue={displayedValues.referredEmail}
        />
        <DateFilterPicker
          label="Referred date"
          name="referredDate"
          error={state.errors.referredDate}
          variant="entry"
          defaultValue={displayedValues.referredDate}
        />
        <label className="entry-field">
          <span>Status</span>
          <select name="statusCode" defaultValue={displayedValues.statusCode ?? "unknown"}>
            {statuses.map((status) => (
              <option key={status.code} value={status.code}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <StoredSuggestionField
          label="Referred to"
          name="referredTo"
          field="referredTo"
          placeholder="Job Code, Amex, channel, etc."
          defaultValue={displayedValues.referredTo}
        />
        <StoredSuggestionField
          label="Company"
          name="company"
          field="company"
          placeholder="Required with job code"
          error={state.errors.company}
          defaultValue={displayedValues.company}
        />
        <label className="entry-field">
          <span>Job IDs</span>
          <textarea
            name="jobCodes"
            rows={3}
            placeholder="Enter one or more job IDs, separated by commas or new lines"
            defaultValue={displayedValues.jobCodes}
            aria-invalid={Boolean(state.errors.jobCodes)}
            aria-describedby={state.errors.jobCodes ? "jobCodes-error" : undefined}
          />
          {state.errors.jobCodes ? <small id="jobCodes-error">{state.errors.jobCodes}</small> : null}
          <small className="field-hint">
            One referral will be created for each job ID. Leading zeros are
            preserved.
          </small>
        </label>
        <Field
          label="Point of contact"
          name="poc"
          placeholder="Name or employee ID"
          defaultValue={displayedValues.poc}
        />
        <label className="entry-field entry-wide">
          <span>Remarks</span>
          <textarea
            name="remarks"
            rows={4}
            placeholder="Notes about the candidate or referral"
            defaultValue={displayedValues.remarks}
          />
        </label>
      </div>
      {state.message ? (
        <p
          className={`entry-message ${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <div className="entry-actions">
        <a href="/dashboard">Cancel</a>
        <button
          className="submit-button entry-submit"
          disabled={pending}
          type="submit"
        >
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Save candidate & referral"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
