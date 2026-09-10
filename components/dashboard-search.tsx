"use client";

import { useRef, useState } from "react";
import { DateFilterPicker } from "@/components/date-filter-picker";
import { PocFilter } from "@/components/poc-filter";
import { ReferralResults } from "@/components/referral-results";
import type { ReferralColumnKey } from "@/lib/referral-columns";
import type { ReferralFilters, ReferralSearchRow } from "@/lib/referral-search";

type SearchResult = {
  rows: ReferralSearchRow[];
  total: number;
  page: number;
  pageCount: number;
  filters: ReferralFilters;
};
type Status = { code: string; label: string };

const emptyFilters: ReferralFilters = {
  dateFrom: "", dateTo: "", candidateName: "", jobId: "", originalEmail: "",
  referredEmail: "", status: "", poc: "", skillset: "", page: 1,
};

export function DashboardSearch({
  initialResult,
  statuses,
  initialColumns,
}: {
  initialResult: SearchResult;
  statuses: Status[];
  initialColumns: ReferralColumnKey[] | null;
}) {
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);

  const search = async (page = 1, filters?: ReferralFilters) => {
    const values = filters ?? Object.fromEntries(new FormData(form.current!));
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/referrals/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, page }),
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error();
      setResult(await response.json());
    } catch {
      setError("The referrals could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        ref={form}
        className="search-panel"
        onSubmit={(event) => { event.preventDefault(); void search(); }}
      >
        <div className="search-grid">
          <DateFilterPicker label="Referral date from" name="dateFrom" />
          <DateFilterPicker label="Referral date to" name="dateTo" />
          <label><span>Candidate name</span><input name="candidateName" placeholder="e.g. Priya Sharma" /></label>
          <label><span>Job ID</span><input name="jobId" placeholder="e.g. 123456" /></label>
          <label><span>Original email ID</span><input type="email" name="originalEmail" placeholder="candidate@example.com" /></label>
          <label><span>Refer email ID</span><input type="email" name="referredEmail" placeholder="candidate+ref@example.com" /></label>
          <label><span>Status</span><select name="status" defaultValue=""><option value="">All statuses</option>{statuses.map((status) => <option key={status.code} value={status.code}>{status.label}</option>)}</select></label>
          <PocFilter defaultValue="" />
          <label className="search-skill"><span>Skillset</span><input name="skillset" placeholder="e.g. Java, React" /></label>
        </div>
        <div className="search-actions">
          <button
            className="search-clear"
            type="button"
            onClick={() => { form.current?.reset(); void search(1, emptyFilters); }}
          >Clear filters</button>
          <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search referrals"}</button>
        </div>
      </form>
      {error ? <p className="dashboard-search-error" role="alert">{error}</p> : null}
      <section className="results-panel" aria-live="polite" aria-busy={loading}>
        <div className="results-heading"><div><span className="eyebrow">RESULTS</span><h2>{result.total.toLocaleString()} referral{result.total === 1 ? "" : "s"}</h2></div>{result.total > 0 ? <p>Page {result.page} of {result.pageCount}</p> : null}</div>
        <ReferralResults rows={result.rows} total={result.total} exportFilters={result.filters} initialColumns={initialColumns} />
        {result.pageCount > 1 ? (
          <nav className="pagination" aria-label="Results pages">
            {result.page > 1 ? <button type="button" disabled={loading} onClick={() => void search(result.page - 1)}>← Previous</button> : <span />}
            <span>{(result.page - 1) * 25 + 1}–{Math.min(result.page * 25, result.total)} of {result.total}</span>
            {result.page < result.pageCount ? <button type="button" disabled={loading} onClick={() => void search(result.page + 1)}>Next →</button> : <span />}
          </nav>
        ) : null}
      </section>
    </>
  );
}
