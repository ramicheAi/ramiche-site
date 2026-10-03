/**
 * P06 M2: link target resolution. A mission link must point at something real, not an arbitrary string.
 *
 *   resolved     the record was found in this tenant (database targets) or in the server's own registry (projects).
 *   format_only  the target lives outside anything this server reads (external URLs, the iMac YOLO build folders,
 *                Firestore tasks, GitHub). Its id is held to a strict canonical format here and recorded as
 *                unverified; live resolution is M3 work. These are never accepted as evidence (see EVIDENCE_TYPES).
 *
 * Whatever is stored is the canonical form returned here, never the raw input.
 */
import { PROJECTS } from "@/app/command-center/shared-projects";
import type { DbTargetType, MissionStore } from "./store";
import type { TargetType } from "./types";
import { cleanUrl, gitBranch, isUuid } from "./validate";

export type Resolution = "resolved" | "format_only";
export type ResolvedTarget = { targetType: TargetType; targetId: string; targetIndex: number | null; resolution: Resolution };
export type ResolveResult =
  | { ok: true; target: ResolvedTarget }
  | { ok: false; status: 404 | 422 | 502; code: string; message: string };

const DB_TYPES: Record<string, DbTargetType> = {
  job: "job", synthesis: "synthesis", synthesis_action: "synthesis", pipeline_gate: "pipeline_gate",
  pipeline_lead: "pipeline_lead", chat_channel: "chat_channel", chat_message: "chat_message", mission: "mission",
};

/**
 * Evidence must be a record the server itself found in this tenant's database. Anything the server has not looked at
 * cannot prove a success criterion: a URL (never fetched), a project slug (a static registry name, not an outcome) and
 * every format-only pointer (branch, commit, PR, build folder, task id). Those may still be linked as context, source
 * or deliverable; live verification of them is M3 work.
 */
export const EVIDENCE_TYPES: ReadonlySet<TargetType> = new Set<TargetType>([
  "job", "synthesis", "synthesis_action", "pipeline_gate", "pipeline_lead", "chat_channel", "chat_message", "mission",
]);

const invalid = (message: string): ResolveResult => ({ ok: false, status: 422, code: "invalid_target", message });
const missing = (message: string): ResolveResult => ({ ok: false, status: 404, code: "target_not_found", message });

export async function resolveTarget(
  store: MissionStore,
  tenantId: string,
  type: TargetType,
  rawId: unknown,
  rawIndex: unknown,
): Promise<ResolveResult> {
  const hasIndex = rawIndex !== undefined && rawIndex !== null;
  if (type !== "synthesis_action" && hasIndex) return invalid("targetIndex is only valid for synthesis_action");
  if (typeof rawId !== "string") return invalid("targetId must be a string");
  const id = rawId.trim();

  const dbType = DB_TYPES[type];
  if (dbType) {
    if (!isUuid(id)) return invalid(`${type} targetId must be a uuid`);
    const canonical = id.toLowerCase();
    let index: number | null = null;
    if (type === "synthesis_action") {
      if (typeof rawIndex !== "number" || !Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex > 999) {
        return invalid("synthesis_action needs an integer targetIndex 0..999");
      }
      index = rawIndex;
    }
    const found = await store.lookupTarget(tenantId, dbType, canonical);
    if (!found.ok) return { ok: false, status: 502, code: "lookup_failed", message: "target lookup failed" };
    if (!found.data) return missing(`${type} ${canonical} does not exist`);
    if (type === "synthesis_action" && found.data.type === "synthesis" && (index as number) >= found.data.actionCount) {
      return missing(`synthesis ${canonical} has no action ${index}`);
    }
    return { ok: true, target: { targetType: type, targetId: canonical, targetIndex: index, resolution: "resolved" } };
  }

  switch (type) {
    case "project": {
      const slug = id.toLowerCase();
      if (!PROJECTS.some((p) => p.slug === slug)) return missing(`project ${slug.slice(0, 64)} is not a known project`);
      return { ok: true, target: { targetType: type, targetId: slug, targetIndex: null, resolution: "resolved" } };
    }
    case "url": {
      const u = cleanUrl(id);
      if (!u.ok) return invalid(u.message);
      // Cleaned and checked, but never fetched: the server has not seen what is there.
      return { ok: true, target: { targetType: type, targetId: u.value, targetIndex: null, resolution: "format_only" } };
    }
    case "yolo_build":
      // Build folders are named <date>-<agent>-<slug> on the iMac workspace.
      if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,120}$/.test(id)) return invalid("yolo_build must be a build folder name like 2026-10-03-nova-thing");
      return { ok: true, target: { targetType: type, targetId: id, targetIndex: null, resolution: "format_only" } };
    case "firestore_task":
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return invalid("firestore_task must be a Firestore document id");
      return { ok: true, target: { targetType: type, targetId: id, targetIndex: null, resolution: "format_only" } };
    case "git_branch":
      if (!gitBranch(id)) return invalid("git_branch is not a valid branch name");
      return { ok: true, target: { targetType: type, targetId: id, targetIndex: null, resolution: "format_only" } };
    case "git_commit":
      // Full sha only: an abbreviated sha is ambiguous over time.
      if (!/^[0-9a-f]{40}$/i.test(id)) return invalid("git_commit must be a full 40-character sha");
      return { ok: true, target: { targetType: type, targetId: id.toLowerCase(), targetIndex: null, resolution: "format_only" } };
    case "pull_request": {
      // GitHub owner: 1..39 alphanumerics or single inner hyphens (no leading, trailing or doubled hyphen).
      // Repository: 1..100 of [A-Za-z0-9._-], never "." or "..".
      const m = /^([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/([A-Za-z0-9._-]{1,100})#([1-9][0-9]{0,8})$/.exec(id);
      if (!m || m[2] === "." || m[2] === "..") return invalid("pull_request must be owner/repo#number with a valid GitHub owner and repository");
      return { ok: true, target: { targetType: type, targetId: `${m[1]}/${m[2]}#${m[3]}`, targetIndex: null, resolution: "format_only" } };
    }
  }
  return invalid(`unsupported target type ${type}`);
}
