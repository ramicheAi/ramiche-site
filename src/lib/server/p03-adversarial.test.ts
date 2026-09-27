import { afterEach, describe, expect, it, vi } from 'vitest';
import { trustedOrigins } from './origin-guard';
import { issueCsrfToken, verifyCsrfToken } from './csrf';
import { requireOwnerIdentity } from './owner-identity';
import { validateEnvelopeShape } from './durable-claim-contract';
import { NextRequest } from 'next/server';
import { POST as telegram } from '@/app/api/command-center/telegram/webhook/route';

const { sdkSession } = vi.hoisted(() => ({ sdkSession: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ verifySessionCookie: sdkSession }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const OWNER='owner_uid_test_only';
const env={PARALLAX_OWNER_UID:OWNER,PARALLAX_CSRF_SECRET:'test-fixture-only-not-a-real-secret-123456'};
const session='test-session-'.repeat(8);

describe('Codex adversarial review', () => {
  it.each(['https://good.example/path','https://user:pass@good.example','https://good.example?scope=x','https://good.example,invalid'])('fails closed on malformed trusted-origin config: %s', value => {
    expect(trustedOrigins({PARALLAX_TRUSTED_ORIGINS:value})).toEqual([]);
  });
  it('rejects noncanonical CSRF expiry encoding even with the same numeric value', () => {
    const token=issueCsrfToken(session,{env,nowMs:1700000000000});
    if(!token.ok) throw new Error('fixture');
    const pieces=token.token.split('.'); pieces[1]='0'+pieces[1];
    expect(verifyCsrfToken(pieces.join('.'),session,{env,nowMs:1700000000000}).ok).toBe(false);
  });
  it.each(['custom','anonymous',undefined])('does not turn %s provider identity into Ramon', async provider => {
    sdkSession.mockResolvedValue({uid:OWNER,signInProvider:provider});
    const r=await requireOwnerIdentity(new Request('https://good.example',{headers:{cookie:`__session=${session}`}}),{env});
    expect(r.ok).toBe(false);
  });
  it('rejects a null Telegram body without throwing or dispatching', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','test-transport-secret');
    const req=new NextRequest('https://good.example',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-transport-secret'},body:'null'});
    const res=await telegram(req);expect(res.status).toBe(400);
  });
  it('does not label a null tenant and malformed budget as a compatible envelope', () => {
    const result=validateEnvelopeShape({taskId:'t',taskVersion:'v',projectId:'p',tenantId:undefined,payloadSha256:'no-digest',target:'x',scope:['x'],budget:{unit:'usd',limit:NaN},evidenceVersion:'v',idempotencyKey:'k',expiresAt:'nonsense',provenance:{requestedBy:'agent:x',approvedBy:'human:ramon'},actionClass:4});
    expect(result.ok).toBe(false);
  });
});
