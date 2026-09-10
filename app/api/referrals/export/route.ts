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

export async function POST(request: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response("Unsupported content type", { status: 415 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return new Response("Invalid request", { status: 400 });
  const input = body as { columns?: unknown; filters?: unknown };
  const requested = Array.isArray(input.columns)
    ? input.columns.filter((column): column is ReferralColumnKey => typeof column === "string" && isReferralColumn(column))
    : [];
  const columns: ReferralColumnKey[] = requested.length
    ? [...new Set(requested)]
    : REFERRAL_COLUMNS.map((column) => column.key);
  const filters = parseReferralFilters(
    input.filters && typeof input.filters === "object" && !Array.isArray(input.filters)
      ? (input.filters as Record<string, string>)
      : {},
  );
  const rows = await exportReferrals(database(), filters);
  const labels = new Map(
    REFERRAL_COLUMNS.map((column) => [column.key, column.label]),
  );
  const headers = columns.map((column) => labels.get(column) ?? column);
  const values = rows.map((row) =>
    columns.map((column) => cleanCell(row[column])),
  );
  return Response.json(
    { headers, rows: values },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
