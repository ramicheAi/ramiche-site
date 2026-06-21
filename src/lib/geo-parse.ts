// /Users/admin/ramiche-site/src/lib/geo-parse.ts
// Parse a "City, ST" from a free-form US address string. Used to backfill meta.city
// on legacy leads so the ICP learning loop + funnel can segment by location.

/**
 * Extract "City, ST" from an address like "123 Main St, Tampa, FL, 33612".
 * Returns null when no city/state can be confidently parsed.
 */
export function cityStateFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const addr = address.trim();
  if (!addr) return null;

  // Strongest signal: "<City>, <ST> <ZIP>" (state = 2 letters, optional zip).
  const m = addr.match(/,\s*([A-Za-z][A-Za-z .'\-]+?),?\s+([A-Z]{2})\b(?:,?\s*\d{5}(?:-\d{4})?)?\s*$/);
  if (m) {
    const city = m[1].trim().replace(/\s+/g, " ");
    const st = m[2].toUpperCase();
    if (city.length >= 2) return `${city}, ${st}`;
  }

  // Fallback: comma-split, look for a 2-letter state token and take the part before it.
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const stMatch = parts[i].match(/^([A-Z]{2})\b/);
    if (stMatch && parts[i - 1] && /[A-Za-z]/.test(parts[i - 1])) {
      const city = parts[i - 1].replace(/\s+/g, " ");
      if (city.length >= 2 && !/^\d/.test(city)) return `${city}, ${stMatch[1]}`;
    }
  }
  return null;
}
