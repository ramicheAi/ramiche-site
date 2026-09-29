import { describe, it, expect } from "vitest";
import { humanizeCopy, humanizeDeep } from "./humanize";

describe("humanizeCopy", () => {
  it("removes em/en dashes (the #1 AI tell)", () => {
    expect(humanizeCopy("211 reviews, mostly positive — that is social proof")).toBe(
      "211 reviews, mostly positive, that is social proof",
    );
    expect(humanizeCopy("brand vs local engine – build it")).not.toContain("–");
  });

  it("fixes the placeholder bracket greeting", () => {
    expect(humanizeCopy("Hi (Crunch Oakland Park team),")).toBe("Hi Crunch Oakland Park team,");
  });

  it("strips square-bracket merge fields", () => {
    expect(humanizeCopy("call me at [your number] today")).toBe("call me at today");
  });

  it("converts semicolons to commas", () => {
    expect(humanizeCopy("fast; done-for-you; cheap")).toBe("fast, done-for-you, cheap");
  });

  it("straightens curly quotes", () => {
    expect(humanizeCopy("reply “show me”")).toBe('reply "show me"');
  });

  it("leaves clean human text untouched", () => {
    const clean = "Hey, saw your shop has no website. Want me to send a quick mockup?";
    expect(humanizeCopy(clean)).toBe(clean);
  });

  it("has no AI dashes left after a full pass", () => {
    const out = humanizeCopy("We do hyper-local lead gen — Google Business Profile — that wins searches");
    expect(out).not.toMatch(/[—–―]/);
  });
});

describe("humanizeDeep", () => {
  it("cleans every string in a kit object", () => {
    const kit = {
      coldEmail: { subject: "You have 211 reviews — no way to use them", body: "Hi (Gym team)," },
      followUps: [{ when: "Day 3", message: "circling back; reply 'show me'" }],
    };
    const out = humanizeDeep(kit);
    expect(out.coldEmail.subject).not.toContain("—");
    expect(out.coldEmail.body).toBe("Hi Gym team,");
    expect(out.followUps[0].message).toBe("circling back, reply 'show me'");
  });
});
