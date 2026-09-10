import { database } from "@/lib/db";
import { parseReferralFilters, searchReferrals } from "@/lib/referral-search";
import { getAdmin } from "@/lib/session";

export async function POST(request: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response("Unsupported content type", { status: 415 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return new Response("Invalid filters", { status: 400 });
  const filters = parseReferralFilters(body as Record<string, string>);
  const results = await searchReferrals(database(), filters);
  return Response.json(
    { ...results, filters },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
