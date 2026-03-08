import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = join(process.cwd(), "public/projects");

const ALLOWED_DOCS = ["ARCHITECTURE.md", "DECISIONS.md", "MEMORY.md", "PIPELINE.md", "TASKS.md"];

// Slug must be lowercase alphanumeric + hyphens only
const SLUG_RE = /^[a-z0-9-]+$/;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const doc = req.nextUrl.searchParams.get("doc");

  // List all projects with their available docs (scan directory)
  if (!slug) {
    const results: { slug: string; docs: string[] }[] = [];
    try {
      const entries = await readdir(PROJECTS_DIR);
      for (const entry of entries) {
        if (entry.startsWith(".") || !SLUG_RE.test(entry)) continue;
        try {
          const s = await stat(join(PROJECTS_DIR, entry));
          if (!s.isDirectory()) continue;
          const files = await readdir(join(PROJECTS_DIR, entry));
          const docs = files.filter((f: string) => ALLOWED_DOCS.includes(f));
          if (docs.length > 0) results.push({ slug: entry, docs });
        } catch { /* skip unreadable */ }
      }
    } catch { /* projects dir missing */ }
    return NextResponse.json({ projects: results });
  }

  // Validate slug format
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  // List docs for a specific project
  if (!doc) {
    try {
      const files = await readdir(join(PROJECTS_DIR, slug));
      const docs = files.filter((f: string) => ALLOWED_DOCS.includes(f));
      return NextResponse.json({ slug, docs });
    } catch {
      return NextResponse.json({ slug, docs: [] });
    }
  }

  // Validate doc name
  if (!ALLOWED_DOCS.includes(doc)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  // Read specific doc
  try {
    const content = await readFile(join(PROJECTS_DIR, slug, doc), "utf-8");
    return NextResponse.json({ slug, doc, content });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}
