// P05-B2: local, $0 policy test for the pending P05-B3 migration.
// Engine: PGlite (PostgreSQL 17 compiled to WASM), in-memory, no network, no cloud.
// Usage: PGLITE_PATH=<path to @electric-sql/pglite/dist/index.js> node supabase/tests/run-b3-local.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const PGLITE = process.env.PGLITE_PATH || path.join(process.env.HOME, "node_modules/@electric-sql/pglite/dist/index.js");
const { PGlite } = await import(PGLITE);

const results = [];
let failures = 0;
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const db = new PGlite();
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function as(role, sql) {
  await db.exec(`set role ${role}`);
  try { return { ok: true, rows: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, err: e.message, code: e.code }; }
  finally { await db.exec("reset role"); }
}

// ── 1. Supabase-style role prelude ─────────────────────────────────────────
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
`);
// ── 2. Live baseline ───────────────────────────────────────────────────────
await db.exec(readFileSync(path.join(root, "baseline/live-schema-2026-09-28.sql"), "utf8"));

// Live facts recorded from the production catalog (2026-09-28, P05-B1/B2 read-only queries).
const LIVE_POLICIES = [
  "parallax.alerts|read_all|SELECT", "parallax.bankroll|read_all|SELECT", "parallax.bets|read_all|SELECT",
  "parallax.odds_snapshots|read_all|SELECT", "parallax.scan_runs|read_all|SELECT",
  "public.agent_profiles|Allow all on agent_profiles|ALL", "public.baba_call_time_rsvp|baba_rsvp_anon_insert|INSERT",
  "public.channel_members|Allow all on channel_members|ALL", "public.channels|Allow all on channels|ALL",
  "public.message_reactions|Enable read access for all users|SELECT", "public.messages|Allow all on messages|ALL",
  "public.messages|Enable read access for all users|SELECT", "public.parallax_bets|parallax anon read bets|SELECT",
  "public.parallax_bets|parallax anon update bets|UPDATE", "public.parallax_bets|parallax anon write bets|INSERT",
  "public.parallax_odds_cache|parallax anon read cache|SELECT", "public.parallax_odds_cache|parallax anon update cache|UPDATE",
  "public.parallax_odds_cache|parallax anon write cache|INSERT", "public.tenants|Allow all on tenants|ALL",
].sort();
const LIVE_RLS_COUNT = 21;
const LIVE_VIEW_MODES = { pbx_alerts: "invoker", pbx_bankroll: "invoker", pbx_bets: "invoker", pbx_odds_snapshots: "invoker", pbx_scan_runs: "invoker", pipeline_metrics: "DEFINER" };
// Effective anon/authenticated privilege letters per object (S/I/U/D), live 2026-09-28.
const LIVE_ANON = { "parallax.alerts": "S", "parallax.bankroll": "S", "parallax.bets": "S", "parallax.odds_snapshots": "S", "parallax.scan_runs": "S" };
const PUBLIC_OBJECTS = ["agent_profiles","baba_call_time_rsvp","channel_members","channels","daily_verses","job_events","jobs","message_reactions","messages","parallax_bets","parallax_odds_cache","pbx_alerts","pbx_bankroll","pbx_bets","pbx_odds_snapshots","pbx_scan_runs","pipeline_events","pipeline_gate","pipeline_leads","pipeline_metrics","pipeline_proposals","tenants"];
for (const o of PUBLIC_OBJECTS) LIVE_ANON[`public.${o}`] = "SIUD";

async function snapshot() {
  const pol = (await q(`select schemaname||'.'||tablename||'|'||policyname||'|'||cmd as k from pg_policies where schemaname in ('public','parallax')`)).map(r => r.k).sort();
  const rls = (await q(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','parallax') and c.relkind in ('r','p') and c.relrowsecurity`))[0].n;
  const views = Object.fromEntries((await q(`select c.relname, case when coalesce(array_to_string(c.reloptions,','),'') ~ 'security_invoker=(on|true)' then 'invoker' else 'DEFINER' end m from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'`)).map(r => [r.relname, r.m]));
  const priv = {};
  for (const r of await q(`select n.nspname||'.'||c.relname k,
      concat_ws('', case when has_table_privilege('anon',c.oid,'SELECT') then 'S' end, case when has_table_privilege('anon',c.oid,'INSERT') then 'I' end,
                    case when has_table_privilege('anon',c.oid,'UPDATE') then 'U' end, case when has_table_privilege('anon',c.oid,'DELETE') then 'D' end) p,
      concat_ws('', case when has_table_privilege('authenticated',c.oid,'SELECT') then 'S' end, case when has_table_privilege('authenticated',c.oid,'INSERT') then 'I' end,
                    case when has_table_privilege('authenticated',c.oid,'UPDATE') then 'U' end, case when has_table_privilege('authenticated',c.oid,'DELETE') then 'D' end) pa
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','parallax') and c.relkind in ('r','p','v') order by 1`)) { priv[r.k] = [r.p, r.pa]; }
  const fnAnon = (await q(`select has_function_privilege('anon','public.pg_publication_tables_for(text)','EXECUTE') a, has_function_privilege('service_role','public.pg_publication_tables_for(text)','EXECUTE') s`))[0];
  // Full-fidelity fingerprints (Codex finding 7): complete policy definitions and raw ACLs.
  const polFull = (await q(`select schemaname||'.'||tablename||'|'||policyname||'|'||permissive||'|'||cmd||'|'||array_to_string(roles,',')||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') k
      from pg_policies where schemaname in ('public','parallax') order by 1`)).map(r => r.k);
  const relAcl = (await q(`select n.nspname||'.'||c.relname||'|'||c.relkind::text||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(array_to_string(c.reloptions,','),'')||'|'||
      coalesce((select string_agg(x::text, ',' order by x::text) from unnest(c.relacl) x),'<default>') k
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','parallax') and c.relkind in ('r','p','v') order by 1`)).map(r => r.k);
  const fnAcl = (await q(`select p.oid::regprocedure::text||'|'||p.prosecdef||'|'||coalesce((select string_agg(x::text, ',' order by x::text) from unnest(p.proacl) x),'<default>') k
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','parallax') order by 1`)).map(r => r.k);
  return { pol, rls, views, priv, fnAnon, polFull, relAcl, fnAcl };
}

// ── 3. Baseline fidelity vs live facts ─────────────────────────────────────
const base = await snapshot();
check("baseline: policy set equals live (19 policies)", JSON.stringify(base.pol) === JSON.stringify(LIVE_POLICIES), `${base.pol.length} local`);
check("baseline: RLS enabled on the same 21 tables", base.rls === LIVE_RLS_COUNT, `${base.rls}`);
check("baseline: view security modes equal live", JSON.stringify(base.views) === JSON.stringify(Object.fromEntries(Object.entries(LIVE_VIEW_MODES).sort())) || Object.entries(LIVE_VIEW_MODES).every(([k, v]) => base.views[k] === v));
check("baseline: anon privilege matrix equals live", Object.entries(LIVE_ANON).every(([k, v]) => base.priv[k]?.[0] === v), JSON.stringify(Object.entries(LIVE_ANON).filter(([k, v]) => base.priv[k]?.[0] !== v)));

// Full live fingerprint (Codex finding 7): complete policy definitions, raw table/view ACLs,
// function ACLs. Re-read from production 2026-09-28 (metadata only).
const LIVE_FULL = JSON.parse(readFileSync(path.join(here, "live-fingerprint-2026-09-28.json"), "utf8"));
const localRel = (await q(`select n.nspname||'.'||c.relname||'|'||coalesce((select string_agg(x::text, ',' order by x::text) from unnest(c.relacl) x),'<default>')||'|'||c.relforcerowsecurity::text||'|'||coalesce(array_to_string(c.reloptions,','),'') v
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','parallax') and c.relkind in ('r','p','v') order by 1`)).map(r => r.v);
const localFn = (await q(`select p.oid::regprocedure::text||'|'||p.prosecdef::text||'|'||coalesce((select string_agg(x::text, ',' order by x::text) from unnest(p.proacl) x),'<default>') v
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','parallax') order by 1`)).map(r => r.v);
const setDiff = (a, b) => JSON.stringify(a.filter(x => !b.includes(x)).concat(b.filter(x => !a.includes(x)).map(x => "live:" + x)));
check("baseline (full): policy definitions equal live (roles, permissive, USING, WITH CHECK)", JSON.stringify(base.polFull) === JSON.stringify(LIVE_FULL.policies), setDiff(base.polFull, LIVE_FULL.policies));
check("baseline (full): raw table/view ACLs, force-RLS, reloptions equal live", JSON.stringify(localRel) === JSON.stringify(LIVE_FULL.relations), setDiff(localRel, LIVE_FULL.relations));
check("baseline (full): function ACLs and SECURITY DEFINER flags equal live", JSON.stringify(localFn) === JSON.stringify(LIVE_FULL.functions), setDiff(localFn, LIVE_FULL.functions));

// ── 4. Synthetic fixtures (no production data) ─────────────────────────────
const CH = "5b9a0c1e-1111-4222-8333-944455556666";
await db.exec(`
  insert into public.tenants (id, name, slug) values ('11111111-1111-1111-1111-111111111111','Fixture','fixture');
  insert into public.channels (id, name, slug, type) values ('${CH}','general','general','team');
  insert into public.agent_profiles (name, handle) values ('Fixture Agent','fixture-agent');
  insert into public.channel_members (channel_id, agent_id) values ('${CH}', gen_random_uuid());
  insert into public.messages (id, channel_id, content, attachments) values ('aaaaaaaa-0000-4000-8000-000000000001','${CH}','fixture message',
    '[{"url":"https://fixture.supabase.co/storage/v1/object/public/agent-output/agent/1-x.png","type":"image/png"}]');
  insert into public.message_reactions (message_id, user_id, emoji) values ('aaaaaaaa-0000-4000-8000-000000000001','u','👍');
  insert into public.pipeline_leads (name, stage, value, feed) values ('Fixture Lead','closed',1000,'agency');
  insert into parallax.bankroll (current_bankroll, start_of_day) values (100, 100);
  insert into parallax.bets (ts_ms, game, market_ref, side, book, entry_decimal_odds, fair_prob, edge, ev, stake) values (1,'g','m','s','b',2,0.5,0.1,0.1,1);
`);

const CHAT = ["messages", "message_reactions", "channels", "channel_members", "agent_profiles", "tenants"];

// ── 5. Pre-migration: reproduce the live exposure ──────────────────────────
check("pre: anon can SELECT messages (live exposure reproduced)", (await as("anon", "select count(*)::int n from public.messages")).rows?.[0]?.n === 1);
check("pre: anon can SELECT pipeline_metrics aggregate (definer bypass reproduced)", (await as("anon", "select revenue_won from public.pipeline_metrics")).rows?.[0]?.revenue_won == 1000);
check("pre: anon sees 0 pipeline_leads rows (RLS deny reproduced)", (await as("anon", "select count(*)::int n from public.pipeline_leads")).rows?.[0]?.n === 0);
check("pre: anon can INSERT into messages (write exposure reproduced)", (await as("anon", `insert into public.messages (channel_id, content) values ('${CH}','x') returning id`)).ok === true);
await db.exec(`delete from public.messages where content = 'x'`);

// ── 6. Apply B3 ────────────────────────────────────────────────────────────
const UP = readFileSync(path.join(root, "pending-b3/20260928120000_p05b3_cockpit_anon_lockdown.sql"), "utf8");
const DOWN = readFileSync(path.join(root, "pending-b3/20260928120000_p05b3_cockpit_anon_lockdown.down.sql"), "utf8");
await db.exec(UP);
check("B3 applies cleanly", true);

for (const t of CHAT) {
  for (const role of ["anon", "authenticated"]) {
    const sel = await as(role, `select count(*) from public.${t}`);
    check(`post: ${role} SELECT ${t} denied`, !sel.ok && sel.code === "42501", sel.err ?? "allowed");
  }
}
const ins = await as("anon", `insert into public.messages (channel_id, content) values ('${CH}','intrusion')`);
check("post: anon INSERT messages denied", !ins.ok && ins.code === "42501", ins.err ?? "allowed");
const upd = await as("anon", `update public.messages set content='tampered'`);
check("post: anon UPDATE messages denied", !upd.ok && upd.code === "42501", upd.err ?? "allowed");
const del = await as("anon", `delete from public.messages`);
check("post: anon DELETE messages denied", !del.ok && del.code === "42501", del.err ?? "allowed");
for (const t of ["tenants", "channels", "channel_members", "agent_profiles", "message_reactions"]) {
  const w = await as("anon", `delete from public.${t}`);
  check(`post: anon DELETE ${t} denied`, !w.ok && w.code === "42501", w.err ?? "allowed");
}
const pm = await as("anon", "select * from public.pipeline_metrics");
check("post: anon pipeline_metrics denied", !pm.ok && pm.code === "42501", pm.err ?? "allowed");
const pma = await as("authenticated", "select * from public.pipeline_metrics");
check("post: authenticated pipeline_metrics denied", !pma.ok && pma.code === "42501", pma.err ?? "allowed");
const fn = await as("anon", "select * from public.pg_publication_tables_for('supabase_realtime')");
check("post: anon cannot execute pg_publication_tables_for", !fn.ok && fn.code === "42501", fn.err ?? "allowed");

// Service-side paths used by the migrated server routes still work.
const svcSel = await as("service_role", `select id, content, attachments from public.messages where channel_id='${CH}' order by created_at asc limit 100`);
check("post: service_role history query works (chat/messages GET)", svcSel.ok && svcSel.rows.length === 1, svcSel.err);
const svcIns = await as("service_role", `insert into public.messages (channel_id, sender_user_id, sender_type, content, tenant_id, attachments, status, metadata)
  values ('${CH}','00000000-0000-0000-0000-000000000001','user','owner send','11111111-1111-1111-1111-111111111111','[]','sent','{"source":"command-center-ui"}') returning id`);
check("post: service_role user-message insert works (chat/messages POST)", svcIns.ok && svcIns.rows.length === 1, svcIns.err);
const svcReact = await as("service_role", `select message_id, emoji, user_id from public.message_reactions where message_id in ('aaaaaaaa-0000-4000-8000-000000000001')`);
check("post: service_role reactions query works (chat/reactions GET)", svcReact.ok && svcReact.rows.length === 1, svcReact.err);
const svcBoot = await as("service_role", `select (select count(*) from public.channels)::int c, (select count(*) from public.agent_profiles)::int a`);
check("post: service_role bootstrap query works (chat/bootstrap GET)", svcBoot.ok && svcBoot.rows[0].c === 1 && svcBoot.rows[0].a === 1, svcBoot.err);
const svcGal = await as("service_role", `select id, attachments from public.messages where attachments is not null order by created_at desc limit 500`);
check("post: service_role gallery query works; agent-output URL preserved", svcGal.ok && JSON.stringify(svcGal.rows).includes("/storage/v1/object/public/agent-output/"), svcGal.err);
const svcFn = await as("service_role", "select * from public.pg_publication_tables_for('supabase_realtime')");
check("post: service_role can execute pg_publication_tables_for", svcFn.ok, svcFn.err);
const svcPm = await as("service_role", "select revenue_won from public.pipeline_metrics");
check("post: service_role pipeline_metrics works (invoker + bypassrls)", svcPm.ok && svcPm.rows[0]?.revenue_won == 1000, svcPm.err);

// Unchanged surfaces (Parallax Bet, RSVP form, already-denied tables).
const pbx = await as("anon", "select count(*)::int n from public.pbx_bankroll");
check("unchanged: anon can still read pbx_bankroll (Parallax Bet untouched)", pbx.ok && pbx.rows[0].n === 1, pbx.err);
const pbxb = await as("anon", "select count(*)::int n from public.pbx_bets");
check("unchanged: anon can still read pbx_bets", pbxb.ok && pbxb.rows[0].n === 1, pbxb.err);
const pbins = await as("anon", "insert into public.parallax_odds_cache (cache_key, payload) values ('k','{}') returning id");
check("unchanged: parallax_odds_cache anon insert still allowed (out of scope)", pbins.ok, pbins.err);
const rsvp = await as("anon", "insert into public.baba_call_time_rsvp (event_date, full_name, mobile, is_adult, agreed_terms, signature_name, terms_version) values (current_date,'a','1',true,true,'a','v1')");
check("unchanged: baba_call_time_rsvp anon insert still allowed (public form)", rsvp.ok, rsvp.err);
const leads = await as("anon", "select count(*)::int n from public.pipeline_leads");
check("unchanged: pipeline_leads still returns 0 rows to anon (not an error)", leads.ok && leads.rows[0].n === 0, leads.err);

// ── 7. Rollback restores the exact baseline ────────────────────────────────
await db.exec(DOWN);
const back = await snapshot();
check("rollback: policies identical to baseline", JSON.stringify(back.pol) === JSON.stringify(base.pol));
check("rollback: view modes identical to baseline", JSON.stringify(back.views) === JSON.stringify(base.views));
check("rollback: privilege matrix identical to baseline", JSON.stringify(back.priv) === JSON.stringify(base.priv), JSON.stringify(Object.keys(base.priv).filter(k => JSON.stringify(base.priv[k]) !== JSON.stringify(back.priv[k])).map(k => [k, base.priv[k], back.priv[k]])));
check("rollback: function privileges identical to baseline", JSON.stringify(back.fnAnon) === JSON.stringify(base.fnAnon));
check("rollback (full): policy definitions identical (roles, permissive, USING, WITH CHECK)", JSON.stringify(back.polFull) === JSON.stringify(base.polFull), JSON.stringify(base.polFull.filter(x => !back.polFull.includes(x)).concat(back.polFull.filter(x => !base.polFull.includes(x)))));
check("rollback (full): table/view ACLs identical (all privileges + grant options), RLS flags, reloptions", JSON.stringify(back.relAcl) === JSON.stringify(base.relAcl), JSON.stringify(base.relAcl.filter(x => !back.relAcl.includes(x)).concat(back.relAcl.filter(x => !base.relAcl.includes(x)))));
check("rollback (full): function ACLs and SECURITY DEFINER flags identical", JSON.stringify(back.fnAcl) === JSON.stringify(base.fnAcl), JSON.stringify(base.fnAcl.filter(x => !back.fnAcl.includes(x)).concat(back.fnAcl.filter(x => !base.fnAcl.includes(x)))));

// ── 8. Idempotency ─────────────────────────────────────────────────────────
await db.exec(UP); await db.exec(UP);
const again = await snapshot();
check("idempotent: B3 re-applied twice without error", true);
check("idempotent: no chat policies remain", !again.pol.some((p) => /^public\.(messages|message_reactions|channels|channel_members|agent_profiles|tenants)\|/.test(p)));
await db.exec(DOWN); await db.exec(DOWN);
{ const s2 = await snapshot();
  check("idempotent: rollback re-applied twice restores full baseline", ["polFull", "relAcl", "fnAcl", "priv"].every(k => JSON.stringify(s2[k]) === JSON.stringify(base[k]))); }

console.log(`\n${results.length - failures}/${results.length} checks passed`);
if (process.env.B3_RESULTS_JSON) (await import("node:fs")).writeFileSync(process.env.B3_RESULTS_JSON, JSON.stringify({ engine: (await q("select version()"))[0].version, results }, null, 2));
process.exit(failures ? 1 : 0);
