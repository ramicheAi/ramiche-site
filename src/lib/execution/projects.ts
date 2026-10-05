/**
 * P06 M6 project and repository resolution.
 *
 * Project identity stays canonical in PROJECTS (shared-projects.ts): this file adds only what an executor needs that
 * PROJECTS does not hold, keyed by the same slugs: the repository (owner/repo) and where checkouts of it may live on an
 * execution host. A slug here that is not in PROJECTS fails a test, so the two cannot drift apart.
 *
 * Resolution never guesses. A command naming no project, or more than one, or a project whose repository is not
 * settled, gets a question back instead of a repository.
 */
import { PROJECTS } from "@/app/command-center/shared-projects";

export interface RepoEntry {
  slug: string;
  /** owner/repo, or null when the repository is not settled (resolution then asks). */
  origin: string | null;
  /** Candidate checkout directory names under an execution root; any one whose origin matches and holds the head works. */
  checkouts: string[];
  /** Words in a command that name this project (lower case, matched on word boundaries). */
  aliases: string[];
  /** Why the repository is not settled, shown to the founder when origin is null. */
  unsettled?: string;
}

export const REPO_REGISTRY: readonly RepoEntry[] = [
  { slug: "mettle", origin: "ramicheAi/mettle", checkouts: ["mettle"], aliases: ["mettle", "apex athlete"] },
  {
    slug: "galactik-antics", origin: "ramicheAi/galactik-antics",
    checkouts: ["galactik-antics", "GALACTIK-ANTICS", "GALACTIK-ANTICS 2"], aliases: ["galactik antics", "galactik"],
  },
  {
    slug: "command-center", origin: "ramicheAi/ramiche-site", checkouts: ["ramiche-site"],
    aliases: ["parallax os", "command center", "cockpit", "ramiche-site", "ramiche site"],
  },
  {
    slug: "parallax", origin: null, checkouts: [], aliases: ["parallax site", "parallaxvinc.com", "marketing site"],
    unsettled: "The public Parallax site is served from ramicheAi/parallax-site, but the Parallax project lists the ramiche-site homepage. Which repository should Parallax work run in?",
  },
];

export const projectName = (slug: string) => PROJECTS.find((p) => p.slug === slug)?.name ?? slug;

export type Resolution =
  | { ok: true; entry: RepoEntry & { origin: string }; name: string }
  | { ok: false; code: "project_unresolved" | "project_ambiguous" | "repository_unsettled"; question: string; candidates: string[] };

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9.\- ]+/g, " ").replace(/\s+/g, " ").trim()} `;

/** Which registered project a command names. Exactly one, or a question. */
export function resolveProject(text: string, registry: readonly RepoEntry[] = REPO_REGISTRY): Resolution {
  const t = words(text);
  const hits = registry.filter((e) => e.aliases.some((a) => t.includes(` ${a} `)));
  if (hits.length === 0) {
    return { ok: false, code: "project_unresolved", question: "Which project is this for?", candidates: registry.filter((e) => e.origin).map((e) => e.slug) };
  }
  if (hits.length > 1) {
    return { ok: false, code: "project_ambiguous", question: `This names more than one project (${hits.map((h) => projectName(h.slug)).join(", ")}). Which one?`, candidates: hits.map((h) => h.slug) };
  }
  return bySlug(hits[0].slug, registry);
}

/** A project chosen by slug (by the founder, or from a resolution). */
export function bySlug(slug: string, registry: readonly RepoEntry[] = REPO_REGISTRY): Resolution {
  const e = registry.find((x) => x.slug === slug);
  if (!e) return { ok: false, code: "project_unresolved", question: `No repository is registered for "${slug}". Which project is this for?`, candidates: registry.filter((x) => x.origin).map((x) => x.slug) };
  if (!e.origin) return { ok: false, code: "repository_unsettled", question: e.unsettled ?? `Which repository is ${projectName(slug)}?`, candidates: [] };
  return { ok: true, entry: e as RepoEntry & { origin: string }, name: projectName(slug) };
}

/** Normalises a GitHub remote URL to owner/repo (https, ssh and scp forms); any other host is not an origin. */
export function originOf(remoteUrl: string): string | null {
  const m = remoteUrl.trim().match(/^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
