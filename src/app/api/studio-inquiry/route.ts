import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { parseBody, isValidEmail, sanitize, badRequest } from "@/lib/api-security";
import { withAudit } from "@/lib/api-audit";

const DATA_DIR = path.join(process.cwd(), "data");
const INQUIRIES_FILE = path.join(DATA_DIR, "studio-inquiries.json");

export const POST = withAudit("/api/studio-inquiry", async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`studio-inquiry:${ip}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { data: body, error: parseError } = await parseBody(req);
    if (parseError || !body) return badRequest(parseError || "Invalid request");

    const email = sanitize(body.email, 254);
    const nameRole = sanitize(body.nameRole, 200);
    const product = sanitize(body.product, 200);

    if (!email || !nameRole || !product) {
      return badRequest("Missing required fields");
    }
    if (!isValidEmail(email)) {
      return badRequest("Invalid email address");
    }

    // Sanitize all string fields
    const sanitizedBody = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? sanitize(v, 500) : v])
    );

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
      ...sanitizedBody,
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
});
