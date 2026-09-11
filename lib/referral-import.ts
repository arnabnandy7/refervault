import type { Client } from "@libsql/client";
import { read, utils, SSF, type CellObject } from "xlsx";
import { createReferralEntry } from "./referral-entry";
import { IMPORT_COLUMNS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "./referral-import-format";

export class ReferralImportError extends Error {}
const clean = (value: unknown) => String(value ?? "").trim();

function cellValue(cell: CellObject | undefined, date: boolean, date1904: boolean) {
  if (!cell) return "";
  if (cell.f || cell.t === "e") throw new ReferralImportError("Replace formulas and cell errors with values before uploading.");
  if (date && typeof cell.v === "number") {
    const parsed = SSF.parse_date_code(cell.v, { date1904 });
    if (!parsed || parsed.y < 100 || parsed.y > 9999) throw new ReferralImportError("Enter a valid Excel date or YYYY-MM-DD.");
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return clean(date ? cell.v : utils.format_cell(cell));
}

export function parseReferralWorkbook(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES) throw new ReferralImportError("Choose an Excel file up to 3 MB.");
  // Do not allow the parser's CSV/HTML fallback for files renamed to Excel.
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b) && !(bytes[0] === 0xd0 && bytes[1] === 0xcf))
    throw new ReferralImportError("Choose a valid .xlsx, .xls, or .xlsm workbook.");
  let book;
  try { book = read(bytes, { type: "array", cellNF: true, sheetRows: MAX_IMPORT_ROWS + 2 }); }
  catch { throw new ReferralImportError("The workbook could not be read. Save it as an unencrypted Excel file and try again."); }
  const sheetName = book.SheetNames.includes("ProfileList") ? "ProfileList" : book.SheetNames[0];
  const sheet = book.Sheets[sheetName];
  if (!sheet?.["!ref"]) throw new ReferralImportError("The workbook is empty.");
  for (const [column, [label]] of IMPORT_COLUMNS.entries()) {
    const header = clean(sheet[utils.encode_cell({ r: 0, c: column })]?.v);
    if (!header) throw new ReferralImportError(`Row 1 must contain headers in columns A–Q. Column ${String.fromCharCode(65 + column)} is ${label}.`);
    const known = IMPORT_COLUMNS.findIndex(([name]) => name.toLowerCase() === header.toLowerCase());
    if (known >= 0 && known !== column) throw new ReferralImportError(`Column ${String.fromCharCode(65 + column)} must be ${label}. Keep the template column order.`);
  }
  const range = utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]!);
  if (range.e.r > MAX_IMPORT_ROWS) throw new ReferralImportError(`Use at most ${MAX_IMPORT_ROWS} data rows per upload.`);
  const rows: { row: number; form: FormData }[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const form = new FormData();
    let populated = false;
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[utils.encode_cell({ r, c })] as CellObject | undefined;
      if (c >= IMPORT_COLUMNS.length) {
        if (clean(cell?.v) || cell?.f) throw new ReferralImportError(`Row ${r + 1}: extra data after column Q. Use the template order A–Q.`);
        continue;
      }
      const [label, field] = IMPORT_COLUMNS[c];
      try {
        const value = cellValue(cell, field === "dob" || field === "referredDate", Boolean(book.Workbook?.WBProps?.date1904));
        form.set(field, value);
        populated ||= Boolean(value);
      } catch (error) {
        throw new ReferralImportError(`Row ${r + 1}, ${label}: ${(error as Error).message}`);
      }
    }
    if (populated) rows.push({ row: r + 1, form });
  }
  if (!rows.length) throw new ReferralImportError("Add at least one candidate below the header row before uploading.");
  return { sheetName, rows };
}

export async function importReferralWorkbook(db: Client, bytes: Uint8Array, filename: string, company: string) {
  const { sheetName, rows } = parseReferralWorkbook(bytes);
  const statuses = await db.execute("SELECT code, label FROM referral_statuses");
  const statusMap = new Map(statuses.rows.flatMap((row) => [
    [clean(row.code).toLowerCase(), String(row.code)],
    [clean(row.label).toLowerCase(), String(row.code)],
  ]));
  for (const { row, form } of rows) {
    const status = clean(form.get("statusCode")).toLowerCase();
    if (status && !statusMap.has(status)) throw new ReferralImportError(`Row ${row}: status is not recognized. Use one of the listed statuses.`);
    form.set("statusCode", statusMap.get(status) ?? "unknown");
    form.set("company", company);
  }
  const tx = await db.transaction("write");
  try {
    for (const { row, form } of rows) {
      const result = await createReferralEntry({ execute: tx.execute.bind(tx), batch: tx.batch.bind(tx) }, form, { file: filename, sheet: sheetName, row });
      if (result.status !== "success") throw new ReferralImportError(`Row ${row}: ${Object.values(result.errors).join(" ") || result.message}`);
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally { tx.close(); }
  return rows.length;
}
