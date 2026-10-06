/**
 * P06 M6F runtime halt: an operator can stop all new production executions instantly, without a redeploy, by creating
 * ~/.parallax/executions/HALT on the execution host (rollback step 1). It can only turn execution OFF: nothing here
 * can turn it on, and an environment variable may add a second halt location but never removes the default one.
 * Server only (filesystem).
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_HALT_FILE = join(/*turbopackIgnore: true*/ homedir(), ".parallax", "executions", "HALT");

export function dispatchHalted(env: Record<string, string | undefined> = process.env): boolean {
  const extra = env.PARALLAX_EXECUTION_HALT_FILE;
  return existsSync(/*turbopackIgnore: true*/ DEFAULT_HALT_FILE) || (!!extra && existsSync(/*turbopackIgnore: true*/ extra));
}
