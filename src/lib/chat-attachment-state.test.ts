import { describe, expect, it } from "vitest";

import { attachmentSendability, attachmentStatusLabel, type ComposerAttachment } from "./chat-attachment-state";

const base = (over: Partial<ComposerAttachment> = {}): ComposerAttachment => ({
  id: "a1",
  name: "e2e.png",
  size: "1.0KB",
  type: "image",
  url: "blob:preview",
  status: "ready",
  remoteUrl: "https://storage.example/chat-attachments/a1.png",
  ...over,
});

describe("attachment sendability", () => {
  it("sends a stored attachment, and reports the stored URL rather than the preview", () => {
    const out = attachmentSendability([base()]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.sendable).toHaveLength(1);
      expect(out.sendable[0].url).toBe("https://storage.example/chat-attachments/a1.png");
      // The blob preview must never reach persistence: it is meaningless outside this tab.
      expect(out.sendable[0].url.startsWith("blob:")).toBe(false);
    }
  });

  it("blocks while an upload is still in flight", () => {
    const out = attachmentSendability([base({ status: "uploading", remoteUrl: undefined })]);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("uploading");
      expect(out.message).toMatch(/finish uploading/i);
    }
  });

  it("blocks a failed upload instead of silently sending without it", () => {
    // This is the defect: the message used to go out with an empty attachments array while the UI
    // showed the file. It must refuse, and say what the operator can do.
    const out = attachmentSendability([base({ status: "failed", remoteUrl: undefined, error: "HTTP 500" })]);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("failed");
      expect(out.message).toMatch(/retry/i);
      expect(out.message).toMatch(/without attachments/i);
    }
  });

  it("blocks a 'ready' attachment that somehow has no stored URL", () => {
    const out = attachmentSendability([base({ remoteUrl: undefined })]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("failed");
  });

  it("allows the send again after a retry succeeds", () => {
    const failed = base({ status: "failed", remoteUrl: undefined });
    expect(attachmentSendability([failed]).ok).toBe(false);

    // Retry sets it back to uploading, then to ready with a URL.
    const uploading = { ...failed, status: "uploading" as const };
    expect(attachmentSendability([uploading]).ok).toBe(false);

    const ready = { ...failed, status: "ready" as const, remoteUrl: "https://storage.example/a1.png" };
    const out = attachmentSendability([ready]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.sendable[0].url).toBe("https://storage.example/a1.png");
  });

  it("allows the send after the failed attachment is removed", () => {
    // Cancellation is the operator removing the chip, which leaves an empty list.
    const out = attachmentSendability([]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.sendable).toEqual([]);
  });

  it("refuses the whole send if one of several failed, and names the count", () => {
    const out = attachmentSendability([
      base({ id: "a1" }),
      base({ id: "a2", status: "failed", remoteUrl: undefined }),
      base({ id: "a3", status: "failed", remoteUrl: undefined }),
    ]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toContain("2 attachments");
  });

  it("uses one set of words for the chip labels", () => {
    expect(attachmentStatusLabel("uploading")).toBe("Uploading…");
    expect(attachmentStatusLabel("ready")).toBe("Stored");
    // "Not stored", never "Failed", because the operator's question is whether the file is safe.
    expect(attachmentStatusLabel("failed")).toBe("Not stored");
  });
});
