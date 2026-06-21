// /Users/admin/ramiche-site/src/lib/prospector.ts
// Worldwide business search via OpenStreetMap — Nominatim (geocode) + Overpass
// (business data). Free, no API key, global coverage. Flags "no website"
// businesses (the web-dev-outreach target).
import { osmLooksClosed } from "./lead-qualification";

const UA = "ParallaxCommandCenter/1.0 (business prospecting; contact ramon)";
// Overpass mirrors — tried in order so one overloaded host can't sink a search.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** fetch with a hard client-side timeout so a slow/hung public API can never wedge the server. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Search timed out — try a narrower location.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Curated categories → OSM tag filters. Covers the verticals in the
// web-dev-outreach game plan plus common local-business types worldwide.
export const CATEGORIES: { id: string; label: string; filter: string }[] = [
  { id: "restaurant", label: "Restaurants", filter: '["amenity"="restaurant"]' },
  { id: "cafe", label: "Cafes", filter: '["amenity"="cafe"]' },
  { id: "bar", label: "Bars / Pubs", filter: '["amenity"~"^(bar|pub)$"]' },
  { id: "gym", label: "Gyms / Fitness", filter: '["leisure"="fitness_centre"]' },
  { id: "salon", label: "Hair Salons", filter: '["shop"="hairdresser"]' },
  { id: "beauty", label: "Beauty / Spa", filter: '["shop"="beauty"]' },
  { id: "retail", label: "Retail Shops", filter: '["shop"~"^(clothes|boutique|gift|jewelry|shoes|furniture)$"]' },
  { id: "realestate", label: "Real Estate", filter: '["office"="estate_agent"]' },
  { id: "lawyer", label: "Law Firms", filter: '["office"="lawyer"]' },
  { id: "dentist", label: "Dentists", filter: '["amenity"="dentist"]' },
  { id: "doctor", label: "Doctors / Clinics", filter: '["amenity"="doctors"]' },
  { id: "autorepair", label: "Auto Repair", filter: '["shop"="car_repair"]' },
  { id: "hotel", label: "Hotels", filter: '["tourism"="hotel"]' },
  // Curated trades only — the bare ["craft"] tag also matches breweries/potteries
  // (false positives we saw in testing). This targets real home-service contractors.
  { id: "contractor", label: "Contractors / Trades", filter: '["craft"~"^(electrician|plumber|hvac|carpenter|roofer|painter|builder|gardener|stonemason|tiler|handyman|metal_construction|window_construction|insulation|electronics_repair)$"]' },
];

export interface ProspectResult {
  name: string;
  category: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
  osmId: string;
}

export interface GeoArea {
  displayName: string;
  bbox: [number, number, number, number]; // south, west, north, east
}

export async function geocode(location: string): Promise<GeoArea | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA } }, 12_000);
  if (!res.ok) return null;
  let data: Array<{ display_name: string; boundingbox: string[] }>;
  try { data = (await res.json()) as Array<{ display_name: string; boundingbox: string[] }>; } catch { return null; }
  if (!data?.length) return null;
  const bb = data[0].boundingbox.map(Number); // [south, north, west, east]
  return { displayName: data[0].display_name, bbox: [bb[0], bb[2], bb[1], bb[3]] };
}

function addrOf(tags: Record<string, string>): string {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.join(", ");
}

export async function searchBusinesses(
  categoryId: string,
  area: GeoArea,
  opts: { onlyNoWebsite?: boolean; limit?: number } = {},
): Promise<ProspectResult[]> {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) throw new Error(`unknown category: ${categoryId}`);
  const limit = Math.min(opts.limit ?? 60, 200);
  const [s, w, n, e] = area.bbox;
  // nwr = node/way/relation; "out center tags" gives a point for areas too.
  const q = `[out:json][timeout:25];nwr${cat.filter}(${s},${w},${n},${e});out center tags ${limit * 2};`;

  // Try each Overpass mirror with a hard timeout; first one that returns valid JSON wins.
  let data: { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | null = null;
  let lastErr = "";
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetchWithTimeout(mirror, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
      }, 30_000);
      if (!res.ok) { lastErr = `Overpass HTTP ${res.status}`; continue; }
      try { data = await res.json(); break; } catch { lastErr = "Overpass returned a non-JSON response (overloaded)"; continue; }
    } catch (e) { lastErr = e instanceof Error ? e.message : "request failed"; continue; }
  }
  if (!data) throw new Error(`${lastErr || "Search failed"} — try a narrower location or a different category.`);

  const out: ProspectResult[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue; // unnamed = not a usable lead
    if (osmLooksClosed(name, tags)) continue; // skip OSM-flagged closed/disused businesses (free pre-filter)
    const website = tags.website || tags["contact:website"] || null;
    if (opts.onlyNoWebsite && website) continue;
    out.push({
      name,
      category: cat.label,
      address: addrOf(tags),
      phone: tags.phone || tags["contact:phone"] || null,
      // Email was never captured before — it unlocks the cold-email channel for
      // leads that have no phone in OSM (the common case for higher-value verticals).
      email: tags.email || tags["contact:email"] || null,
      website,
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      osmId: `${el.type}/${el.id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}
