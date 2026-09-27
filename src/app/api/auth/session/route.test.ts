import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from './route';
import { issueCsrfToken } from '@/lib/server/csrf';
const { create, verify, revoke }=vi.hoisted(()=>({create:vi.fn(),verify:vi.fn(),revoke:vi.fn()}));
vi.mock('@/lib/firebase-admin',()=>({createSessionCookie:create,verifySessionCookie:verify,revokeSession:revoke}));
const origin='https://cockpit.example',cookie='fixture-cookie-'.repeat(4);
beforeEach(()=>{vi.stubEnv('PARALLAX_TRUSTED_ORIGINS',origin);vi.stubEnv('PARALLAX_CSRF_SECRET','fixture-secret-not-real-'.repeat(3));create.mockResolvedValue(cookie);verify.mockResolvedValue({uid:'fixture-owner'});revoke.mockResolvedValue(true);});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
function request(method:string,headers:Record<string,string>={}){return new NextRequest(origin+'/api/auth/session',{method,headers:{origin,'content-type':'application/json','x-parallax-session-exchange':'1',...headers},...(method==='POST'?{body:JSON.stringify({idToken:'fixture-token'})}:{})});}
it('denies login without origin before token exchange',async()=>{expect((await POST(request('POST',{origin:''}))).status).toBe(403);expect(create).not.toHaveBeenCalled();});
it('denies login form/simple request without custom evidence',async()=>{expect((await POST(request('POST',{'x-parallax-session-exchange':''}))).status).toBe(403);expect(create).not.toHaveBeenCalled();});
it('denies login when CSRF is unconfigured before session creation',async()=>{vi.stubEnv('PARALLAX_CSRF_SECRET','');expect((await POST(request('POST'))).status).toBe(503);expect(create).not.toHaveBeenCalled();});
it('sets HttpOnly same-site cookie and returns CSRF with no-store only after exchange',async()=>{const r=await POST(request('POST'));expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toContain('HttpOnly');expect(r.headers.get('set-cookie')).toContain('SameSite=lax');expect(r.headers.get('cache-control')).toBe('no-store');expect((await r.json()).csrfToken).toMatch(/^v1\./);expect(create).toHaveBeenCalledWith('fixture-token',432000000);});
it('does not mint a cookie for an invalid or stale token',async()=>{create.mockResolvedValue(null);const r=await POST(request('POST'));expect(r.status).toBe(401);expect(r.headers.has('set-cookie')).toBe(false);});
it('rejects duplicate cookies before verification',async()=>{expect((await GET(request('GET',{cookie:`__session=${cookie}; __session=${cookie}`}))).status).toBe(401);expect(verify).not.toHaveBeenCalled();});
it('does not revoke without CSRF',async()=>{expect((await DELETE(request('DELETE',{cookie:`__session=${cookie}`}))).status).toBe(403);expect(revoke).not.toHaveBeenCalled();});
it('does not claim successful revocation when provider fails',async()=>{revoke.mockResolvedValue(false);const t=issueCsrfToken(cookie);if(!t.ok)throw Error();expect((await DELETE(request('DELETE',{cookie:`__session=${cookie}`,'x-parallax-csrf':t.token}))).status).toBe(503);});
it('revokes only the verified identity and clears session',async()=>{const t=issueCsrfToken(cookie);if(!t.ok)throw Error();const r=await DELETE(request('DELETE',{cookie:`__session=${cookie}`,'x-parallax-csrf':t.token}));expect(r.status).toBe(200);expect(revoke).toHaveBeenCalledWith('fixture-owner');expect(r.headers.get('set-cookie')).toContain('__session=;');});
