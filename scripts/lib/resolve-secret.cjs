// CommonJS twin of resolve-secret.mjs, for the one host-side script (sync-pipeline.js) that
// still uses require() rather than ESM import. Same logic, kept in sync deliberately rather than
// generated, since it is five lines and a build step to share one file across both module systems
// would be more moving parts than the duplication it avoids. See resolve-secret.mjs for the design
// rationale (CC-RECOVERY-19/20: move secrets out of a world-readable launchd plist).
function resolveSecret(env, fs, fileVarName, directVarName) {
  const filePath = env[fileVarName];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  return (env[directVarName] || "").trim();
}

module.exports = { resolveSecret };
