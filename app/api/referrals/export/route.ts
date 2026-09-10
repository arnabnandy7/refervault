import { database } from "@/lib/db";
import {
  isReferralColumn,
  REFERRAL_COLUMNS,
  type ReferralColumnKey,
} from "@/lib/referral-columns";
import { exportReferrals, parseReferralFilters } from "@/lib/referral-search";
import { getAdmin } from "@/lib/session";

const cleanCell = (value: unknown) =>
  value == null
    ? ""
    : String(value)
        .replace(/[\t\r\n]+/g, " ")
        .trim();

export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const requested = (params.get("columns") ?? "")
    .split(",")
    .filter(isReferralColumn);
  const columns: ReferralColumnKey[] = requested.length
    ? [...new Set(requested)]
    : REFERRAL_COLUMNS.map((column) => column.key);
  const filters = parseReferralFilters(Object.fromEntries(params));
  const rows = await exportReferrals(database(), filters);
  const labels = new Map(
    REFERRAL_COLUMNS.map((column) => [column.key, column.label]),
  );
  const output = [
    columns.map((column) => labels.get(column)).join("\t"),
    ...rows.map((row) =>
      columns.map((column) => cleanCell(row[column])).join("\t"),
    ),
  ].join("\r\n");

  return new Response(output, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
