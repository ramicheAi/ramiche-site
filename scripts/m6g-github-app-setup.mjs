#!/usr/bin/env node
/**
 * P06 M6G: create, install and verify the executor's GitHub machine identity ("Parallax Executor", a GitHub App with
 * Contents: read and Metadata: read only). Secrets are written only to a 0600 file in a 0700 directory and are never
 * printed. From there `pvault import-env` takes them into the vault and routes them to the cockpit's env file.
 *
 *   node --experimental-strip-types scripts/m6g-github-app-setup.mjs create
 *       Serves a one-page form on http://127.0.0.1:8719. Open it in a browser signed in to GitHub as ramicheAi and
 *       press "Create GitHub App" on GitHub's page. GitHub sends a one-time code back here; it is exchanged for the
 *       App's id and private key. The client and webhook secrets are discarded (not needed).
 *   (then install the App on ONLY ramicheAi/mettle and ramicheAi/ramiche-site, from the URL `create` prints)
 *   node --experimental-strip-types scripts/m6g-github-app-setup.mjs finish
 *       Finds the single installation on ramicheAi and records its id (`check` then verifies it).
 *   node --experimental-strip-types scripts/m6g-github-app-setup.mjs check [--secrets-file <file>]
 *       The acceptance proof: reads main of each allowed repository through the executor's own code path (no git, no
 *       Keychain, no prompt, bounded), then shows write authority is denied (installation permissions, and GitHub
 *       refusing to mint a write token). Prints only shas, timings and verdicts.
 *
 *   node --experimental-strip-types scripts/m6g-github-app-setup.mjs probe
 *       Only the executor's read path, with whatever configuration exists: bounded, never prompts, fails closed.
 *
 * Exit 0 on success, 1 on a failed check, 2 on bad setup.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync, constants as FS } from "node:fs";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    let target = null;
    if (specifier.startsWith("@/")) target = join(ROOT, "src", specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    if (target) for (const c of [target, `${target}.ts`, join(target, "index.ts")]) {
      if (existsSync(c) && !c.endsWith("/")) { try { if (readFileSync(c)) return { url: pathToFileURL(c).href, format: c.endsWith(".ts") ? "module-typescript" : undefined, shortCircuit: true }; } catch { /* dir */ } }
    }
    return next(specifier, context);
  },
});

const OWNER = "ramicheAi";
const ALLOWED = ["ramicheAi/mettle", "ramicheAi/ramiche-site"];
const DIR = join(homedir(), ".parallax", "github-app");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const ENV_FILE = arg("--secrets-file", join(DIR, "executor.env"));
const mode = process.argv[2];
const gh = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
const fail = (msg, code = 1) => { console.error(`m6g: ${msg}`); process.exit(code); };

function readEnv() {
  if (!existsSync(ENV_FILE)) fail(`no ${ENV_FILE}; run 'create' first`, 2);
  const env = {};
  for (const l of readFileSync(ENV_FILE, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }
  return env;
}
function writeEnv(env) {
  // The secrets file's own directory is created 0700, and the file is written to a fresh temp file opened with O_EXCL
  // and 0600, then renamed into place: never into an existing looser file, never through a symlink.
  const dir = dirname(ENV_FILE);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const tmp = `${ENV_FILE}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  const fd = openSync(tmp, FS.O_CREAT | FS.O_EXCL | FS.O_WRONLY | (FS.O_NOFOLLOW ?? 0), 0o600);
  try { writeSync(fd, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"); } finally { closeSync(fd); }
  try { renameSync(tmp, ENV_FILE); } catch (e) { rmSync(tmp, { force: true }); throw e; }
}
const html = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...gh, ...(init.headers ?? {}) }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  let body = null; try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}

if (mode === "create") {
  const state = randomBytes(16).toString("hex");
  const PORT = 8719;
  const manifest = {
    name: "Parallax Executor ramicheAi", url: "https://github.com/ramicheAi", public: false,
    redirect_url: `http://127.0.0.1:${PORT}/callback`,
    hook_attributes: { url: "https://example.invalid/parallax-executor-no-webhooks", active: false }, default_events: [],
    default_permissions: { contents: "read", metadata: "read" },
  };
  const page = `<!doctype html><meta charset="utf-8"><title>Parallax Executor</title><body style="font:16px system-ui;margin:40px">
<h1>Create the Parallax Executor GitHub App</h1><p>Read-only (Contents, Metadata). No webhooks. Owned by ${OWNER}.</p>
<form action="https://github.com/settings/apps/new?state=${state}" method="post"><input type="hidden" name="manifest" value="${html(JSON.stringify(manifest))}">
<button style="font-size:18px;padding:10px 18px">Continue to GitHub</button></form></body>`;
  let used = false;
  const server = createServer(async (req, res) => {
    // Only this exact local origin (defeats DNS rebinding), and the state is good for one callback only.
    if (req.headers.host !== `127.0.0.1:${PORT}`) { res.writeHead(421); return res.end(); }
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (u.pathname === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(page); }
    if (u.pathname !== "/callback") { res.writeHead(404); return res.end(); }
    if (used || u.searchParams.get("state") !== state || !/^[0-9a-f]{20,64}$/i.test(u.searchParams.get("code") ?? "")) { res.writeHead(400); return res.end("state or code mismatch; nothing stored"); }
    used = true;
    const out = await api(`/app-manifests/${u.searchParams.get("code")}/conversions`, { method: "POST" });
    if (out.status !== 201 || !out.body?.pem || !out.body?.id) { res.writeHead(502); res.end("exchange failed; nothing stored"); server.close(); fail(`manifest exchange failed (HTTP ${out.status})`); }
    const perms = out.body.permissions;
    if (!perms || typeof perms !== "object" || Object.keys(perms).length === 0 || Object.entries(perms).some(([k, v]) => !["contents", "metadata"].includes(k) || v !== "read")) { res.writeHead(500); res.end("App has more than read permissions; not stored"); server.close(); fail("the created App has more than read permissions; delete it on GitHub and retry"); }
    writeEnv({ PARALLAX_GITHUB_APP_ID: String(out.body.id), PARALLAX_GITHUB_APP_PRIVATE_KEY_B64: Buffer.from(out.body.pem).toString("base64") });
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<p>Created. Now install it on ONLY ramicheAi/mettle and ramicheAi/ramiche-site: <a href="https://github.com/apps/${out.body.slug}/installations/new">install</a></p>`);
    console.log(`created App id ${out.body.id} (${out.body.slug}); key stored at ${ENV_FILE} (0600), not printed.`);
    console.log(`next: install on ONLY ${ALLOWED.join(" and ")}: https://github.com/apps/${out.body.slug}/installations/new  then run 'finish'.`);
    server.close();
  });
  server.listen(PORT, "127.0.0.1", () => console.log(`open http://127.0.0.1:${PORT}/ in a browser signed in to GitHub as ${OWNER}`));
} else if (mode === "finish" || mode === "check") {
  const env = readEnv();
  const { appJwt, githubBranchTip, githubAppConfig } = await import("@/lib/execution/github-app");
  const jwtCfg = { appId: env.PARALLAX_GITHUB_APP_ID, privateKeyPem: Buffer.from(env.PARALLAX_GITHUB_APP_PRIVATE_KEY_B64 ?? "", "base64").toString("utf8") };
  const auth = () => ({ Authorization: `Bearer ${appJwt(jwtCfg)}` });
  if (mode === "finish") {
    const list = await api("/app/installations", { headers: auth() });
    if (list.status !== 200) fail(`could not list installations (HTTP ${list.status})`, 2);
    const inst = (list.body ?? []).filter((i) => i.account?.login === OWNER);
    if (inst.length !== 1) fail(`expected exactly one installation on ${OWNER}, found ${inst.length}`, 2);
    env.PARALLAX_GITHUB_APP_INSTALLATION_ID = String(inst[0].id);
    writeEnv(env);
    console.log(`installation ${inst[0].id} on ${OWNER} recorded; run 'check'.`);
  } else {
    const cfg = githubAppConfig(env);
    if (!cfg) fail("incomplete configuration", 2);
    let ok = true;
    const inst = await api(`/app/installations/${cfg.installationId}`, { headers: auth() });
    const perms = inst.body?.permissions ?? {};
    const readOnly = inst.status === 200 && Object.keys(perms).length > 0 && Object.entries(perms).every(([k, v]) => ["contents", "metadata"].includes(k) && v === "read");
    console.log(`installation permissions: ${JSON.stringify(perms)} -> ${readOnly ? "READ ONLY" : "NOT READ ONLY"}; selection: ${inst.body?.repository_selection}`);
    ok &&= readOnly && inst.body?.repository_selection === "selected";
    // Which repositories can it see at all? (a short-lived token, revoked right after)
    const tok = await api(`/app/installations/${cfg.installationId}/access_tokens`, { method: "POST", headers: auth(), body: JSON.stringify({ permissions: { metadata: "read" } }) });
    if (tok.status === 201) {
      const repos = await api("/installation/repositories?per_page=100", { headers: { Authorization: `Bearer ${tok.body.token}` } });
      const names = (repos.body?.repositories ?? []).map((r) => r.full_name);
      const extra = names.filter((n) => !ALLOWED.includes(n));
      console.log(`repositories authorized: ${names.join(", ") || "(none)"}${extra.length ? `  NOT ALLOWED: ${extra.join(", ")}` : ""}`);
      ok &&= extra.length === 0;
      await api("/installation/token", { method: "DELETE", headers: { Authorization: `Bearer ${tok.body.token}` } });
    } else { console.log(`could not list repositories (HTTP ${tok.status})`); ok = false; }
    // Write authority: GitHub must refuse to mint any write token for this installation.
    for (const p of [{ contents: "write" }, { administration: "write" }, { pull_requests: "write" }]) {
      const w = await api(`/app/installations/${cfg.installationId}/access_tokens`, { method: "POST", headers: auth(), body: JSON.stringify({ permissions: p }) });
      if (w.status === 201) { await api("/installation/token", { method: "DELETE", headers: { Authorization: `Bearer ${w.body.token}` } }); }
      console.log(`write token ${JSON.stringify(p)}: ${w.status === 201 ? "GRANTED (FAIL)" : `refused HTTP ${w.status} (DENIED)`}`);
      ok &&= w.status !== 201;
    }
    // The executor's own path: the original failure, now non-interactive and bounded.
    for (const origin of ALLOWED) {
      const t0 = Date.now();
      try {
        const sha = await githubBranchTip(origin, "main", { env });
        console.log(`${origin} main: ${sha ? `${sha.slice(0, 12)} PASS` : "branch missing FAIL"} in ${Date.now() - t0} ms`);
        ok &&= !!sha;
      } catch (e) { console.log(`${origin} main: ${e.message} FAIL in ${Date.now() - t0} ms`); ok = false; }
    }
    console.log(ok ? "M6G CHECK: PASS" : "M6G CHECK: FAIL");
    process.exit(ok ? 0 : 1);
  }
} else if (mode === "probe") {
  // Only the executor's own read path (what used to hang on the Keychain): bounded, never prompts, fails closed.
  const env = existsSync(ENV_FILE) ? readEnv() : {};
  const { githubBranchTip } = await import("@/lib/execution/github-app");
  for (const origin of ALLOWED) {
    const t0 = Date.now();
    try { const sha = await githubBranchTip(origin, "main", { env }); console.log(`${origin} main: ${sha ? sha.slice(0, 12) : "branch missing"} in ${Date.now() - t0} ms`); }
    catch (e) { console.log(`${origin} main: ${e.message} in ${Date.now() - t0} ms`); }
  }
} else {
  fail("usage: create | finish | check | probe [--secrets-file <file>]", 2);
}
