/**
 * CC-SECURITY-REMEDIATION-05 item 2: the 22 routes wired in this batch must refuse an
 * unauthenticated caller once enforcement is turned on for their key, and must keep
 * working exactly as before while enforcement is off (the default). Modeled on
 * guard-wiring.test.ts's pattern for the first 8 routes PR #71 wired.
 *
 * Unlike guard-wiring.test.ts, this file does not mock every side-effect module for
 * every route (nodemailer, Supabase, OpenAI, ElevenLabs, whisper, Telegram, etc.) --
 * the existing safety net already in this codebase is that every service getter
 * (getSupabaseAdmin, getSupabaseService, etc.) returns null/undefined when its env var
 * is unset, and callers degrade gracefully (503/skip) rather than throwing or making a
 * live call. vitest.config.ts loads no .env file, so no real secret is ever present in
 * this environment -- confirmed before writing this file. The denial-path assertions
 * (401/403/503) never reach the handler body at all, since requireFounderAuthority
 * returns before any of that code runs -- that is the property under test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// prospector-search calls @/lib/prospector's geocode/searchBusinesses, which make real
// network calls (Nominatim/Overpass) with no env-gate -- mock them so the denial-path
// tests (which never reach this code) and the two passthrough tests (which do) stay
// fast and hit no real network.
const prospectorMocks = vi.hoisted(() => ({
  geocode: vi.fn(async () => ({ displayName: "Test City" })),
  searchBusinesses: vi.fn(async () => []),
}));
vi.mock("@/lib/prospector", () => prospectorMocks);

import { POST as chatUpload } from "./chat/upload/route";
import { POST as chatPin } from "./chat/pin/route";
import { POST as chatMarkRead } from "./chat/mark-read/route";
import { POST as chatReactions } from "./chat/reactions/route";
import { POST as chatRegenerateImage } from "./chat/regenerate-image/route";
import { POST as chatActionStatus } from "./chat/action-status/route";
import { POST as pipelineLeads } from "./pipeline/leads/route";
import { POST as pipelineDiagnose } from "./pipeline/diagnose/route";
import { POST as pipelineMaintenance } from "./pipeline/maintenance/route";
import { POST as pipelineProposals } from "./pipeline/proposals/route";
import { POST as leadsIntel } from "./leads/intel/route";
import { POST as leadsKit } from "./leads/kit/route";
import { POST as prospectorSearch } from "./prospector/search/route";
import { POST as prospectorImport } from "./prospector/import/route";
import { POST as imageGen } from "./image-gen/route";
import { POST as briefingCompose } from "./briefing/compose/route";
import { POST as oracle } from "./oracle/route";
import { POST as wellnessVerse } from "./wellness/verse/route";
import { POST as tasksNotify } from "./tasks/notify/route";
import { POST as voiceSpeak } from "./voice/speak/route";
import { POST as voiceAtlas } from "./voice/atlas/route";
import { POST as voiceTranscribe } from "./voice/transcribe/route";
import {
  FOUNDER_SESSION_COOKIE,
  signFounderSession,
} from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

// Plausible bodies -- these only need to get PAST the guard for the "unguarded
// passthrough" case; a 400/500 from the handler's own validation after that is an
// acceptable outcome for that case (see the assertion below), since the point is only
// "the guard itself isn't what responded."
type RouteCase = {
  key: string;
  handler: (req: NextRequest) => Promise<Response>;
  kind?: "formdata";
  body?: Record<string, unknown>;
};

const routes: RouteCase[] = [
  { key: "chat-upload", handler: chatUpload, kind: "formdata" },
  { key: "chat-pin", handler: chatPin, body: { messageId: "11111111-1111-1111-1111-111111111111", pinned: true } },
  { key: "chat-mark-read", handler: chatMarkRead, body: { userMessageId: "m1" } },
  { key: "chat-reactions", handler: chatReactions, body: { messageId: "11111111-1111-1111-1111-111111111111", emoji: "👍" } },
  { key: "chat-regenerate-image", handler: chatRegenerateImage, body: { prompt: "p", agentId: "mercury", channelId: "11111111-1111-1111-1111-111111111111" } },
  { key: "chat-action-status", handler: chatActionStatus, body: { synthesisId: "11111111-1111-1111-1111-111111111111", actionIndex: 0, status: "done" } },
  { key: "pipeline-leads", handler: pipelineLeads, body: { name: "n" } },
  { key: "pipeline-diagnose", handler: pipelineDiagnose, body: { leadId: "l1" } },
  { key: "pipeline-maintenance", handler: pipelineMaintenance, body: {} },
  { key: "pipeline-proposals", handler: pipelineProposals, body: { lead_id: "l1" } },
  { key: "leads-intel", handler: leadsIntel, body: { leadId: "l1" } },
  { key: "leads-kit", handler: leadsKit, body: { leadId: "l1" } },
  { key: "prospector-search", handler: prospectorSearch, body: { category: "cafe", location: "Boca Raton, FL" } },
  { key: "prospector-import", handler: prospectorImport, body: { leads: [{ name: "n" }] } },
  { key: "image-gen", handler: imageGen, body: { prompt: "p" } },
  {
    key: "briefing-compose",
    handler: briefingCompose,
    body: { facts: { agents: { active: 0, total: 0 }, revenue: { mrr: 0, arr: 0, last30: 0 }, events: [] } },
  },
  { key: "oracle", handler: oracle, body: { messages: [] } },
  { key: "wellness-verse", handler: wellnessVerse, body: { mood: "tired" } },
  { key: "tasks-notify", handler: tasksNotify, body: { kind: "approve", taskId: "t1" } },
  { key: "voice-speak", handler: voiceSpeak, body: { text: "hi" } },
  { key: "voice-atlas", handler: voiceAtlas, body: { text: "hi" } },
  { key: "voice-transcribe", handler: voiceTranscribe, kind: "formdata" },
];

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/route`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

/** For the two multipart (formData) routes: a well-formed but trivial body. */
function postFormData(headers: Record<string, string> = {}): NextRequest {
  const form = new FormData();
  form.append("file", new File(["x"], "x.txt", { type: "text/plain" }));
  form.append("audio", new File(["x"], "x.webm", { type: "audio/webm" }));
  return new NextRequest(`https://${HOST}/api/command-center/route`, {
    method: "POST",
    headers: { host: HOST, ...headers },
    body: form,
  });
}

function buildRequest(route: (typeof routes)[number], headers: Record<string, string> = {}): NextRequest {
  if (route.kind === "formdata") return postFormData(headers);
  return post(route.body, headers);
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe.each(routes)("POST $key", ({ key, handler }) => {
  const route = routes.find((r) => r.key === key)!;

  it("is unguarded by default (the guard itself is not what responds)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
    const res = await handler(buildRequest(route));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("401s a request with no session when enforced", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", key);
    const res = await handler(buildRequest(route));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("founder_authority_required");
  });

  it("401s a forged cookie when enforced", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await handler(
      buildRequest(route, {
        cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}`,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("403s a valid session used cross-origin", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await handler(
      buildRequest(route, { cookie: validCookie(), origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("proceeds (not 401/403) for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await handler(
      buildRequest(route, { cookie: validCookie(), origin: `https://${HOST}` }),
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await handler(buildRequest(route, { cookie: validCookie() }));
    expect(res.status).toBe(503);
  });
});
