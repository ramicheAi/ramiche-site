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
