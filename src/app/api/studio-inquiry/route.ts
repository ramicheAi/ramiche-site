import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { parseBody, isValidEmail, sanitize, badRequest } from "@/lib/api-security";
import { withAudit } from "@/lib/api-audit";
import { sendEmail } from "@/lib/email";

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

    // Fire-and-forget confirmation to prospect (non-disqualified only)
    if (tag !== "disqualified" && process.env.GMAIL_USER) {
      const firstName = nameRole.split(/[,\s]/)[0];
      sendEmail({
        to: email,
        subject: "Ramiche Studio — Inquiry received",
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#333;">
            <div style="border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:24px;">
              <strong style="font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">Ramiche Studio</strong>
            </div>
            <p style="font-size:15px;line-height:1.6;">Hey ${firstName},</p>
            <p style="font-size:15px;line-height:1.6;">Got your inquiry. I review every one personally and respond within 12 hours if it's a fit.</p>
            <p style="font-size:15px;line-height:1.6;">If we move forward, the next step is a quick 15-minute call to get clear on your vision and make sure we're the right studio for you.</p>
            <p style="font-size:15px;line-height:1.6;">Talk soon,<br/><strong>Ramon</strong><br/><span style="color:#888;font-size:13px;">Creative Director, Ramiche Studio</span></p>
            <div style="border-top:1px solid #eee;margin-top:24px;padding-top:12px;color:#999;font-size:11px;">
              ramiche.com/studio · Fort Lauderdale, FL
            </div>
          </div>
        `,
      }).catch((err) => console.error("Failed to send prospect confirmation:", err));
    }

    // Fire-and-forget email notification to Ramon
    const notifyEmail = process.env.STUDIO_NOTIFY_EMAIL;
    if (notifyEmail) {
      const tagColors: Record<string, string> = {
        "sprint-ready": "#00f0ff",
        "full-package": "#a855f7",
        "nurture": "#f59e0b",
        "disqualified": "#666",
      };
      const tagColor = tagColors[tag] || "#999";

      sendEmail({
        to: notifyEmail,
        subject: `[Ramiche Studio] New inquiry — ${nameRole} (${tag})`,
        html: `
          <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;border-radius:8px;">
            <h2 style="color:#fff;margin:0 0 16px;">New Studio Inquiry</h2>
            <div style="display:inline-block;background:${tagColor}22;border:1px solid ${tagColor}44;color:${tagColor};padding:4px 12px;border-radius:4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">${tag}</div>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Name</td><td style="color:#fff;padding:6px 0;">${nameRole}</td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Email</td><td style="color:#fff;padding:6px 0;"><a href="mailto:${email}" style="color:#00f0ff;">${email}</a></td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Product</td><td style="color:#fff;padding:6px 0;">${sanitizedBody.product || ""}</td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Problem</td><td style="color:#fff;padding:6px 0;">${sanitizedBody.problem || ""}</td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Budget</td><td style="color:#fff;padding:6px 0;">${sanitizedBody.budget || ""}</td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Timeline</td><td style="color:#fff;padding:6px 0;">${sanitizedBody.timeline || ""}</td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Studio exp</td><td style="color:#fff;padding:6px 0;">${sanitizedBody.studioExperience || ""}</td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Website</td><td style="color:#fff;padding:6px 0;"><a href="${sanitizedBody.website || ""}" style="color:#00f0ff;">${sanitizedBody.website || ""}</a></td></tr>
              <tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top;">Referral</td><td style="color:#fff;padding:6px 0;">${sanitizedBody.referral || ""}</td></tr>
            </table>
            <p style="color:#666;font-size:11px;margin-top:20px;">Submitted ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
          </div>
        `,
      }).catch((err) => console.error("Failed to send inquiry notification:", err));
    }

    return NextResponse.json({ ok: true, tag });
  } catch (err) {
    console.error("Studio inquiry error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});
