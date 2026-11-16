import { describe, expect, it } from "vitest";
import { verifyRelayIdentity } from "./relay-identity-check";

/**
 * CC-RECOVERY-22 Phase 3 adversarial coverage: a successful claim only proves "at most one
 * dispatcher owns this id right now." These tests pin that a claim is NOT enough by itself —
 * the claimed row's channel and content must also match what this request actually named.
 */

describe("verifyRelayIdentity", () => {
  it("accepts a claim whose row matches the request exactly", () => {
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "hello there" },
      { channelId: "chan-1", message: "hello there" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("refuses a message id that belongs to a different channel", () => {
    // The CC-RECOVERY-22 vector: "message ID belonging to another owner/channel". A caller
    // claimed a real, existing message id, but it lives in a different channel than this
    // request named.
    const result = verifyRelayIdentity(
      { channel_id: "chan-OTHER", content: "hello there" },
      { channelId: "chan-1", message: "hello there" },
    );
    expect(result).toEqual({
      ok: false,
      reason: "channel_mismatch",
      detail: expect.stringContaining("different channel"),
    });
  });

  it("refuses when the text to dispatch differs from what was actually persisted", () => {
    // The CC-RECOVERY-22 vector: "message content differing from the persisted message". A
    // caller claimed a real message id in the right channel, but is trying to dispatch
    // different text than what is actually stored there — exactly the substitution this check
    // exists to catch, regardless of how the id was obtained.
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "the real persisted text" },
      { channelId: "chan-1", message: "attacker-controlled substituted text" },
    );
    expect(result).toEqual({
      ok: false,
      reason: "content_mismatch",
      detail: expect.stringContaining("does not match"),
    });
  });

  it("refuses when the claimed row cannot be found, rather than guessing it's fine", () => {
    const result = verifyRelayIdentity(null, { channelId: "chan-1", message: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("row_not_found");
  });

  it("tolerates surrounding whitespace, since persistence and dispatch may trim differently", () => {
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "  hello there  " },
      { channelId: "chan-1", message: "hello there" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("does not refuse on channelId when the request omits it (not every dispatcher sends one)", () => {
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "hello there" },
      { channelId: undefined, message: "hello there" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("still checks content even when channelId is omitted", () => {
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "the real text" },
      { channelId: undefined, message: "substituted text" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("content_mismatch");
  });

  it("does not refuse on channel when the claimed row's own channel_id is null (legacy/odd rows)", () => {
    // A null channel_id on the row is a data-shape question for something else to police; this
    // check's job is narrower (don't let a REAL mismatch through), so it only compares when both
    // sides are actual strings.
    const result = verifyRelayIdentity(
      { channel_id: null, content: "hello there" },
      { channelId: "chan-1", message: "hello there" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("checks content exactness for a caller that sends the same text both times (legacy console)", () => {
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "[Image: photo.png]" },
      { channelId: "chan-1", message: "[Image: photo.png]" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts the main chat page's real attachment shape: persisted text + an appended attachments block", () => {
    // Independent review found the first version of this check refused EVERY attachment send
    // from the main chat page: it persists just the typed text but dispatches that text with
    // "\n\n[Attachments]\n- name: url" appended, by design, so the model can see what was
    // attached. A caller that does this is not substituting content — it's the one real,
    // documented shape this check must not misclassify as an attack.
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "check this out" },
      {
        channelId: "chan-1",
        message: "check this out\n\n[Attachments]\n- photo.png: https://example.com/photo.png",
      },
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts an attachment-only send where the server persisted the '(attachment)' placeholder", () => {
    // When no text was typed, the persistence route stores the literal placeholder
    // "(attachment)" (see conversations/[id]/messages/route.ts) while the dispatched text is
    // just the attachments block with no textual relation to that placeholder at all.
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "(attachment)" },
      { channelId: "chan-1", message: "[Attachments]\n- photo.png: https://example.com/photo.png" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("still refuses genuinely substituted content even when it superficially looks attachment-like", () => {
    // The relaxation above must not become "anything goes once there's a bracketed marker
    // somewhere" — it only tolerates the exact persisted-text-plus-attachments-block shape.
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "the real persisted text" },
      { channelId: "chan-1", message: "completely different text\n\n[Attachments]\n- x: y" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("content_mismatch");
  });

  it("still refuses plain substituted text with no attachments marker at all", () => {
    const result = verifyRelayIdentity(
      { channel_id: "chan-1", content: "(attachment)" },
      { channelId: "chan-1", message: "attacker-controlled text with no marker" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("content_mismatch");
  });
});
