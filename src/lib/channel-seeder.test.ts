/**
 * The channel seeder must satisfy the DM identity invariant.
 *
 * `channels_dm_has_agent` requires every type='dm' row to name its agent, so the seeder that creates the
 * original 20 conversations has to set `agent_id` explicitly. It reads those uuids from the canonical
 * registry rather than carrying its own copy, and it never infers the agent from the generated channel id.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
// The seeder is a plain .mjs script at the repo root; imported here for its pure builder.
import { buildSeedRows } from "../../create-channels.mjs";
import { agentDmUuidMap } from "./agent-registry-core";

type Row = { id: string; type: string; slug: string; agent_id: string | null; tenant_id: string; is_private: boolean };
const { dms, groups, all } = buildSeedRows() as { dms: Row[]; groups: Row[]; all: Row[] };
const CANON = agentDmUuidMap();

describe("channel seeder: DM rows carry canonical agent identity", () => {
  it("seeds one DM per registry agent, and only those", () => {
    expect(dms).toHaveLength(Object.keys(CANON).length);
    expect(dms).toHaveLength(20);
    expect(new Set(dms.map((d) => d.id)).size).toBe(dms.length);
  });

  it("every DM row sets agent_id to that agent's canonical registry uuid", () => {
    for (const [agentId, dmUuid] of Object.entries(CANON)) {
      const row = dms.find((d) => d.slug === `dm-${agentId}`);
      expect(row, agentId).toBeDefined();
      expect(row!.agent_id, agentId).toBe(dmUuid);
      expect(row!.type).toBe("dm");
    }
  });

  it("no DM row is missing agent_id, so none can be rejected by channels_dm_has_agent", () => {
    for (const d of dms) {
      expect(typeof d.agent_id, d.slug).toBe("string");
      expect(d.agent_id, d.slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  it("non-DM rows leave agent_id null", () => {
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.type, g.slug).not.toBe("dm");
      expect(g.agent_id, g.slug).toBeNull();
    }
  });

  it("every row satisfies the constraint predicate exactly as the database states it", () => {
    const ok = (r: Row) => (r.type === "dm" && r.agent_id !== null) || (r.type !== "dm" && r.agent_id === null);
    for (const r of all) expect(ok(r), `${r.slug} (${r.type})`).toBe(true);
  });

  it("the legacy rows keep their original ids; id === agent_id is legacy compatibility, not the model", () => {
    // These 20 historical conversations must keep the ids production already has.
    for (const [agentId, dmUuid] of Object.entries(CANON)) {
      const row = dms.find((d) => d.slug === `dm-${agentId}`)!;
      expect(row.id).toBe(dmUuid);
      expect(row.id).toMatch(/^aa0000[0-2][0-9]-0000-0000-0000-000000000000$/);
    }
  });

  it("introduces no second source of truth: the uuids come from the registry, not a literal map", () => {
    const src = readFileSync(join(process.cwd(), "create-channels.mjs"), "utf8");
    expect(src).toContain("agentDmUuidMap");
    expect(src).toContain("agent-registry-core");
    // not one agent uuid is written out by hand any more
    expect(src).not.toMatch(/aa0000[0-9]{2}-0000-0000-0000-000000000000/);
    // and the agent list is no longer duplicated either
    expect(src).not.toMatch(/'atlas'\s*,\s*'triage'/);
    // identity is never derived from the generated id
    expect(src).not.toMatch(/agent_id:\s*(row\.)?id\b/);
  });

  it("importing the seeder performs no insert (side-effect free for tests)", () => {
    const src = readFileSync(join(process.cwd(), "create-channels.mjs"), "utf8");
    expect(src).toContain("import.meta.url === `file://${process.argv[1]}`");
  });
});
