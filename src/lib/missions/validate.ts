/**
 * P06 M2: request validation. Everything here is pure. The M1 database re-checks every bound (CHECK constraints and
 * guard triggers), so these checks exist to give a clear 4xx before a round trip and to enforce what the database
 * cannot know: the agent registry, the founder's identity, and URL hygiene.
 */
import { FOUNDER_ACTOR, registeredAgentId } from "./principal";
import {
  MISSION_STATES, RELATIONS, TARGET_TYPES,
  type Item, type MissionState, type Relation, type TargetType,
} from "./types";

export type Valid<T> = { ok: true; value: T } | { ok: false; message: string };
const bad = (message: string): { ok: false; message: string } => ({ ok: false, message });

const IDENT = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
export const isState = (v: unknown): v is MissionState => typeof v === "string" && (MISSION_STATES as readonly string[]).includes(v);
export const isTargetType = (v: unknown): v is TargetType => typeof v === "string" && (TARGET_TYPES as readonly string[]).includes(v);
export const isRelation = (v: unknown): v is Relation => typeof v === "string" && (RELATIONS as readonly string[]).includes(v);

/** Free text the founder or an agent writes: trimmed, 1..max characters, no control characters except newline/tab. */
export function text(v: unknown, field: string, max: number): Valid<string> {
  if (typeof v !== "string") return bad(`${field} must be a string`);
  const t = v.trim();
  if (t.length < 1 || t.length > max) return bad(`${field} must be 1..${max} characters`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t)) return bad(`${field} contains control characters`);
  return { ok: true, value: t };
}

/** [{id, text}] exactly as M1's mission_valid_items: at most 50, unique ident ids, text 1..500, no other keys. */
export function items(v: unknown, field: string): Valid<Item[]> {
  if (v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v) || v.length > 50) return bad(`${field} must be an array of at most 50 items`);
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const it of v) {
    if (!it || typeof it !== "object" || Array.isArray(it)) return bad(`${field} items must be objects`);
    const keys = Object.keys(it);
    if (keys.length !== 2 || !keys.includes("id") || !keys.includes("text")) return bad(`${field} items are exactly {id, text}`);
    const { id, text: t } = it as Record<string, unknown>;
    if (typeof id !== "string" || !IDENT.test(id)) return bad(`${field} item id must match ${IDENT}`);
    if (seen.has(id)) return bad(`${field} item ids must be unique`);
    const tv = text(t, `${field} text`, 500);
    if (!tv.ok) return tv;
    seen.add(id);
    out.push({ id, text: tv.value });
  }
  return { ok: true, value: out };
}

/** Owner: the founder ("ramon", human) or a canonical active registered agent (agent). Nothing else. */
export function owner(ownerRaw: unknown, kindRaw: unknown): Valid<{ owner: string; ownerKind: "human" | "agent" }> {
  if (kindRaw === "human") {
    return ownerRaw === FOUNDER_ACTOR ? { ok: true, value: { owner: FOUNDER_ACTOR, ownerKind: "human" } }
      : bad(`a human owner must be "${FOUNDER_ACTOR}"`);
  }
  if (kindRaw === "agent") {
    const id = registeredAgentId(ownerRaw);
    return id ? { ok: true, value: { owner: id, ownerKind: "agent" } } : bad("owner is not a registered active agent");
  }
  return bad('ownerKind must be "human" or "agent"');
}

/** Team: distinct canonical active registry ids, at most 24 (the M1 cap). */
export function team(v: unknown): Valid<string[]> {
  if (v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v) || v.length > 24) return bad("agentIds must be an array of at most 24 agent ids");
  const out: string[] = [];
  for (const raw of v) {
    const id = registeredAgentId(raw);
    if (!id) return bad(`agentIds contains an unregistered or inactive agent: ${String(raw).slice(0, 64)}`);
    if (out.includes(id)) return bad("agentIds must be distinct");
    out.push(id);
  }
  return { ok: true, value: out };
}

// Matched against the hostname with any trailing dots removed ("localhost." is localhost).
// Reserved, special-use and private names (RFC 2606, 6761, 6762, 7686, 8375) plus Tailscale MagicDNS suffixes.
const PRIVATE_HOST = /^(localhost|localhost\.localdomain|.*\.localhost|.*\.localdomain|.*\.local|.*\.internal|.*\.ts\.net|.*\.tailscale\.net|.*\.lan|.*\.home\.arpa|.*\.arpa|.*\.intranet|.*\.corp|.*\.private|.*\.test|.*\.example|.*\.invalid|.*\.onion|.*\.alt)$/i;
function isPrivateIp(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b, c] = h.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224                       // this-network, private, loopback, multicast/reserved
      || (a === 100 && b >= 64 && b <= 127)                                    // CGNAT, which includes the tailnet
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || (a === 192 && b === 88 && c === 99);
  }
  return h.includes(":"); // any IPv6 literal: not a shareable evidence location
}

/**
 * External URL hygiene. A mission link is durable, listed and shown, so it must not carry secrets or point inside
 * the tailnet: http(s) only, no userinfo, query string and fragment stripped (signed URLs, tokens and tracking all
 * live there), no private, loopback, link-local, CGNAT/tailnet or IPv6-literal host, default ports only.
 * Returns the canonical form that is stored.
 */
export function cleanUrl(raw: unknown): Valid<string> {
  if (typeof raw !== "string" || raw.length > 2048) return bad("url must be a string of at most 2048 characters");
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return bad("url is not a valid absolute URL"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") return bad("url must be http or https");
  if (u.username || u.password) return bad("url must not contain credentials");
  if (u.port) return bad("url must use the default port");
  const host = u.hostname.replace(/\.+$/, "");
  // A single-label name ("imac", "c02yw21cjwf2") resolves through local search domains, which on this fleet means
  // Tailscale MagicDNS: never a public location.
  if (!host || !host.includes(".") || PRIVATE_HOST.test(host) || isPrivateIp(host)) return bad("url host must be public");
  u.hostname = host;
  // Path parameters (";token=...") are a classic place for session ids and signed tokens.
  if (u.pathname.includes(";")) return bad("url path must not carry ;parameters");
  u.search = "";
  u.hash = "";
  const out = u.toString();
  if (out.length > 512) return bad("url is longer than 512 characters after cleaning");
  return { ok: true, value: out };
}

/** git check-ref-format, the subset that matters for a stored pointer. */
export function gitBranch(v: string): boolean {
  return v.length >= 1 && v.length <= 255 && /^[A-Za-z0-9._/-]+$/.test(v) && !v.startsWith("/") && !v.endsWith("/")
    && !v.endsWith(".") && !v.endsWith(".lock") && !v.includes("..") && !v.includes("//") && !v.startsWith("-")
    && !v.split("/").some((part) => part.startsWith("."));
}
