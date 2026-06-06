import { NextResponse } from "next/server";

import { geocode, searchBusinesses } from "@/lib/prospector";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/** POST { category, location, onlyNoWebsite?, limit? } -> { area, results } */
export async function POST(req: Request) {
  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");

  const category = sanitize(body.category, 40);
  const location = sanitize(body.location, 120);
  if (!category) return badRequest("category required");
  if (!location) return badRequest("location required");

  try {
    const area = await geocode(location);
    if (!area) return NextResponse.json({ error: `Could not find location: ${location}` }, { status: 404 });

    const results = await searchBusinesses(category, area, {
      onlyNoWebsite: body.onlyNoWebsite === true,
      limit: Number(body.limit) || 60,
    });

    return NextResponse.json({ area: { displayName: area.displayName }, count: results.length, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "search failed" }, { status: 502 });
  }
}
