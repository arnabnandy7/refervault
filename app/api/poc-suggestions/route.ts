import { database } from "@/lib/db";
import { getAdmin } from "@/lib/session";

const like = (input: string) => `%${input.replace(/[\\%_]/g, "\\$&")}%`;

export async function POST(request: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response("Unsupported content type", { status: 415 });
  const body: unknown = await request.json().catch(() => null);
  const query =
    body &&
    typeof body === "object" &&
    "query" in body &&
    typeof body.query === "string"
      ? body.query.trim().slice(0, 100)
      : "";
  if (!query)
    return Response.json([], {
      headers: { "Cache-Control": "private, no-store" },
    });
  const result = await database().execute({
    sql: `SELECT DISTINCT COALESCE(raw_label, name, external_id) AS label
      FROM contacts
      WHERE COALESCE(raw_label, name, external_id, '') LIKE ? ESCAPE '\\' COLLATE NOCASE
      ORDER BY label COLLATE NOCASE
      LIMIT 12`,
    args: [like(query)],
  });
  return Response.json(result.rows.map((row) => String(row.label)), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
