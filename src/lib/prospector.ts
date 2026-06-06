// /Users/admin/ramiche-site/src/lib/prospector.ts
// Worldwide business search via OpenStreetMap — Nominatim (geocode) + Overpass
// (business data). Free, no API key, global coverage. Flags "no website"
// businesses (the web-dev-outreach target).

const UA = "ParallaxCommandCenter/1.0 (business prospecting; contact ramon)";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

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
  { id: "contractor", label: "Contractors / Trades", filter: '["craft"]' },
];

export interface ProspectResult {
  name: string;
  category: string;
  address: string;
  phone: string | null;
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
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ display_name: string; boundingbox: string[] }>;
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

  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status} — try a narrower location`);
  const data = (await res.json()) as { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };

  const out: ProspectResult[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue; // unnamed = not a usable lead
    const website = tags.website || tags["contact:website"] || null;
    if (opts.onlyNoWebsite && website) continue;
    out.push({
      name,
      category: cat.label,
      address: addrOf(tags),
      phone: tags.phone || tags["contact:phone"] || null,
      website,
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      osmId: `${el.type}/${el.id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}
