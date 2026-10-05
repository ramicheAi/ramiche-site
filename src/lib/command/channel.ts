/**
 * P06 M5: the Universal Command channel has a deterministic id per tenant (a name-based UUID, RFC 4122 version 5), so
 * any server code can exclude command records from chat surfaces with one equality filter and no lookup.
 */
import { createHash } from "node:crypto";
import { COMMAND_CHANNEL_SLUG } from "./types";

/** A fixed namespace for Parallax cockpit channel ids. */
const NAMESPACE = "6f6b7a4e-2c1d-4b8e-9a3f-5d2e1c0b9a87";

export function commandChannelId(tenantId: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(`${tenantId.toLowerCase()}/${COMMAND_CHANNEL_SLUG}`, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
