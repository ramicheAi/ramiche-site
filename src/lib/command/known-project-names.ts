/**
 * P06: the words that name a registered project, for the router's safety-relevant precedence decision only (whether
 * "latest"/"current" research language is overridden by real repository-analysis evidence).
 *
 * This is NOT a second source of truth: it must hold exactly the alias words REPO_REGISTRY carries in
 * src/lib/execution/projects.ts. It is a separate pure-data file, not an import of that module, because the router
 * (router.ts) is deliberately pure: it may import no executor, provider, job, telemetry or database code (enforced by
 * router.test.ts). A drift-guard test (known-project-names.test.ts) fails if this list and REPO_REGISTRY's aliases
 * ever diverge, so this can never go stale without being caught.
 */
export const KNOWN_PROJECT_ALIASES: readonly string[] = [
  "mettle", "apex athlete",
  "galactik antics", "galactik",
  "parallax os", "command center", "cockpit", "ramiche-site", "ramiche site",
  "parallax site", "parallax website", "parallax-site", "parallaxvinc.com", "public site", "marketing site",
  "ramiche os", "ramiche-os",
];
