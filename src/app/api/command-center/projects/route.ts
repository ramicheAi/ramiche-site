import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = join(process.env.HOME || "/Users/admin", ".openclaw/workspace/projects");

const ALLOWED_SLUGS = ["mettle", "parallax-site", "parallax-publish", "galactik-antics"];
const ALLOWED_DOCS = ["ARCHITECTURE.md", "DECISIONS.md", "MEMORY.md", "PIPELINE.md", "TASKS.md"];

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const doc = req.nextUrl.searchParams.get("doc");

  // List all projects with their available docs
  if (!slug) {
    const results: { slug: string; docs: string[] }[] = [];
    for (const s of ALLOWED_SLUGS) {
      try {
        const files = await readdir(join(PROJECTS_DIR, s));
        const docs = files.filter((f: string) => ALLOWED_DOCS.includes(f));
        results.push({ slug: s, docs });
      } catch {
        results.push({ slug: s, docs: [] });
      }
    }
    return NextResponse.json({ projects: results });
  }

  // Validate slug
  if (!ALLOWED_SLUGS.includes(slug)) {
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
