import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { PROJECTS } from "../../../command-center/shared-projects";

const PROJECTS_DIR = join(process.cwd(), "public/projects");
const ALLOWED_DOCS = ["ARCHITECTURE.md", "DECISIONS.md", "MEMORY.md", "PIPELINE.md", "TASKS.md"];
const SLUG_RE = /^[a-z0-9-]+$/;

const GH_OWNER = "ramicheAi";
const GH_REPO = "ramiche-site";
const GH_BRANCH = "main";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const dynamic = "force-dynamic";

/* ─── In-memory cache ────────────────────────────────────────────────────── */
const cache = new Map<string, { data: string; ts: number }>();

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: string) {
  cache.set(key, { data, ts: Date.now() });
}

/* ─── GitHub Contents API (public repo, no auth needed) ──────────────── */
async function fetchFromGitHub(path: string): Promise<string | null> {
  const cacheKey = `gh:${path}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github.v3.raw", "User-Agent": "ramiche-command-center" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    setCache(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}

/* ─── Task parser ────────────────────────────────────────────────────── */
function parseTasks(content: string): { t: string; done: boolean }[] {
  const tasks: { t: string; done: boolean }[] = [];
  for (const line of content.split("\n")) {
    const doneMatch = line.match(/^-\s*\[x\]\s+(.+)/i);
    const todoMatch = line.match(/^-\s*\[\s\]\s+(.+)/);
    if (doneMatch) tasks.push({ t: doneMatch[1].trim(), done: true });
    else if (todoMatch) tasks.push({ t: todoMatch[1].trim(), done: false });
  }
  return tasks;
}

/* ─── Load tasks: GitHub first, local filesystem fallback ────────────── */
async function loadLiveTasks(slug: string): Promise<{ t: string; done: boolean }[] | null> {
  // Try GitHub API first (always latest from main branch)
  const ghContent = await fetchFromGitHub(`public/projects/${slug}/TASKS.md`);
  if (ghContent) return parseTasks(ghContent);

  // Fallback to local filesystem (baked at build time)
  try {
    const content = await readFile(join(PROJECTS_DIR, slug, "TASKS.md"), "utf-8");
    return parseTasks(content);
  } catch {
    return null;
  }
}

/* ─── Load META.json: GitHub first, local fallback ───────────────────── */
async function loadMeta(slug: string): Promise<Record<string, unknown> | null> {
  const ghContent = await fetchFromGitHub(`public/projects/${slug}/META.json`);
  if (ghContent) {
    try { return JSON.parse(ghContent); } catch { /* fall through */ }
  }

  try {
    const raw = await readFile(join(PROJECTS_DIR, slug, "META.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ─── List docs: local filesystem (GitHub dir listing is expensive) ─── */
async function listDocs(slug: string): Promise<string[]> {
  try {
    const files = await readdir(join(PROJECTS_DIR, slug));
    return files.filter((f: string) => ALLOWED_DOCS.includes(f));
  } catch {
    return [];
  }
}

/* ─── Merge: shared-projects.ts base + live TASKS.md + META.json ────── */
async function loadAllProjects() {
  const results = await Promise.all(
    PROJECTS.map(async (base) => {
      const liveTasks = await loadLiveTasks(base.slug);
      const meta = await loadMeta(base.slug);
      const docs = await listDocs(base.slug);

      return {
        ...base,
        ...(meta || {}),
        tasks: liveTasks || base.tasks,
        docs,
        link:
          meta && typeof meta.link === "string" ? meta.link : base.link,
      };
    })
  );
  return results.sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

/* ─── Load doc content: GitHub first, local fallback ─────────────────── */
async function loadDocContent(slug: string, doc: string): Promise<string | null> {
  const ghContent = await fetchFromGitHub(`public/projects/${slug}/${doc}`);
  if (ghContent) return ghContent;

  try {
    return await readFile(join(PROJECTS_DIR, slug, doc), "utf-8");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const doc = req.nextUrl.searchParams.get("doc");

  // List all projects
  if (!slug) {
    const projects = await loadAllProjects();
    return NextResponse.json({ projects, source: "github+local" });
  }

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  // Single project
  if (!doc) {
    const projects = await loadAllProjects();
    const project = projects.find((p) => p.slug === slug);
    if (project) return NextResponse.json({ ...project, source: "github+local" });
    return NextResponse.json({ slug, docs: [], tasks: [], source: "none" });
  }

  // Read specific doc
  if (!ALLOWED_DOCS.includes(doc)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }
  const content = await loadDocContent(slug, doc);
  if (content) return NextResponse.json({ slug, doc, content });
  return NextResponse.json({ error: "Document not found" }, { status: 404 });
}
