/**
 * CC-ORG-INTELLIGENCE-01 / CC-ORG-FOUNDATION-02 Phase B.
 *
 * Pure helpers for the channel-authorization design work. Nothing here is
 * wired into a request path yet — this module exists so the duplicate-name
 * detector (found by the independent audit against the live `channels`
 * table) is a reusable, tested function instead of a one-off SQL query, and
 * so future `channel_principal` consumers have a typed shape to import that
 * matches the `channel_policy` schema the ramiche-os lane is adding.
 *
 * See docs/CC-ORG-AUTHORIZATION-DESIGN-01.md for the full writeup.
 */

export type ChannelPrincipalRole = "owner" | "member" | "reviewer" | "observer" | "bot";

export type ChannelPrincipalPermission =
  | "read"
  | "discuss"
  | "propose"
  | "execute"
  | "approve"
  | "review"
  | "administer";

/**
 * Mirrors the shape of a `channel_policy` record from ramiche-os's
 * `schemas/v1/channel_policy.schema.json` (conceptually — field names are
 * kept aligned on purpose so the two repos don't drift). Not persisted by
 * this repo; this type exists for documentation and future consumers.
 */
export interface ChannelPrincipal {
  principal_id: string;
  role: ChannelPrincipalRole;
  permissions: ChannelPrincipalPermission[];
  valid_from: string;
  valid_until: string | null;
}

export interface ChannelNameRef {
  id: string;
  name: string;
}

export interface DuplicateChannelNameGroup {
  name: string;
  ids: string[];
}

/**
 * Given a flat list of `{id, name}` channel rows, find every exact-name
 * duplicate group (two or more rows sharing the same `name`, case- and
 * whitespace-sensitive — the live anomaly this was built for is an exact
 * literal-string duplicate, not a near-miss).
 *
 * Returns groups sorted by name for deterministic output; `ids` preserves
 * input order within the group.
 */
export function findDuplicateChannelNames(channels: ChannelNameRef[]): DuplicateChannelNameGroup[] {
  const byName = new Map<string, string[]>();
  for (const { id, name } of channels) {
    const existing = byName.get(name);
    if (existing) existing.push(id);
    else byName.set(name, [id]);
  }
  const groups: DuplicateChannelNameGroup[] = [];
  for (const [name, ids] of byName) {
    if (ids.length > 1) groups.push({ name, ids });
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}
