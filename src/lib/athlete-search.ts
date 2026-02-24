/**
 * Full-text search for athlete lookup across large teams.
 * Uses a pre-built inverted index for sub-millisecond searches on 1K+ athletes.
 * No external dependencies.
 */

interface SearchableAthlete {
  id: string;
  name: string;
  group: string;
  age?: number;
  level?: string;
  [key: string]: unknown;
}

interface SearchIndex {
  trigrams: Map<string, Set<string>>; // trigram → athlete IDs
  athletes: Map<string, SearchableAthlete>; // ID → athlete
  built: number; // timestamp
}

let _index: SearchIndex | null = null;

/** Generate trigrams from a string */
function trigrams(s: string): string[] {
  const clean = s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const result: string[] = [];
  for (let i = 0; i <= clean.length - 3; i++) {
    result.push(clean.slice(i, i + 3));
  }
  // Also add bigrams for short names
  for (let i = 0; i <= clean.length - 2; i++) {
    result.push(clean.slice(i, i + 2));
  }
  return result;
}

/** Build the search index from a roster */
export function buildIndex(athletes: SearchableAthlete[]): void {
  const trigramMap = new Map<string, Set<string>>();
  const athleteMap = new Map<string, SearchableAthlete>();

  for (const athlete of athletes) {
    athleteMap.set(athlete.id, athlete);

    // Index name, group, and level
    const searchable = [athlete.name, athlete.group, athlete.level || ""].join(" ");
    for (const tri of trigrams(searchable)) {
      if (!trigramMap.has(tri)) trigramMap.set(tri, new Set());
      trigramMap.get(tri)!.add(athlete.id);
    }
  }

  _index = { trigrams: trigramMap, athletes: athleteMap, built: Date.now() };
}

/** Search athletes by query string — returns ranked results */
export function searchAthletes(query: string, limit = 20): SearchableAthlete[] {
  if (!_index) return [];
  if (!query.trim()) return Array.from(_index.athletes.values()).slice(0, limit);

  const queryTrigrams = trigrams(query);
  if (queryTrigrams.length === 0) return [];

  // Score each athlete by how many trigrams match
  const scores = new Map<string, number>();
  for (const tri of queryTrigrams) {
    const matches = _index.trigrams.get(tri);
    if (matches) {
      for (const id of matches) {
        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }
  }

  // Sort by score (descending), then by name
  return Array.from(scores.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const nameA = _index!.athletes.get(a[0])?.name || "";
      const nameB = _index!.athletes.get(b[0])?.name || "";
      return nameA.localeCompare(nameB);
    })
    .slice(0, limit)
    .map(([id]) => _index!.athletes.get(id)!)
    .filter(Boolean);
}

/** Check if index needs rebuilding (older than 5 minutes or empty) */
export function needsRebuild(): boolean {
  if (!_index) return true;
  return Date.now() - _index.built > 5 * 60 * 1000;
}

/** Get index stats */
export function getIndexStats(): { athletes: number; trigrams: number; builtAt: number } | null {
  if (!_index) return null;
  return {
    athletes: _index.athletes.size,
    trigrams: _index.trigrams.size,
    builtAt: _index.built,
  };
}
