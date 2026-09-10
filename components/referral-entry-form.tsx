"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveReferral } from "@/app/referrals/new/actions";
import type { EntryState } from "@/lib/referral-entry";

type Status = { code: string; label: string };
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
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
      />
      {error ? <small id={`${name}-error`}>{error}</small> : null}
    </label>
  );
}

export function ReferralEntryForm({ statuses }: { statuses: Status[] }) {
  const [state, action, pending] = useActionState(
    saveReferral,
    initialEntryState,
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state.status, state.message]);
  return (
    <form ref={form} action={action} className="entry-form">
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
        />
        <Field
          label="Date of birth"
          name="dob"
          type="date"
          error={state.errors.dob}
        />
        <Field
          label="Original email ID"
          name="originalEmails"
          type="text"
          placeholder="Separate multiple emails with commas"
          error={state.errors.originalEmails}
        />
        <Field
          label="Mobile number"
          name="mobileNumbers"
          type="text"
          placeholder="Separate multiple numbers with commas"
        />
        <Field
          label="Experience"
          name="experience"
          placeholder="For example, 5+ or 4.6"
        />
        <Field
          label="Skillset"
          name="skillset"
          placeholder="Primary skills and technologies"
        />
        <Field
          label="Current location"
          name="currentLocation"
          placeholder="City"
        />
        <Field
          label="Preferred location"
          name="preferredLocation"
          placeholder="City or cities"
        />
        <Field
          label="Notice period"
          name="noticePeriod"
          placeholder="Days, LWD, or availability note"
        />
        <Field
          label="LinkedIn"
          name="linkedin"
          type="url"
          placeholder="https://linkedin.com/in/..."
          error={state.errors.linkedin}
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
        />
        <Field
          label="Referred date"
          name="referredDate"
          type="date"
          error={state.errors.referredDate}
        />
        <label className="entry-field">
          <span>Status</span>
          <select name="statusCode" defaultValue="unknown">
            {statuses.map((status) => (
              <option key={status.code} value={status.code}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Referred to"
          name="referredTo"
          placeholder="Job Code, Amex, channel, etc."
        />
        <Field
          label="Company"
          name="company"
          placeholder="Required with job code"
          error={state.errors.company}
        />
        <label className="entry-field">
          <span>Job IDs</span>
          <textarea
            name="jobCodes"
            rows={3}
            placeholder="Enter one or more job IDs, separated by commas or new lines"
          />
          <small className="field-hint">
            One referral will be created for each job ID. Leading zeros are
            preserved.
          </small>
        </label>
        <Field
          label="Point of contact"
          name="poc"
          placeholder="Name or employee ID"
        />
        <label className="entry-field entry-wide">
          <span>Remarks</span>
          <textarea
            name="remarks"
            rows={4}
            placeholder="Notes about the candidate or referral"
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
          {pending ? "Saving…" : "Save candidate & referral"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
