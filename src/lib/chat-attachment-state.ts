/**
 * Attachment sendability.
 *
 * A file is not "attached" because the operator picked it. It is attached when it has been stored and
 * has a URL. Before this module existed the composer treated the three cases identically: a failed
 * upload still dispatched a message whose persisted `attachments` array was empty, while the screen
 * showed the filename and a paperclip. That is a false statement to the operator, and it is the
 * defect this file exists to make impossible and testable.
 *
 * The states:
 *   uploading  the upload is in flight; nothing may be sent yet
 *   ready      stored, has a remoteUrl; this is the only sendable state
 *   failed     not stored; the operator must retry it, remove it, or explicitly send without it
 */

export type AttachmentStatus = "uploading" | "ready" | "failed";

export interface ComposerAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  file?: File;
  status: AttachmentStatus;
  /** Present only when status is "ready". */
  remoteUrl?: string;
  error?: string;
}

export type Sendability =
  | { ok: true; sendable: Array<{ url: string; name: string; type: string }> }
  | { ok: false; reason: "uploading" | "failed"; message: string };

/**
 * Decide whether a message may be dispatched with these attachments.
 *
 * Refuses while anything is uploading (a half-second later the same click would have worked), and
 * refuses when anything failed to store. It never silently drops an attachment: dropping is the
 * operator's decision, taken explicitly through the text-only path.
 */
export function attachmentSendability(list: ComposerAttachment[]): Sendability {
  if (list.some((a) => a.status === "uploading")) {
    return {
      ok: false,
      reason: "uploading",
      message: "Wait for the attachment to finish uploading before sending.",
    };
  }

  const missing = list.filter((a) => a.status === "failed" || (a.status === "ready" && !a.remoteUrl));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "failed",
      message: `${missing.length} attachment${missing.length === 1 ? "" : "s"} could not be stored. Retry it, remove it, or send the message without attachments.`,
    };
  }

  return {
    ok: true,
    sendable: list
      .filter((a) => a.status === "ready" && a.remoteUrl)
      .map((a) => ({ url: a.remoteUrl as string, name: a.name, type: a.type })),
  };
}

/** The label a chip shows for its state. Kept here so the UI and the tests agree on the words. */
export function attachmentStatusLabel(status: AttachmentStatus): string {
  return status === "uploading" ? "Uploading…" : status === "failed" ? "Not stored" : "Stored";
}
