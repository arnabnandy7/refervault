"use client";

import { useEffect, useRef, useState } from "react";
import {
  REFERRAL_COLUMNS,
  type ReferralColumnKey,
} from "@/lib/referral-columns";
import type { ReferralFilters, ReferralSearchRow } from "@/lib/referral-search";

const ALL_COLUMNS = REFERRAL_COLUMNS.map((column) => column.key);

function Cell({
  column,
  row,
}: {
  column: ReferralColumnKey;
  row: ReferralSearchRow;
}) {
  switch (column) {
    case "candidateName":
      return <strong>{row.candidateName}</strong>;
    case "referralDate":
      return row.referralDate ?? "—";
    case "jobId":
      return <strong>{row.jobId ?? "—"}</strong>;
    case "originalEmails":
      return row.originalEmails ?? "—";
    case "mobileNumbers":
      return row.mobileNumbers ?? "—";
    case "referredEmail":
      return row.referredEmail ?? "—";
    case "experience":
      return row.experience ?? "—";
    case "company":
      return row.company ?? "—";
    case "status":
      return <span className="status-pill">{row.status}</span>;
    case "referredTo":
      return row.referredTo ?? "—";
    case "currentLocation":
      return row.currentLocation ?? "—";
    case "preferredLocation":
      return row.preferredLocation ?? "—";
    case "noticePeriod":
      return row.noticePeriod ?? "—";
    case "remarks":
      return row.remarks ?? "—";
    case "poc":
      return row.poc ?? "—";
    case "skillset":
      return row.skillset ?? "—";
    case "linkedin":
      return row.linkedin ? (
        <a href={row.linkedin} target="_blank" rel="noreferrer">
          {row.linkedin}
        </a>
      ) : (
        "—"
      );
  }
}

async function writeClipboard(plainText: string, html: string) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    return navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([plainText], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  }
  const textarea = document.createElement("textarea");
  textarea.value = plainText;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function ReferralResults({
  rows,
  total,
  exportFilters,
  initialColumns,
}: {
  rows: ReferralSearchRow[];
  total: number;
  exportFilters: ReferralFilters;
  initialColumns: ReferralColumnKey[] | null;
}) {
  const [columns, setColumns] = useState<ReferralColumnKey[]>(
    initialColumns?.length ? initialColumns : ALL_COLUMNS,
  );
  const [savedColumns, setSavedColumns] = useState<ReferralColumnKey[] | null>(
    initialColumns,
  );
  const [preferenceState, setPreferenceState] = useState<
    "idle" | "saving" | "saved" | "resetting" | "reset" | "error"
  >("idle");
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "error"
  >("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const picker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [pickerOpen]);

  const toggleColumn = (column: ReferralColumnKey) =>
    setColumns((current) =>
      current.includes(column)
        ? current.length === 1
          ? current
          : current.filter((key) => key !== column)
        : [...current, column],
    );

  const moveColumn = (column: ReferralColumnKey, direction: -1 | 1) =>
    setColumns((current) => {
      const index = current.indexOf(column);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length)
        return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];
      return reordered;
    });

  const copyResults = async () => {
    setCopyState("copying");
    try {
      const response = await fetch("/api/referrals/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: exportFilters, columns }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Export failed");
      const payload = (await response.json()) as {
        headers: string[];
        rows: string[][];
      };
      const plainText = [payload.headers, ...payload.rows]
        .map((row) => row.join("\t"))
        .join("\r\n");
      const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px"><thead><tr>${payload.headers.map((header) => `<th style="background:#73845d;color:#fff;border:1px solid #c8ccbf;padding:8px 10px;text-align:left">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${payload.rows.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #d9dbd1;padding:7px 10px;text-align:left">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      await writeClipboard(plainText, html);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
    }
  };

  const savePreference = async () => {
    setPreferenceState("saving");
    try {
      const response = await fetch("/api/dashboard-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
      if (!response.ok) throw new Error("Save failed");
      setSavedColumns(columns);
      setPreferenceState("saved");
      window.setTimeout(() => setPreferenceState("idle"), 2500);
    } catch {
      setPreferenceState("error");
    }
  };

  const resetPreference = async () => {
    setPreferenceState("resetting");
    try {
      const response = await fetch("/api/dashboard-preferences", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Reset failed");
      setColumns(ALL_COLUMNS);
      setSavedColumns(null);
      setPreferenceState("reset");
      window.setTimeout(() => setPreferenceState("idle"), 2500);
    } catch {
      setPreferenceState("error");
    }
  };

  const columnByKey = new Map(
    REFERRAL_COLUMNS.map((column) => [column.key, column]),
  );
  const pickerColumns = [
    ...columns.map((key) => columnByKey.get(key)!),
    ...REFERRAL_COLUMNS.filter((column) => !columns.includes(column.key)),
  ];
  const matchingColumns = pickerColumns.filter((column) =>
    column.label.toLowerCase().includes(columnSearch.trim().toLowerCase()),
  );
  const visibleColumns = columns.map((key) => columnByKey.get(key)!);
  const preferenceUnchanged = savedColumns?.join(",") === columns.join(",");

  if (!rows.length)
    return (
      <div className="results-empty">
        <span aria-hidden="true">⌕</span>
        <h3>No referrals found</h3>
        <p>Adjust or clear the filters and search again.</p>
      </div>
    );

  return (
    <>
      <div className="table-tools">
        <div className="column-picker" ref={picker}>
          <button
            className="column-picker-trigger"
            type="button"
            onClick={() => setPickerOpen((current) => !current)}
            aria-expanded={pickerOpen}
          >
            Columns <span>{columns.length}</span>
          </button>
          {pickerOpen && (
            <fieldset>
              <legend className="sr-only">Choose visible columns</legend>
              <label className="column-search">
                <span className="sr-only">Search columns</span>
                <input
                  autoFocus
                  type="search"
                  value={columnSearch}
                  onChange={(event) => setColumnSearch(event.target.value)}
                  placeholder="Search columns…"
                />
              </label>
              <div className="column-options">
                {matchingColumns.map((column) => (
                  <div className="column-option" key={column.key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={columns.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                      />
                      <span>{column.label}</span>
                    </label>
                    {columns.includes(column.key) && (
                      <span className="column-order-actions">
                        <button
                          type="button"
                          aria-label={`Move ${column.label} left`}
                          title="Move column left"
                          disabled={columns.indexOf(column.key) === 0}
                          onClick={() => moveColumn(column.key, -1)}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${column.label} right`}
                          title="Move column right"
                          disabled={
                            columns.indexOf(column.key) === columns.length - 1
                          }
                          onClick={() => moveColumn(column.key, 1)}
                        >
                          →
                        </button>
                      </span>
                    )}
                  </div>
                ))}
                {!matchingColumns.length && (
                  <p className="column-no-results">No columns found.</p>
                )}
              </div>
              <div className="column-preference-actions">
                <button
                  type="button"
                  onClick={resetPreference}
                  disabled={
                    preferenceState === "resetting" ||
                    (!savedColumns && columns.length === ALL_COLUMNS.length)
                  }
                >
                  {preferenceState === "resetting" ? "Resetting…" : "Reset"}
                </button>
                <button
                  type="button"
                  onClick={savePreference}
                  disabled={preferenceState === "saving" || preferenceUnchanged}
                >
                  {preferenceState === "saving"
                    ? "Saving…"
                    : savedColumns
                      ? "Update preference"
                      : "Save preference"}
                </button>
              </div>
              <p
                className={`preference-message ${preferenceState === "error" ? "error" : ""}`}
                aria-live="polite"
              >
                {preferenceState === "saved"
                  ? "Preference saved."
                  : preferenceState === "reset"
                    ? "Saved preference reset."
                    : preferenceState === "error"
                      ? "Could not update preference."
                      : ""}
              </p>
            </fieldset>
          )}
        </div>
        <button
          className="copy-results"
          type="button"
          onClick={copyResults}
          disabled={copyState === "copying"}
        >
          {copyState === "copying"
            ? "Copying…"
            : copyState === "copied"
              ? `Copied ${total.toLocaleString()} rows ✓`
              : copyState === "error"
                ? "Copy failed — retry"
                : "Copy to clipboard"}
        </button>
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <caption className="sr-only">
            Referrals matching the selected filters
          </caption>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.key === "referralDate"
                        ? "nowrap"
                        : column.key.includes("Email") ||
                            column.key === "referredEmail"
                          ? "email-cell"
                          : column.key === "skillset"
                            ? "skill-cell"
                            : undefined
                    }
                  >
                    <Cell column={column.key} row={row} />
                  </td>
                ))}
                <td className="row-actions">
                  <a href={`/referrals/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
