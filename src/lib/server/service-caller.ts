/**
 * Machine / service caller authentication (P05-B2).
 *
 * Separate from the human owner boundary (owner-identity.ts / protected-mutation.ts):
 *   - A service caller is authenticated by a shared secret that only machines hold.
 *   - Its principal is `service:<name>`. It is NEVER the owner uid, so a machine
 *     can never act as Ramon, and request-supplied identity fields are ignored.
 *   - Missing or too-short configuration fails closed (503), wrong or absent
 *     credentials fail with 401. Comparison is constant-time.
 *   - No credentials are issued here. Services whose secret already exists keep it
 *     (bridge, openclaw-webhook); new services fail closed until configured.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { denialResponse } from "./owner-identity";
import { guardPrivateRead, guardProtectedMutation } from "./protected-mutation";

export type ServiceName = "bridge" | "openclaw-webhook" | "vapi" | "cron" | "push";

type CredentialSpec = { header: string; bearer: boolean; envVars: readonly string[] };

const SERVICE_SPECS: Record<ServiceName, CredentialSpec> = {
  // Existing secret used by scripts/bridge-sync.mjs.
  bridge: { header: "x-bridge-secret", bearer: false, envVars: ["BRIDGE_API_SECRET"] },
  // Existing bearer used by OpenClaw to post into chat.
  "openclaw-webhook": { header: "authorization", bearer: true, envVars: ["OPENCLAW_CC_WEBHOOK_TOKEN", "OPENCLAW_GATEWAY_TOKEN"] },
  // New: Vapi "server URL secret" header. Not configured yet, so it fails closed.
  vapi: { header: "x-vapi-secret", bearer: false, envVars: ["PARALLAX_VAPI_WEBHOOK_SECRET"] },
  // New: local cron jobs (nurture, daily prospect, state snapshot). Not configured yet.
  cron: { header: "authorization", bearer: true, envVars: ["PARALLAX_CRON_TOKEN"] },
  // Existing secret for agent pushes into chat (/api/command-center/push).
  push: { header: "x-cc-push-secret", bearer: false, envVars: ["CC_PUSH_SECRET"] },
};

export const MIN_SERVICE_SECRET_LENGTH = 16;

export type ServiceGuardSuccess = { ok: true; principal: `service:${ServiceName}`; kind: "service" };
export type ServiceGuardFailure = { ok: false; status: number; reason: string; response: NextResponse };
export type ServiceGuardResult = ServiceGuardSuccess | ServiceGuardFailure;

function fail(status: number, reason: string): ServiceGuardFailure {
  return { ok: false, status, reason, response: denialResponse(status, reason) };
}

function configuredSecret(spec: CredentialSpec): string | null {
  for (const name of spec.envVars) {
    const raw = process.env[name];
    if (typeof raw !== "string") continue;
    const value = raw.trim().replace(/\\n$/, "");
    if (value) return value;
  }
  return null;
}

function presentedSecret(req: Request, spec: CredentialSpec): string | null {
  const raw = req.headers.get(spec.header);
  if (raw === null) return null;
  if (!spec.bearer) return raw.trim() || null;
  const match = /^Bearer ([^\s,]+)$/.exec(raw.trim());
  return match ? match[1] : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const len = Math.max(ab.length, bb.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  ab.copy(pa);
  bb.copy(pb);
  return timingSafeEqual(pa, pb) && ab.length === bb.length;
}

/** True when the request carries this service's credential header at all. */
export function hasServiceCredential(req: Request, service: ServiceName): boolean {
  return req.headers.get(SERVICE_SPECS[service].header) !== null;
}

export async function guardServiceCaller(req: Request, service: ServiceName): Promise<ServiceGuardResult> {
  const spec = SERVICE_SPECS[service];
  const expected = configuredSecret(spec);
  if (!expected || expected.length < MIN_SERVICE_SECRET_LENGTH) return fail(503, "service_auth_not_configured");
  const presented = presentedSecret(req, spec);
  if (!presented) return fail(401, "service_credential_missing");
  if (!constantTimeEqual(presented, expected)) return fail(401, "service_credential_invalid");
  return { ok: true, principal: `service:${service}`, kind: "service" };
}

export type OwnerOrServiceResult =
  | { ok: true; kind: "owner"; uid: string }
  | ServiceGuardSuccess
  | ServiceGuardFailure;

/**
 * Human owner OR a named machine service. If the request carries the service's
 * credential header, ONLY the service path is evaluated (no fallback to the human
 * path), so a malformed machine credential can never be rescued by a browser cookie
 * and vice versa. Otherwise the P03 owner boundary applies unchanged.
 */
export async function guardOwnerOrService(
  req: Request,
  service: ServiceName,
  kind: "read" | "mutation",
): Promise<OwnerOrServiceResult> {
  if (hasServiceCredential(req, service)) return guardServiceCaller(req, service);
  const owner = kind === "read" ? await guardPrivateRead(req) : await guardProtectedMutation(req);
  if (!owner.ok) return { ok: false, status: owner.status, reason: owner.reason, response: owner.response };
  return { ok: true, kind: "owner", uid: owner.uid };
}
