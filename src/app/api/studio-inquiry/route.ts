import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const INQUIRIES_FILE = path.join(DATA_DIR, "studio-inquiries.json");

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Basic validation
    if (!body.email || !body.nameRole || !body.product) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Load existing inquiries
    let inquiries: unknown[] = [];
    try {
      const existing = await readFile(INQUIRIES_FILE, "utf-8");
      inquiries = JSON.parse(existing);
    } catch {
      // File doesn't exist yet — create data dir
      await mkdir(DATA_DIR, { recursive: true });
    }

    // Classify the lead
    const isDisqualified = body.budget === "Under $1,000";
    const isImmediate = body.timeline === "Immediate (within 2 weeks)" || body.timeline === "This month";
    const needsDiscovery = body.studioExperience === "Yes — but didn't get results";
    const isFullPackage = (body.budget === "$5,000 – $15,000" || body.budget === "$15,000+") && !isDisqualified;

    const tag = isDisqualified
      ? "disqualified"
      : isFullPackage
        ? "full-package"
        : isImmediate
          ? "sprint-ready"
          : "nurture";

    const tags = [tag];
    if (needsDiscovery) tags.push("needs-discovery");

    const inquiry = {
      ...body,
      tag,
      tags,
      submittedAt: new Date().toISOString(),
    };

    inquiries.push(inquiry);
    await writeFile(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2));

    return NextResponse.json({ ok: true, tag });
  } catch (err) {
    console.error("Studio inquiry error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
