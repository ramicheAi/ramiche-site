import { homedir } from "os";
import { join } from "path";

/** Expand leading `~/` for server-side tool paths. */
export function expandVoicePath(p: string): string {
  if (p.startsWith("~/")) {
    return join(homedir(), p.slice(2));
  }
  return p;
}
