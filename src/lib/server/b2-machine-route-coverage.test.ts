import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { issueCsrfToken } from './csrf';
import { B2_MACHINE_OR_MIXED, B2_ROUTE_POLICY } from './b2-route-policy';

const { sessionVerifier } = vi.hoisted(() => ({ sessionVerifier: vi.fn() }));
vi.mock('@/lib/firebase-admin', async (importOriginal) => ({ ...(await importOriginal<object>()), verifySessionCookie: sessionVerifier }));

const ROOT = path.resolve('src/app/api');
const OWNER = 'owner_fixture_only';
const COOKIE = 'fixture-session-'.repeat(5);
const SECRET = 'fixture-not-a-real-secret-'.repeat(3);
const ORIGIN = 'https://cockpit.example';
const SVC = { bridge: 'fixture-bridge-secret-0123456789', 'openclaw-webhook': 'fixture-openclaw-bearer-0123456789', vapi: 'fixture-vapi-secret-0123456789', cron: 'fixture-cron-bearer-0123456789', push: 'fixture-push-svc-xxxxxxxxxxxxxxxx', missions: 'fixture-missions-token-0123456789' } as const;
const SVC_HEADER: Record<string, (v: string) => [string, string]> = {
  bridge: (v) => ['x-bridge-secret', v],
  'openclaw-webhook': (v) => ['authorization', `Bearer ${v}`],
  vapi: (v) => ['x-vapi-secret', v],
  cron: (v) => ['authorization', `Bearer ${v}`],
  push: (v) => ['x-cc-push-secret', v],
  missions: (v) => ['x-parallax-missions-token', v],
};

function setEnv(configured: boolean) {
  vi.stubEnv('PARALLAX_OWNER_UID', OWNER);
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', ORIGIN);
  vi.stubEnv('PARALLAX_CSRF_SECRET', SECRET);
  vi.stubEnv('BRIDGE_API_SECRET', configured ? SVC.bridge : '');
  vi.stubEnv('OPENCLAW_CC_WEBHOOK_TOKEN', configured ? SVC['openclaw-webhook'] : '');
  vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', '');
  vi.stubEnv('PARALLAX_VAPI_WEBHOOK_SECRET', configured ? SVC.vapi : '');
  vi.stubEnv('PARALLAX_CRON_TOKEN', configured ? SVC.cron : '');
  vi.stubEnv('CC_PUSH_SECRET', configured ? SVC.push : '');
  vi.stubEnv('PARALLAX_MISSIONS_AGENT_TOKEN', configured ? SVC.missions : '');
  // Twilio fixture config (fake values) so the signature path is exercised.
  for (const [k, v] of Object.entries({ TWILIO_ACCOUNT_SID: 'ACfixture', TWILIO_AUTH_TOKEN: configured ? 'fixture-twilio-auth' : '', TWILIO_API_KEY_SID: 'SKfixture', TWILIO_API_KEY_SECRET: 'fixture', TWILIO_TWIML_APP_SID: 'APfixture', TWILIO_PHONE_NUMBER: '+15555550100' })) vi.stubEnv(k, v);
}
beforeEach(() => { setEnv(true); sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' }); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function exportedMethods(rel: string): string[] {
  const file = path.join(ROOT, rel);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const m = source.statements.flatMap((s) => (ts.isFunctionDeclaration(s) && s.name && s.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword) && /^(GET|POST|PUT|PATCH|DELETE)$/.test(s.name.text) ? [s.name.text] : []));
  if (rel === 'command-center/revenue/route.ts') m.push('GET');
  return m;
}
function policyFor(rel: string, method: string) {
  const r = rel === 'command-center/revenue/route.ts' ? 'command-center/stripe-revenue/route.ts' : rel;
  return (B2_ROUTE_POLICY as Record<string, Record<string, { guard: string; service?: string; human?: string }>>)[r]?.[method];
}

async function call(rel: string, method: string, headers: Record<string, string>, body?: string) {
  const mod = await import(path.join(ROOT, rel));
  const req = new NextRequest(`${ORIGIN}/api/${rel.replace('/route.ts', '')}`, { method, headers, ...(body !== undefined ? { body } : {}) });
  return mod[method](req, { params: Promise.resolve({ id: 'fixture' }) });
}
async function expectDenied(res: Response, statuses: number[]) {
  expect(statuses).toContain(res.status);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(await res.json()).toMatchObject({ error: 'denied' });
}
const HOSTILE_BODY = JSON.stringify({ uid: OWNER, role: 'owner', from: 'ramon', approvedBy: 'ramon', authenticated: true });

describe('P05-B2 machine / owner-or-machine route coverage', () => {
  it('every policy handler awaits its B2 guard first and returns on denial', () => {
    for (const rel of B2_MACHINE_OR_MIXED) {
      if (rel === 'command-center/revenue/route.ts') continue; // pure re-export
      const file = path.join(ROOT, rel);
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const fn of source.statements) {
        if (!ts.isFunctionDeclaration(fn) || !fn.name || !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || !/^(GET|POST|PUT|PATCH|DELETE)$/.test(fn.name.text)) continue;
        const pol = policyFor(rel, fn.name.text);
        const required = pol?.guard ?? (fn.name.text === 'GET' ? 'guardPrivateRead' : 'guardProtectedMutation');
        expect(fn.body?.statements[0]?.getText(source), `${rel} ${fn.name.text}`).toMatch(new RegExp(`await ${required}\\(`));
        expect(fn.body?.statements[1]?.getText(source), `${rel} ${fn.name.text} denial return`).toMatch(/if \(!\w+\.ok\) return \w+\.response/);
      }
    }
  });

  for (const rel of B2_MACHINE_OR_MIXED) {
    for (const method of exportedMethods(rel)) {
      const pol = policyFor(rel, method);
      const mutation = method !== 'GET';
      const body = mutation ? HOSTILE_BODY : undefined;

      if (!pol) {
        // Non-policy methods of mixed routes keep the P03 human boundary.
        for (const scenario of ['unauthenticated', 'wrong-identity', ...(mutation ? ['wrong-origin', 'missing-csrf'] : [])]) {
          it(`${rel} ${method} (human) denies ${scenario}`, async () => {
            const h: Record<string, string> = { origin: ORIGIN, 'content-type': 'application/json', 'x-ramon-uid': OWNER };
            if (scenario !== 'unauthenticated') h.cookie = `__session=${COOKIE}`;
            if (scenario === 'wrong-identity') sessionVerifier.mockResolvedValue({ uid: 'someone_else', signInProvider: 'password' });
            if (scenario === 'wrong-origin') h.origin = 'https://cockpit.example.evil';
            await expectDenied(await call(rel, method, h, body), [401, 403]);
          });
        }
        continue;
      }

      if (pol.guard === 'guardTwilioWebhook') {
        it(`${rel} ${method} denies a missing Twilio signature`, async () => {
          const res = await call(rel, method, { 'content-type': 'application/x-www-form-urlencoded' }, 'To=%2B15555550101');
          await expectDenied(res, [403]);
        });
        it(`${rel} ${method} denies a forged Twilio signature even with an owner session`, async () => {
          const res = await call(rel, method, { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'AAAAAAAAAAAAAAAAAAAAAAAAAAA=', cookie: `__session=${COOKIE}` }, 'To=%2B15555550101');
          await expectDenied(res, [403]);
        });
        it(`${rel} ${method} fails closed when Twilio is not configured`, async () => {
          setEnv(false);
          const res = await call(rel, method, { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'x' }, 'To=%2B15555550101');
          await expectDenied(res, [503]);
        });
        continue;
      }

      const svc = pol.service as keyof typeof SVC;
      const [hdr, good] = SVC_HEADER[svc](SVC[svc]);
      const [, bad] = SVC_HEADER[svc](SVC[svc] + 'x');

      it(`${rel} ${method} denies a missing ${svc} credential with no owner session`, async () => {
        await expectDenied(await call(rel, method, { 'content-type': 'application/json' }, body), [401, 403]);
      });
      it(`${rel} ${method} denies a wrong ${svc} credential`, async () => {
        await expectDenied(await call(rel, method, { 'content-type': 'application/json', [hdr]: bad }, body), [401]);
      });
      it(`${rel} ${method} denies a wrong ${svc} credential even when an owner session is present (no fallback)`, async () => {
        const csrf = issueCsrfToken(COOKIE);
        const h: Record<string, string> = { 'content-type': 'application/json', [hdr]: bad, cookie: `__session=${COOKIE}`, origin: ORIGIN };
        if (csrf.ok) h['x-parallax-csrf'] = csrf.token;
        await expectDenied(await call(rel, method, h, body), [401]);
      });
      it(`${rel} ${method} fails closed (503) when the ${svc} credential is not configured`, async () => {
        setEnv(false);
        await expectDenied(await call(rel, method, { 'content-type': 'application/json', [hdr]: good }, body), [503]);
      });

      if (pol.guard === 'guardServiceCaller') {
        it(`${rel} ${method} does not accept an owner session in place of the machine credential`, async () => {
          const csrf = issueCsrfToken(COOKIE);
          const h: Record<string, string> = { 'content-type': 'application/json', cookie: `__session=${COOKIE}`, origin: ORIGIN };
          if (csrf.ok) h['x-parallax-csrf'] = csrf.token;
          await expectDenied(await call(rel, method, h, body), [401]);
        });
      } else {
        // owner-or-service: the human path keeps every P03 denial.
        for (const scenario of ['wrong-identity', ...(mutation ? ['wrong-origin', 'missing-csrf'] : [])]) {
          it(`${rel} ${method} (owner path) denies ${scenario}`, async () => {
            const h: Record<string, string> = { origin: ORIGIN, 'content-type': 'application/json', cookie: `__session=${COOKIE}` };
            if (scenario === 'wrong-identity') sessionVerifier.mockResolvedValue({ uid: 'someone_else', signInProvider: 'password' });
            if (scenario === 'wrong-origin') h.origin = 'https://cockpit.example.evil';
            await expectDenied(await call(rel, method, h, body), [401, 403]);
          });
        }
      }
    }
  }
});
