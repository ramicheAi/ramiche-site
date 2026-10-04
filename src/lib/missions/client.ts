/**
 * P06 M4A: the browser's only way to talk to Missions. One thin call per M2 route, through cockpitFetch (same-origin,
 * session cookie, session-bound CSRF on every mutation). No policy and no identity here: the server takes the founder
 * from the session and re-checks everything.
 */
import { cockpitFetch } from "@/lib/cockpit-fetch";
import type { EventRow, LinkRow, MissionRow, MissionState } from "./types";
import { errorText } from "./ui";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };
export type MissionDetail = { mission: MissionRow; links: LinkRow[]; events: EventRow[]; eventsTruncated: boolean };

export interface MissionApi {
  /** Newest first, 100 per page; pass the previous page's nextBefore to get the next (older) page. */
  list(before?: number): Promise<ApiResult<{ missions: MissionRow[]; nextBefore: number | null }>>;
  get(id: string, includeRemoved?: boolean): Promise<ApiResult<MissionDetail>>;
  create(body: Record<string, unknown>): Promise<ApiResult<MissionRow>>;
  transition(id: string, to: MissionState, expectedFrom: MissionState): Promise<ApiResult<MissionRow>>;
  verify(id: string, note?: string): Promise<ApiResult<MissionRow>>;
  reassign(id: string, body: { owner: string; ownerKind: "human" | "agent"; agentIds: string[] }): Promise<ApiResult<MissionRow>>;
  addLink(id: string, body: Record<string, unknown>): Promise<ApiResult<{ link: LinkRow; resolution: string }>>;
  removeLink(id: string, linkId: string): Promise<ApiResult<LinkRow>>;
}

const BASE = "/api/command-center/missions";

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await cockpitFetch(path, init?.body ? { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } } : init);
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "Network error." };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (res.ok && body && typeof body === "object" && "data" in body) return { ok: true, data: (body as { data: T }).data };
  return { ok: false, status: res.status, message: errorText(body, `Request failed (${res.status}).`) };
}
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const httpMissionApi: MissionApi = {
  list: (before) => call(`${BASE}?limit=100${before !== undefined ? `&before=${before}` : ""}`),
  get: (id, includeRemoved) => call(`${BASE}/${enc(id)}${includeRemoved ? "?includeRemoved=1" : ""}`),
  create: (body) => call(BASE, post(body)),
  transition: (id, to, expectedFrom) => call(`${BASE}/${enc(id)}/transition`, post({ to, expectedFrom })),
  verify: (id, note) => call(`${BASE}/${enc(id)}/verify`, post(note ? { note } : {})),
  reassign: (id, body) => call(`${BASE}/${enc(id)}/reassign`, post(body)),
  addLink: (id, body) => call(`${BASE}/${enc(id)}/links`, post(body)),
  removeLink: (id, linkId) => call(`${BASE}/${enc(id)}/links/${enc(linkId)}`, { method: "DELETE" }),
};
