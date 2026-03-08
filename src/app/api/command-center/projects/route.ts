import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = join(process.cwd(), "public/projects");
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

/* ── Firestore helpers ──────────────────────────────────────────── */
function fromFirestoreValue(val: Record<string, unknown>): unknown {
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("booleanValue" in val) return val.booleanValue;
  if ("mapValue" in val) {
    const mv = val.mapValue as { fields?: Record<string, Record<string, unknown>> };
    return mv.fields ? fromFirestoreFields(mv.fields) : {};
  }
  if ("arrayValue" in val) {
    const av = val.arrayValue as { values?: Array<Record<string, unknown>> };
    return (av.values || []).map(fromFirestoreValue);
  }
  return null;
}

function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

/** Try to load projects from Firestore (bridge-synced data) */
async function loadFromFirestore(): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/command-center/projects`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc.fields) return null;
    const data = fromFirestoreFields(doc.fields);
    const projects = data.projects;
    if (Array.isArray(projects) && projects.length > 0) return projects;
    return null;
  } catch {
    return null;
  }
}

/** Fallback: load from local filesystem (dev only) */
async function loadFromFilesystem(): Promise<unknown[]> {
  const results: unknown[] = [];
  try {
    const entries = await readdir(PROJECTS_DIR);
    for (const entry of entries) {
      if (entry.startsWith(".") || !SLUG_RE.test(entry)) continue;
      try {
        const s = await stat(join(PROJECTS_DIR, entry));
        if (!s.isDirectory()) continue;
        const files = await readdir(join(PROJECTS_DIR, entry));
        const docs = files.filter((f: string) => ALLOWED_DOCS.includes(f));
        if (docs.length === 0) continue;

        let meta = null;
        try {
          const raw = await readFile(join(PROJECTS_DIR, entry, "META.json"), "utf-8");
          meta = JSON.parse(raw);
        } catch { /* no meta */ }

        let tasks: { t: string; done: boolean }[] = [];
        if (files.includes("TASKS.md")) {
          try {
            const tasksContent = await readFile(join(PROJECTS_DIR, entry, "TASKS.md"), "utf-8");
            tasks = parseTasks(tasksContent);
          } catch { /* no tasks */ }
        }

        results.push({ slug: entry, docs, tasks, ...(meta || {}) });
      } catch { /* skip */ }
    }
  } catch { /* dir missing */ }
  results.sort((a: any, b: any) => (a.priority || 99) - (b.priority || 99));
  return results;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const doc = req.nextUrl.searchParams.get("doc");

  // List all projects — try Firestore first, fall back to filesystem
  if (!slug) {
    const firestoreProjects = await loadFromFirestore();
    if (firestoreProjects) {
      return NextResponse.json({ projects: firestoreProjects, source: "firestore" });
    }
    const fsProjects = await loadFromFilesystem();
    return NextResponse.json({ projects: fsProjects, source: "filesystem" });
  }

  // Validate slug
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  // Single project — try Firestore first
  if (!doc) {
    const firestoreProjects = await loadFromFirestore();
    if (firestoreProjects) {
      const project = (firestoreProjects as any[]).find((p: any) => p.slug === slug);
      if (project) return NextResponse.json({ ...project, source: "firestore" });
    }
    // Fallback to filesystem
    try {
      const files = await readdir(join(PROJECTS_DIR, slug));
      const docs = files.filter((f: string) => ALLOWED_DOCS.includes(f));
      let meta = null;
      try {
        const raw = await readFile(join(PROJECTS_DIR, slug, "META.json"), "utf-8");
        meta = JSON.parse(raw);
      } catch { /* */ }
      let tasks: { t: string; done: boolean }[] = [];
      if (files.includes("TASKS.md")) {
        try {
          const tc = await readFile(join(PROJECTS_DIR, slug, "TASKS.md"), "utf-8");
          tasks = parseTasks(tc);
        } catch { /* */ }
      }
      return NextResponse.json({ slug, docs, tasks, ...(meta || {}), source: "filesystem" });
    } catch {
      return NextResponse.json({ slug, docs: [], tasks: [], source: "none" });
    }
  }

  // Read specific doc — still from filesystem (docs are bundled in public/)
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
