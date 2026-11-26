// CC-RECOVERY-19: moves secrets like BRIDGE_API_SECRET out of a launchd plist's
// EnvironmentVariables block and into a permission-restricted file instead.
//
// A plist is world-readable by default (644) regardless of how carefully anything else on the
// host is locked down; embedding a secret value directly in it exposes that value to any local
// user who can read the file, independent of the actual secret's own strength. A 600-permissioned
// file, read once at process start, does not have that problem.
//
// Resolution order: a *_FILE path, if set and the file exists, wins — read, trimmed, returned.
// Otherwise falls back to the plain env var, so existing callers (and existing deployments that
// have not yet adopted the file-backed path) keep working unchanged.
export function resolveSecret(env, fs, fileVarName, directVarName) {
  const filePath = env[fileVarName];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  return (env[directVarName] || "").trim();
}
