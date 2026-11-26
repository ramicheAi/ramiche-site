import { describe, it, expect } from "vitest";
import { findDuplicateChannelNames, type ChannelNameRef } from "./channel-authz";

/**
 * Fixture built from a direct, independent SELECT against the live
 * command-center-hq Supabase project (qkbkfsjkysdsfmhgfdoc.channels),
 * verified 2026-11-08 during CC-ORG-FOUNDATION-02 Phase B. It is a superset
 * of the pairs named in the task brief: that brief named 6 March/May
 * duplicate pairs (Security, Finance, Sales, Strategy, Legal, Wellness);
 * the live table actually holds 8 — Content Team and Creative Team are
 * duplicated the same way and were missing from the brief's list. Both are
 * real current channels (DEFAULT_CHANNELS uses `cccccccc-...` and
 * `ffffffff-...` respectively), so this fixture includes them.
 *
 * Deliberately NOT included here: a 9th live duplicate, "DM: Triage"
 * (`aa000002-...` vs a `4a6cfad8-...` row created 2026-10-03). That one is a
 * DM channel, not a team channel, and follows a different pattern (a recent
 * duplicate insert, not a March-era orphan vs a May-era real row) — it is
 * out of this mission's scope and is reported separately rather than folded
 * into this fixture.
 */
const LIVE_CHANNELS_FIXTURE: ChannelNameRef[] = [
  // Non-duplicated rows, included to prove no false positives.
  { id: "22222222-2222-2222-2222-222222222222", name: "#general" },
  { id: "33333333-3333-3333-3333-333333333333", name: "#mettle" },
  { id: "55555555-5555-5555-5555-555555555555", name: "Verified Agents" },
  { id: "66666666-6666-6666-6666-666666666666", name: "Dev" },
  { id: "af58dead-0000-0000-0000-000000000000", name: "Universal Command (shadow)" },
  { id: "b1b76940-0000-0000-0000-000000000000", name: "Phase A Test" },
  // March-era orphan (bb0000xx) vs May-era real team channel — the 8 pairs.
  { id: "bb000001-0000-0000-0000-000000000000", name: "Security Team" },
  { id: "77777777-7777-7777-7777-777777777777", name: "Security Team" },
  { id: "bb000002-0000-0000-0000-000000000000", name: "Finance Team" },
  { id: "88888888-8888-8888-8888-888888888888", name: "Finance Team" },
  { id: "bb000003-0000-0000-0000-000000000000", name: "Sales Team" },
  { id: "99999999-9999-9999-9999-999999999999", name: "Sales Team" },
  { id: "bb000004-0000-0000-0000-000000000000", name: "Strategy Team" },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Strategy Team" },
  { id: "bb000005-0000-0000-0000-000000000000", name: "Legal Team" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Legal Team" },
  { id: "bb000006-0000-0000-0000-000000000000", name: "Content Team" },
  { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", name: "Content Team" },
  { id: "bb000007-0000-0000-0000-000000000000", name: "Wellness Team" },
  { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", name: "Wellness Team" },
  { id: "bb000008-0000-0000-0000-000000000000", name: "Creative Team" },
  { id: "ffffffff-ffff-ffff-ffff-ffffffffffff", name: "Creative Team" },
];

describe("findDuplicateChannelNames", () => {
  it("finds exactly the 8 verified live duplicate pairs and nothing else", () => {
    const groups = findDuplicateChannelNames(LIVE_CHANNELS_FIXTURE);
    expect(groups.map((g) => g.name)).toEqual([
      "Content Team",
      "Creative Team",
      "Finance Team",
      "Legal Team",
      "Sales Team",
      "Security Team",
      "Strategy Team",
      "Wellness Team",
    ]);
    expect(groups).toHaveLength(8);
    for (const g of groups) expect(g.ids).toHaveLength(2);
  });

  it("pairs each March-era orphan id with its May-era real-channel id", () => {
    const groups = findDuplicateChannelNames(LIVE_CHANNELS_FIXTURE);
    const securityTeam = groups.find((g) => g.name === "Security Team");
    expect(securityTeam?.ids).toEqual([
      "bb000001-0000-0000-0000-000000000000",
      "77777777-7777-7777-7777-777777777777",
    ]);
  });

  it("returns no groups for a list with no duplicate names", () => {
    expect(
      findDuplicateChannelNames([
        { id: "1", name: "a" },
        { id: "2", name: "b" },
      ])
    ).toEqual([]);
  });

  it("returns an empty list for an empty input", () => {
    expect(findDuplicateChannelNames([])).toEqual([]);
  });

  it("is sensitive to case and exact-string equality (no fuzzy matching)", () => {
    expect(
      findDuplicateChannelNames([
        { id: "1", name: "Security Team" },
        { id: "2", name: "security team" },
      ])
    ).toEqual([]);
  });

  it("groups 3+ rows sharing a name into one group", () => {
    const groups = findDuplicateChannelNames([
      { id: "1", name: "x" },
      { id: "2", name: "x" },
      { id: "3", name: "x" },
    ]);
    expect(groups).toEqual([{ name: "x", ids: ["1", "2", "3"] }]);
  });
});
