import { describe, it, expect } from "vitest";
import { parseMentions, resolveChatTargets } from "./chat-routing";

describe("chat-routing", () => {
  it("parseMentions extracts known agent ids", () => {
    expect(parseMentions("hey @shuri and @atlas please review")).toEqual(["shuri", "atlas"]);
  });

  it("parseMentions ignores unknown handles", () => {
    expect(parseMentions("@notanagent @vee")).toEqual(["vee"]);
  });

  it("resolveChatTargets prefers mentions over channel members", () => {
    expect(
      resolveChatTargets({
        mentionedAgents: ["mercury"],
        channelMembers: ["atlas", "widow"],
      })
    ).toEqual(["mercury"]);
  });

  it("resolveChatTargets uses channel members when no mentions", () => {
    expect(resolveChatTargets({ channelMembers: ["atlas", "vee"] })).toEqual(["atlas", "vee"]);
  });

  it("resolveChatTargets falls back to atlas", () => {
    expect(resolveChatTargets({})).toEqual(["atlas"]);
  });
});

/**
 * CC-ORG-INTELLIGENCE-01 / CC-ORG-FOUNDATION-02 Phase B: bootstrapMode.
 *
 * Every real channel today is bootstrap mode (no server-verified
 * membership exists yet), so `bootstrapMode` defaults to `true` and must
 * reproduce today's behavior byte-for-byte, with or without the client
 * sending it at all. Only an explicit `bootstrapMode: false` — which no
 * real channel sends yet — takes the fail-closed branch.
 */
describe("chat-routing — bootstrapMode (CC-ORG-FOUNDATION-02 Phase B)", () => {
  it("bootstrapMode omitted behaves exactly like today (regression: mentions win)", () => {
    expect(
      resolveChatTargets({
        mentionedAgents: ["mercury"],
        channelMembers: ["atlas", "widow"],
      })
    ).toEqual(["mercury"]);
  });

  it("bootstrapMode: true behaves exactly like today (regression: mentions win)", () => {
    expect(
      resolveChatTargets({
        mentionedAgents: ["mercury"],
        channelMembers: ["atlas", "widow"],
        bootstrapMode: true,
      })
    ).toEqual(["mercury"]);
  });

  it("bootstrapMode omitted still trusts channelMembers directly (regression)", () => {
    expect(resolveChatTargets({ channelMembers: ["atlas", "vee"] })).toEqual(["atlas", "vee"]);
  });

  it("bootstrapMode: true still trusts channelMembers directly (regression)", () => {
    expect(resolveChatTargets({ channelMembers: ["atlas", "vee"], bootstrapMode: true })).toEqual([
      "atlas",
      "vee",
    ]);
  });

  it("bootstrapMode omitted still falls back to atlas with nothing given (regression)", () => {
    expect(resolveChatTargets({ bootstrapMode: true })).toEqual(["atlas"]);
  });

  it("bootstrapMode: false does NOT fall through to client-submitted channelMembers", () => {
    expect(
      resolveChatTargets({
        bootstrapMode: false,
        channelMembers: ["atlas", "vee"],
      })
    ).toEqual([]);
  });

  it("bootstrapMode: false with no resolvedMembers returns the documented empty fallback", () => {
    expect(resolveChatTargets({ bootstrapMode: false })).toEqual([]);
  });

  it("bootstrapMode: false uses resolvedMembers (server-verified) when given", () => {
    expect(
      resolveChatTargets({
        bootstrapMode: false,
        channelMembers: ["ignored-client-value"],
        resolvedMembers: ["atlas", "widow"],
      })
    ).toEqual(["atlas", "widow"]);
  });

  it("bootstrapMode: false still lets explicit mentions win (highest-priority signal)", () => {
    expect(
      resolveChatTargets({
        bootstrapMode: false,
        mentionedAgents: ["mercury"],
        channelMembers: ["atlas", "widow"],
      })
    ).toEqual(["mercury"]);
  });

  it("bootstrapMode: false still lets agentName (DM) win over channel membership", () => {
    expect(
      resolveChatTargets({
        bootstrapMode: false,
        agentName: "shuri",
        channelMembers: ["atlas", "widow"],
      })
    ).toEqual(["shuri"]);
  });
});
