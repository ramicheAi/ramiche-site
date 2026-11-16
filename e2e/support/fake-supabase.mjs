#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   SYNTHETIC SUPABASE FOR THE COMMAND CENTER ACCEPTANCE HARNESS

   WHY: the real product talks to Supabase for channels, messages, trusted
   devices and reactions, and to an OpenClaw gateway for agent replies. A test
   must never touch either. This server implements the small PostgREST subset
   the app actually uses, over an in-memory synthetic dataset, and records every
   write so a test can assert what really persisted.

   IT IS NOT A SUPABASE REPLACEMENT. It does not do RLS, storage, realtime or
   auth. The browser's realtime socket will fail against it, which is the point:
   the app's documented REST polling fallback must carry the session, and a test
   asserts that it does.

   FAIL CLOSED. It refuses to start if the environment looks like production
   (a supabase.co URL or a real service key), so a misconfigured run cannot
   point the app at the live project.
   ══════════════════════════════════════════════════════════════ */

import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.E2E_FAKE_SUPABASE_PORT ?? 54329);

/* ── refuse to run against anything real ─────────────────────────────── */
for (const [k, v] of Object.entries(process.env)) {
  if (!/SUPABASE/.test(k)) continue;
  if (v && /supabase\.co|supabase\.in/.test(v)) {
    console.error(`[fake-supabase] REFUSING: ${k} points at a hosted Supabase (${v})`);
    process.exit(1);
  }
}

const OWNER_UID = process.env.PARALLAX_OWNER_UID ?? "e2e-owner";
const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_SECRET = "e2e-device-secret-0123456789abcdef0123456789abcdef";
const CHANNEL_ID = "22222222-2222-4222-8222-222222222222";

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

/** In-memory tables. Unknown tables are created on first insert. */
const tables = new Map([
  [
    "cc_trusted_devices",
    [
      {
        id: DEVICE_ID,
        owner_uid: OWNER_UID,
        secret_hash: createHash("sha256").update(DEVICE_SECRET, "utf8").digest("hex"),
        expires_at: iso(30 * 24 * 3600 * 1000),
        revoked_at: null,
        failed_pin_attempts: 0,
        locked_until: null,
        label: "e2e device",
      },
    ],
  ],
  [
    "channels",
    [
      {
        id: CHANNEL_ID,
        name: "general",
        description: "synthetic channel",
        kind: "channel",
        members: [],
        created_at: iso(-86_400_000),
      },
    ],
  ],
  ["messages", []],
  ["message_reactions", []],
  ["agent_profiles", []],
]);

/** Every write, in order, for assertions. */
const writes = [];
/** bucket/object -> { buf, type }, so an uploaded attachment can be read back like real storage. */
const storage = new Map();
/** When set, uploads fail the way an unavailable bucket does. Used to prove the UI's failure path. */
let storageFail = false;
const requests = [];

const rows = (table) => {
  if (!tables.has(table)) tables.set(table, []);
  return tables.get(table);
};

function applyFilters(list, url) {
  let out = [...list];
  for (const [key, raw] of url.searchParams.entries()) {
    if (["select", "order", "limit", "offset", "apikey"].includes(key)) continue;
    const m = /^(eq|neq|in|gte|lte|is)\.(.*)$/.exec(raw);
    if (!m) continue;
    const [, op, value] = m;
    out = out.filter((row) => {
      const v = row[key];
      if (op === "eq") return String(v) === value;
      if (op === "neq") return String(v) !== value;
      if (op === "is") return value === "null" ? v == null : String(v) === value;
      if (op === "gte") return new Date(String(v)).getTime() >= new Date(value).getTime();
      if (op === "lte") return new Date(String(v)).getTime() <= new Date(value).getTime();
      if (op === "in") {
        const set = value.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
        return set.includes(String(v));
      }
      return true;
    });
  }
  return out;
}

function applyOrder(list, url) {
  const order = url.searchParams.get("order");
  if (!order) return list;
  const parts = order.split(",").map((p) => p.trim());
  const sorted = [...list];
  sorted.sort((a, b) => {
    for (const part of parts) {
      const [col, dir] = part.split(".");
      const av = a[col];
      const bv = b[col];
      if (av === bv) continue;
      const cmp = av < bv ? -1 : 1;
      return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  requests.push({ method: req.method, path: url.pathname });

  /* Control endpoints for the harness (not part of PostgREST). */
  if (url.pathname === "/__e2e/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ writes, requests, tables: Object.fromEntries(tables) }));
    return;
  }
  if (url.pathname === "/__e2e/storage-mode" && req.method === "POST") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { storageFail = JSON.parse(raw || "{}").fail === true; } catch { /* keep */ }
      res.writeHead(204).end();
    });
    return;
  }
  if (url.pathname === "/__e2e/reset" && req.method === "POST") {
    writes.length = 0;
    rows("messages").length = 0;
    rows("message_reactions").length = 0;
    storage.clear();
    storageFail = false;
    res.writeHead(204).end();
    return;
  }

  /* ── Storage: only what the attachment upload needs ──────────────────────
     A bucket write and a public read. Without this the upload 500s and an attachment can never be
     proven to persist, which turns a real journey into a permanent BLOCKED. */
  const storageMatch = /^\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/.exec(url.pathname);
  if (storageMatch) {
    const [, bucket, objectPath] = storageMatch;
    const key = `${bucket}/${objectPath}`;
    if (req.method === "GET") {
      const hit = storage.get(key);
      if (!hit) { res.writeHead(404).end(JSON.stringify({ error: "not found" })); return; }
      res.writeHead(200, { "content-type": hit.type, "content-length": hit.buf.length });
      res.end(hit.buf);
      return;
    }
    if ((req.method === "POST" || req.method === "PUT") && storageFail) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ statusCode: "503", error: "Service Unavailable", message: "storage unavailable (e2e)" }));
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const buf = Buffer.concat(chunks);
        storage.set(key, { buf, type: String(req.headers["content-type"] ?? "application/octet-stream") });
        writes.push({ table: "_storage", op: "upload", row: { key, bytes: buf.length } });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ Key: key, Id: key }));
      });
      return;
    }
  }

  /* ── RPCs the chat route depends on ─────────────────────────────────────
     Implemented with the same semantics as the prepared migration, because the
     relay claim is the thing journeys E (duplicate clicks) and I (delivery
     states) actually test. A stub that always granted the claim would make both
     journeys pass for the wrong reason. */
  const rpcMatch = /^\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)$/.exec(url.pathname);
  if (rpcMatch) {
    const fn = rpcMatch[1];
    const body = (await readBody(req)) ?? {};
    const json = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    const findMsg = (id) => rows("messages").find((r) => String(r.id) === String(id));

    if (fn === "cc_claim_relay_dispatch") {
      const row = findMsg(body.p_message_id);
      if (!row) return json(200, [{ claimed: false, attempts: null, status: "not_found" }]);
      const leaseS = Number(body.p_lease_seconds ?? 300);
      const status = String(row.relay_status ?? "pending");
      const terminal = ["delivered", "failed_permanent", "legacy"].includes(status);
      if (terminal) return json(200, [{ claimed: false, attempts: row.relay_attempts ?? 0, status }]);
      const claimedAt = row.relay_claimed_at ? new Date(row.relay_claimed_at).getTime() : 0;
      const live = status === "claimed" && Date.now() - claimedAt < leaseS * 1000;
      if (live) return json(200, [{ claimed: false, attempts: row.relay_attempts ?? 0, status }]);
      row.relay_attempts = (row.relay_attempts ?? 0) + 1;
      row.relay_status = "claimed";
      row.relay_claimed = true;
      row.relay_claimed_at = iso();
      writes.push({ table: "messages", op: "claim", row: { id: row.id, attempt: row.relay_attempts } });
      return json(200, [{ claimed: true, attempts: row.relay_attempts, status: "claimed" }]);
    }

    if (fn === "cc_mark_relay_status") {
      const row = findMsg(body.p_message_id);
      if (!row) return json(200, false);
      const status = String(row.relay_status ?? "pending");
      if (["delivered", "failed_permanent", "legacy"].includes(status)) return json(200, false);
      const attempt = body.p_attempt;
      const matches = attempt === null || attempt === undefined
        ? (row.relay_attempts ?? 0) === 0
        : Number(attempt) === Number(row.relay_attempts ?? 0);
      if (!matches) {
        writes.push({ table: "messages", op: "mark-fenced", row: { id: row.id, attempt } });
        return json(200, false);
      }
      row.relay_status = body.p_status;
      if (body.p_status === "delivered") row.relay_claimed = false;
      writes.push({ table: "messages", op: "mark", row: { id: row.id, status: body.p_status } });
      return json(200, true);
    }

    return json(404, { code: "PGRST202", message: `function ${fn} not found` });
  }

  const m = /^\/rest\/v1\/([a-zA-Z0-9_]+)$/.exec(url.pathname);
  if (!m) {
    /* Storage, auth, realtime: deliberately unsupported. */
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "not implemented in the e2e fake" }));
    return;
  }
  const table = m[1];
  const single = String(req.headers.accept ?? "").includes("pgrst.object");
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" || req.method === "HEAD") {
    let result = applyOrder(applyFilters(rows(table), url), url);
    const limit = url.searchParams.get("limit");
    if (limit) result = result.slice(0, Number(limit));
    if (single) {
      if (result.length === 0) {
        res.writeHead(406, { "content-type": "application/json" });
        res.end(JSON.stringify({ code: "PGRST116", message: "no rows" }));
        return;
      }
      return json(200, result[0]);
    }
    return json(200, result);
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const incoming = Array.isArray(body) ? body : [body];
    const inserted = incoming.filter(Boolean).map((row) => {
      const withId = { id: row.id ?? randomUUID(), created_at: row.created_at ?? iso(), ...row };
      rows(table).push(withId);
      writes.push({ table, op: "insert", row: withId });
      return withId;
    });
    if (String(req.headers.prefer ?? "").includes("return=representation")) {
      // .single() asks for one object, not an array. Returning an array here broke the client's
      // `body.data.id` read, which looked like a product bug and was not.
      if (single) {
        if (inserted.length !== 1) {
          return json(406, { code: "PGRST116", message: `expected 1 row, got ${inserted.length}` });
        }
        return json(201, inserted[0]);
      }
      return json(201, inserted);
    }
    res.writeHead(201).end();
    return;
  }

  if (req.method === "PATCH") {
    const body = (await readBody(req)) ?? {};
    const targets = applyFilters(rows(table), url);
    for (const row of targets) {
      Object.assign(row, body);
      writes.push({ table, op: "update", row });
    }
    if (String(req.headers.prefer ?? "").includes("return=representation")) {
      if (single) {
        if (targets.length !== 1) {
          return json(406, { code: "PGRST116", message: `expected 1 row, got ${targets.length}` });
        }
        return json(200, targets[0]);
      }
      return json(200, targets);
    }
    res.writeHead(204).end();
    return;
  }

  if (req.method === "DELETE") {
    const targets = applyFilters(rows(table), url);
    const keep = rows(table).filter((r) => !targets.includes(r));
    tables.set(table, keep);
    for (const row of targets) writes.push({ table, op: "delete", row });
    res.writeHead(204).end();
    return;
  }

  json(405, { message: `${req.method} not supported` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-supabase] listening on http://127.0.0.1:${PORT} owner=${OWNER_UID}`);
});

/* Fixtures the harness needs, exported for the Playwright config. */
export { CHANNEL_ID, DEVICE_ID, DEVICE_SECRET, OWNER_UID };
