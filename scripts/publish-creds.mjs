#!/usr/bin/env node
/**
 * Say what THIS container may do, and whether the handoff is ready.
 *
 * It is not a hunt for credentials. A cloud container is deliberately not the
 * thing that publishes, so "no publishing credentials here" is the correct,
 * expected result and this script reports it as such.
 *
 * THE SCAR — 2026-08-19, in two parts.
 *
 *   First: a session published two posts, lost the token to a context
 *   compaction, then ran "is there an env var, does the endpoint 401", found
 *   no and yes, and told Ramon the account had no publishing access. Both
 *   observations were true and the conclusion was wrong.
 *
 *   Second, the same day: the fix that was written for that was ALSO wrong. It
 *   instructed future runs to get SERVICE_TOKEN into the container env or a
 *   dotfile. Ramon: that key is full publish authority over 22 connected
 *   accounts across 6 brands including a client's, it does not expire on its
 *   own, and a container env is the wrong place for it. The split between
 *   preparing and publishing is the gate, not an inconvenience.
 *
 * So this reports the split, not a shopping list.
 *
 *   node scripts/publish-creds.mjs [--media <url>] [--caption <file>]
 *
 * Exit 0 when the handoff is ready (or when only presence was asked about),
 * 1 when something this session OWNS is missing. Never exits non-zero merely
 * because publishing credentials are absent — that is the expected state.
 */
import { existsSync, readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/* THREE different tokens, and conflating them is why sessions kept reporting "no
   credential" while holding a working one.

     SERVICE_TOKEN           publishes IMMEDIATELY to any of 22 accounts across 6
                             brands, one of them a client's. Never belongs in a
                             container. A 401 from /api/service/publish is that
                             guard working correctly.

     PARALLAX_PUBLISH_TOKEN  brand-scoped, QUEUE ONLY. It physically cannot
                             publish: it submits to an approval queue and Ramon
                             decides. Safe to hold, and it is the intended path
                             for every agent in every repo. This script did not
                             check for it at all, so it reported "no credential"
                             while the correct token sat unexamined and sessions
                             went and asked for the dangerous one instead.

     OPERATOR_API_TOKEN      read-only insights. */
const PUBLISHING_KEYS = ["SERVICE_TOKEN", "INSTAGRAM_ACCESS_TOKEN"];
const QUEUE_KEYS = ["PARALLAX_PUBLISH_TOKEN"];
const READ_KEYS = ["OPERATOR_API_TOKEN", "CRON_SECRET"];

const present = (n) => Boolean(process.env[n]);
const anyPublish = PUBLISHING_KEYS.some(present);
const anyRead = READ_KEYS.some(present);

const queueTok = QUEUE_KEYS.map((k) => process.env[k]).find(Boolean);

console.log("THIS CONTAINER");
console.log(`  queue a post for approval : ${queueTok ? `YES, PARALLAX_PUBLISH_TOKEN present (${queueTok.slice(0, 12)}...)` : "no token, see below"}`);
console.log(`  publish directly, no gate : ${anyPublish ? "credential present" : "no — correct and expected"}`);
console.log(`  read-only insights        : ${anyRead ? "credential present" : "not available here"}`);
console.log("");
if (queueTok) {
  console.log("  YOU CAN SUBMIT A POST RIGHT NOW. It goes to the approval queue, not live:");
  console.log("");
  console.log('    curl -X POST https://parallax-publish.vercel.app/api/service/queue \\');
  console.log('      -H "authorization: Bearer $PARALLAX_PUBLISH_TOKEN" \\');
  console.log('      -H "content-type: application/json" \\');
  console.log("      -d '{\"agentName\":\"<repo> session\",\"note\":\"why this is worth posting\",");
  console.log("           \"content\":\"<caption>\",\"platforms\":[\"instagram\"],");
  console.log("           \"mediaUrls\":[\"https://<public https url>\"]}'");
  console.log("");
  console.log("  It returns the exact text each account will receive. Read that before");
  console.log("  moving on. Ramon approves at parallax-publish.vercel.app/queue.");
  console.log("  Omit `accounts` and it fans out to every account of THIS repo's brand.");
  console.log("  The token cannot reach another brand, so a broad call is safe.");
} else {
  console.log("  No queue token here. Ask for PARALLAX_PUBLISH_TOKEN, NOT SERVICE_TOKEN.");
  console.log("  The queue token cannot publish, only propose, so it is safe to inject.");
  console.log("  On a fleet host it is already in this repo's .env.");
}
console.log("");
console.log("  Never ask for SERVICE_TOKEN. It publishes immediately to 22 accounts");
console.log("  across 6 brands including a client's, and does not expire on its own.");
console.log("  A 401 from /api/service/* is the guard working. Do not route around it,");
console.log("  and do not ask for a publishing token in chat or in a container.");

if (anyPublish) {
  console.log("");
  console.log("  ⚠ A publishing credential IS set in this environment. That is not the");
  console.log("    intended posture. Confirm with Ramon before using it, and do not");
  console.log("    persist it anywhere. See marketing/instagram/PUBLISH-RUNBOOK.md.");
}

/* The handoff is the deliverable, so it is the thing worth failing on. */
const media = arg("--media");
const captionFile = arg("--caption");
if (!media && !captionFile) process.exit(0);

console.log("");
console.log("HANDOFF");
let ok = true;

if (media) {
  const httpsPublic = /^https:\/\/(?!.*vercel\.app)/.test(media);
  console.log(`  media url                 : ${media}`);
  console.log(`  public host               : ${httpsPublic ? "yes" : "NO — a *.vercel.app preview sits behind Vercel auth and Instagram's fetcher gets the login redirect"}`);
  if (!httpsPublic) ok = false;
} else {
  console.log("  media url                 : MISSING");
  ok = false;
}

if (captionFile) {
  if (!existsSync(captionFile)) {
    console.log(`  caption                   : MISSING (${captionFile})`);
    ok = false;
  } else {
    const text = readFileSync(captionFile, "utf8");
    /* Brand rules that are mechanically checkable. Everything else about the
       copy is a human read; this catches only what a regex honestly can. */
    const banned = [
      ["em dash", /—/],
      ["en dash", /–/],
      ["ellipsis", /…|\.\.\./],
    ].filter(([, re]) => re.test(text));
    const tags = (text.match(/#[A-Za-z0-9_]+/g) || []).length;
    const words = text.replace(/#[A-Za-z0-9_]+/g, "").trim().split(/\s+/).filter(Boolean).length;
    console.log(`  caption                   : ${captionFile}`);
    console.log(`  banned punctuation        : ${banned.length ? banned.map(([n]) => n).join(", ") : "none"}`);
    console.log(`  words / hashtags          : ${words} / ${tags}${tags >= 8 && tags <= 12 ? "" : "  (playbook says 8-12 tags)"}`);
    if (banned.length) ok = false;
  }
} else {
  console.log("  caption                   : MISSING");
  ok = false;
}

console.log("");
console.log(ok ? "  handoff ready to pass to the credentialed session" : "  handoff INCOMPLETE — fix the above before handing over");
process.exit(ok ? 0 : 1);
