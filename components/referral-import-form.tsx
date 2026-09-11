"use client";

import { useState, type FormEvent } from "react";
import { StoredSuggestionField } from "@/components/stored-suggestion-field";
import { IMPORT_COLUMNS, MAX_IMPORT_BYTES } from "@/lib/referral-import-format";

export function ReferralImportForm({ statuses }: { statuses: { code: string; label: string }[] }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_IMPORT_BYTES) {
      setResult({ ok: false, message: "Choose a non-empty Excel file up to 3 MB." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/referrals/import", { method: "POST", body: data });
      const body = await response.json();
      setResult({ ok: response.ok, message: body.message });
      if (response.ok) form.reset();
    } catch {
      setResult({ ok: false, message: "Could not confirm the import. Check the workspace before retrying to avoid duplicate referrals." });
    } finally { setPending(false); }
  }
  return (
    <section className="entry-form import-panel" aria-labelledby="import-heading">
      <div className="entry-section-heading">
        <span aria-hidden="true">↥</span>
        <div><h2 id="import-heading">Upload Excel</h2><p>Add multiple referrals using a spreadsheet.</p></div>
      </div>
      <p><a href="/templates/Referral_format.xlsx" download>Download Excel template ↓</a> — fill in the rows below the headers, then upload it here.</p>
      <details className="import-guidance">
        <summary>Column order and allowed formats</summary>
        <p>Use .xlsx, .xls, or .xlsm, up to 3 MB and 200 data rows. We read the ProfileList sheet if present, otherwise the first sheet. Keep a header in every column A–Q on row 1. Header wording and styling may differ; values are mapped by position.</p>
        <ol>{IMPORT_COLUMNS.map(([label], index) => <li key={label}><strong>{String.fromCharCode(65 + index)}</strong> — {label}</li>)}</ol>
        <p>Candidate Name is required. Other cells may be blank. Use Excel dates or YYYY-MM-DD for Referred Date and DOB. Store phone numbers and job codes as Text to preserve leading zeros. Separate multiple original emails, phone numbers, or job IDs with commas, semicolons, or new lines. Paste formulas as values.</p>
        <p>Status: {statuses.map((status) => status.label).join(", ")}. Status codes are also accepted; blank uses Unknown.</p>
        <p>Company below applies to all rows and is required when any row has a job code. Upload different companies separately. Each job ID creates a referral. Existing candidates are matched using original email or phone; uploading the same file again creates additional referrals.</p>
      </details>
      <form onSubmit={submit}>
        <fieldset disabled={pending} className="import-fields">
          <div className="entry-grid">
            <label className="entry-field"><span>Excel workbook</span><input type="file" name="file" accept=".xlsx,.xls,.xlsm" required /></label>
            <StoredSuggestionField label="Company for this upload" name="company" field="company" placeholder="Required with job codes" />
          </div>
          <div className="entry-actions"><button className="submit-button entry-submit" type="submit" disabled={pending}>{pending ? "Importing…" : "Import referrals"}<span aria-hidden="true">↗</span></button></div>
        </fieldset>
      </form>
      {result ? <p className={`entry-message ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{result.message}{result.ok ? <> <a href="/dashboard">View workspace ↗</a></> : null}</p> : null}
    </section>
  );
}
