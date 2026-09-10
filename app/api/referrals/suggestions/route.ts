import { database } from "@/lib/db";
import { getAdmin } from "@/lib/session";

const fields = {
  referredTo: {
    select: "referral_destination",
    from: "referrals",
  },
  company: {
    select: "name",
    from: "companies",
  },
} as const;

const like = (input: string) => `%${input.replace(/[\\%_]/g, "\\$&")}%`;

export async function POST(request: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response("Unsupported content type", { status: 415 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return new Response("Invalid request", { status: 400 });
  const input = body as { field?: unknown; query?: unknown };
  if (typeof input.field !== "string" || !(input.field in fields))
    return new Response("Invalid suggestion field", { status: 400 });
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 100) : "";
  if (!query)
    return Response.json([], { headers: { "Cache-Control": "private, no-store" } });
  const source = fields[input.field as keyof typeof fields];
  const result = await database().execute({
    sql: `SELECT DISTINCT ${source.select} AS label FROM ${source.from}
      WHERE ${source.select} IS NOT NULL AND ${source.select} LIKE ? ESCAPE '\\' COLLATE NOCASE
      ORDER BY label COLLATE NOCASE LIMIT 12`,
    args: [like(query)],
  });
  return Response.json(result.rows.map((row) => String(row.label)), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
