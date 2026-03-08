import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { PROJECTS } from "../../../command-center/shared-projects";

const PROJECTS_DIR = join(process.cwd(), "public/projects");
const ALLOWED_DOCS = ["ARCHITECTURE.md", "DECISIONS.md", "MEMORY.md", "PIPELINE.md", "TASKS.md"];
const SLUG_RE = /^[a-z0-9-]+$/;

export const dynamic = "force-dynamic";

/** Parse TASKS.md markdown into structured task objects */
function parseTasks(content: string): { t: string; done: boolean }[] {
  const tasks: { t: string; done: boolean }[] = [];
  for (const line of content.split("\n")) {
    const doneMatch = line.match(/^-\s*\[x\]\s+(.+)/i);
    const todoMatch = line.match(/^-\s*\[\s\]\s+(.+)/);
    if (doneMatch) {
      tasks.push({ t: doneMatch[1].trim(), done: true });
    } else if (todoMatch) {
      tasks.push({ t: todoMatch[1].trim(), done: false });
    }
  }
  return tasks;
}

/** Load live tasks from public/projects/{slug}/TASKS.md */
async function loadLiveTasks(slug: string): Promise<{ t: string; done: boolean }[] | null> {
  try {
    const content = await readFile(join(PROJECTS_DIR, slug, "TASKS.md"), "utf-8");
    return parseTasks(content);
  } catch {
    return null;
  }
}

/** Load META.json overrides from public/projects/{slug}/META.json */
async function loadMeta(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(join(PROJECTS_DIR, slug, "META.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** List available docs for a project slug */
async function listDocs(slug: string): Promise<string[]> {
  try {
    const files = await readdir(join(PROJECTS_DIR, slug));
    return files.filter((f: string) => ALLOWED_DOCS.includes(f));
  } catch {
    return [];
  }
}

/**
 * Merge strategy: shared-projects.ts provides metadata (accent, lead, agents, status, etc.)
 * TASKS.md from filesystem overrides tasks (live data from agent commits)
 * META.json from filesystem can override any field (status, desc, blockers, etc.)
 */
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
        link: meta && "link" in meta ? (meta as any).link : base.link,
      };
    })
  );
  return results.sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const doc = req.nextUrl.searchParams.get("doc");

  // List all projects — merged from shared-projects + live filesystem
  if (!slug) {
    const projects = await loadAllProjects();
    return NextResponse.json({ projects, source: "merged" });
  }

  // Validate slug
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  // Single project
  if (!doc) {
    const projects = await loadAllProjects();
    const project = projects.find((p) => p.slug === slug);
    if (project) {
      return NextResponse.json({ ...project, source: "merged" });
    }
    return NextResponse.json({ slug, docs: [], tasks: [], source: "none" });
  }

  // Read specific doc from filesystem
  if (!ALLOWED_DOCS.includes(doc)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }
  try {
    const content = await readFile(join(PROJECTS_DIR, slug, doc), "utf-8");
    return NextResponse.json({ slug, doc, content });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}
