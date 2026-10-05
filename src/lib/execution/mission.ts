/**
 * P06 M6: when an execution should become (or join) a Mission. Not every command does: simple work is
 * command -> execution -> result. A Mission is suggested only when persistence adds value (the router recommended one,
 * or the work is not finished and needs further approved steps). The executor never creates or edits a Mission: the
 * founder does, through the existing Mission API, and the execution's jobs row can be linked to it as evidence.
 */
import type { ExecutionResult } from "./contract";

export type MissionSuggestion = { suggest: false } | { suggest: true; reason: string; attachTo: string | null };

export function missionSuggestion(input: { missionId: string | null; missionRecommended: boolean; result: ExecutionResult }): MissionSuggestion {
  if (input.missionId) return { suggest: true, reason: "Link this result to its Mission as evidence.", attachTo: input.missionId };
  if (input.result.status !== "succeeded") return { suggest: false };
  if (input.missionRecommended) return { suggest: true, reason: "This is multi-step work worth tracking.", attachTo: null };
  if (input.result.nextStep) return { suggest: true, reason: `More approved steps follow (${input.result.nextStep.action.toLowerCase()}).`, attachTo: null };
  return { suggest: false };
}
