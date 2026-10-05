/**
 * P06 M5: the browser's calls for Universal Command, through cockpitFetch (same-origin session + CSRF). No identity is
 * sent: the server takes the founder from the session. Recording a shadow decision executes nothing.
 */
import { cockpitFetch } from "@/lib/cockpit-fetch";
import { errorText } from "@/lib/missions/ui";
import type { ApiResult } from "@/lib/missions/client";
import type { Handler, ShadowRecord } from "./types";

export interface CommandApi {
  route(body: { text: string; missionId?: string | null; handlerHint?: Handler | null; supersedes?: string | null }): Promise<ApiResult<ShadowRecord>>;
  get(id: string): Promise<ApiResult<ShadowRecord>>;
}

const BASE = "/api/command-center/command/shadow";

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try { res = await cockpitFetch(path, init); } catch (e) { return { ok: false, status: 0, message: e instanceof Error ? e.message : "Network error." }; }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (res.ok && body && typeof body === "object" && "data" in body) return { ok: true, data: (body as { data: T }).data };
  return { ok: false, status: res.status, message: errorText(body, `Request failed (${res.status}).`) };
}

export const httpCommandApi: CommandApi = {
  route: (body) => call(BASE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  get: (id) => call(`${BASE}/${encodeURIComponent(id)}`),
};

/** "/command-center/missions/<uuid>" (and below) -> that mission id; anything else -> null. */
export function missionIdFromPath(pathname: string | null | undefined): string | null {
  const m = /^\/command-center\/missions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i.exec(pathname ?? "");
  return m ? m[1].toLowerCase() : null;
}
