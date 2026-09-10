import { database } from "@/lib/db";
import {
  isReferralColumn,
  type ReferralColumnKey,
} from "@/lib/referral-columns";
import { getAdmin } from "@/lib/session";

function validColumns(value: unknown): value is ReferralColumnKey[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (column) => typeof column === "string" && isReferralColumn(column),
    ) &&
    new Set(value).size === value.length
  );
}

export async function PUT(request: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const columns =
    body && typeof body === "object" && "columns" in body
      ? (body as { columns: unknown }).columns
      : null;
  if (!validColumns(columns))
    return new Response("Invalid columns", { status: 400 });

  await database().execute({
    sql: `INSERT INTO admin_dashboard_preferences (admin_id, columns_json)
      VALUES (?, ?)
      ON CONFLICT(admin_id) DO UPDATE SET
        columns_json = excluded.columns_json,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    args: [admin.id, JSON.stringify(columns)],
  });
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  await database().execute({
    sql: "DELETE FROM admin_dashboard_preferences WHERE admin_id = ?",
    args: [admin.id],
  });
  return new Response(null, { status: 204 });
}
