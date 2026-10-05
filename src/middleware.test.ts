import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const {verify}=vi.hoisted(()=>({verify:vi.fn()}));
vi.mock('@/lib/firebase-admin',()=>({verifySessionCookie:verify}));
import { middleware } from './middleware';
beforeEach(()=>{vi.stubEnv('PARALLAX_OWNER_UID','fixture_owner');verify.mockResolvedValue({uid:'fixture_owner',signInProvider:'password'});});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it.each(['command.parallaxvinc.com','command.evil.example','localhost','node.ts.net'])('hostname %s cannot authenticate',async host=>{const r=await middleware(new NextRequest('https://'+host+'/command-center',{headers:{'x-forwarded-host':'command.parallaxvinc.com'}}));expect(r.headers.get('location')).toContain('/command-login');expect(verify).not.toHaveBeenCalled();});
it('protects the static status fallback',async()=>{expect((await middleware(new NextRequest('https://cockpit.example/status.json'))).status).toBe(401);});
it('allows a verified owner with no hostname identity inference',async()=>{const r=await middleware(new NextRequest('https://cockpit.example/command-center',{headers:{cookie:'__session='+'fixture-cookie-'.repeat(4)}}));expect(r.headers.get('x-middleware-next')).toBe('1');expect(r.headers.get('cache-control')).toContain('no-store');});
it('denies wrong identity even on canonical host',async()=>{verify.mockResolvedValue({uid:'wrong-owner',signInProvider:'password'});const r=await middleware(new NextRequest('https://command.parallaxvinc.com/command-center',{headers:{cookie:'__session='+'fixture-cookie-'.repeat(4)}}));expect(r.headers.get('location')).toContain('/command-login');});

// P06 M5C: Parallax OS must never open the public marketing homepage. The cockpit runs `next start -H 127.0.0.1`, so the
// request URL carries the bound address and only the Host header (forwarded by the Cloudflare tunnel) names the host.
const OWNER_COOKIE={cookie:'__session='+'fixture-cookie-'.repeat(4)};
const atRoot=(host:string,extra:Record<string,string>={},path='/')=>middleware(new NextRequest('http://127.0.0.1:3000'+path,{headers:{host,...extra}}));
const loc=(r:Response)=>r.headers.get('location')??'';
it.each(['command.parallaxvinc.com','COMMAND.parallaxvinc.com','command.parallaxvinc.com:443','command.parallaxvinc.com.'])('command host root (%s) never renders the marketing page: logged out goes to login',async host=>{
  const r=await atRoot(host);
  expect(r.status).toBe(307);expect(r.headers.get('x-middleware-next')).toBeNull();
  expect(new URL(loc(r)).pathname).toBe('/command-login');expect(r.headers.get('cache-control')).toContain('no-store');
});
it('command host root with an owner session goes to /command-center, also with a query string',async()=>{
  expect(new URL(loc(await atRoot('command.parallaxvinc.com',OWNER_COOKIE))).pathname).toBe('/command-center');
  const q=await atRoot('command.parallaxvinc.com',OWNER_COOKIE,'/?utm_source=bookmark');
  expect(new URL(loc(q)).pathname).toBe('/command-center');
});
it('command host root with a wrong-owner session still goes to login, not the cockpit',async()=>{
  verify.mockResolvedValue({uid:'wrong-owner',signInProvider:'password'});
  expect(new URL(loc(await atRoot('command.parallaxvinc.com',OWNER_COOKIE))).pathname).toBe('/command-login');
});
it('on the cockpit deployment, root enters the owner flow whatever the Host header says',async()=>{
  vi.stubEnv('NEXT_DIST_DIR','.next-cc');
  for (const host of ['127.0.0.1:3000','localhost:3000','parallaxvinc.com']) expect(new URL(loc(await atRoot(host))).pathname).toBe('/command-login');
});
it('the public hostname still serves the public website at root',async()=>{
  for (const host of ['parallaxvinc.com','www.parallaxvinc.com','command.parallaxvinc.com.evil.example']) {
    const r=await atRoot(host);expect(r.headers.get('x-middleware-next')).toBe('1');expect(r.headers.get('location')).toBeNull();
  }
});
it('the entry flow has no redirect loop: every hop ends on a page that renders',async()=>{
  for (const cookie of [{},OWNER_COOKIE]) {
    let path='/';const seen:string[]=[];
    for (let i=0;i<5;i++){
      const r=await atRoot('command.parallaxvinc.com',cookie,path);
      if(r.headers.get('x-middleware-next')==='1') break;
      path=new URL(loc(r)).pathname;expect(seen).not.toContain(path);seen.push(path);
    }
    expect(seen.length).toBeLessThanOrEqual(2);
    expect(path).toBe(Object.keys(cookie).length?'/command-center':'/command-login');
  }
});
it('/command-login stays the owner login, and /command-center stays owner-only, on the command host',async()=>{
  expect((await atRoot('command.parallaxvinc.com',{},'/command-login')).headers.get('x-middleware-next')).toBe('1');
  expect(new URL(loc(await atRoot('command.parallaxvinc.com',OWNER_COOKIE,'/command-login'))).pathname).toBe('/command-center');
  expect(new URL(loc(await atRoot('command.parallaxvinc.com',{},'/command-center'))).pathname).toBe('/command-login');
});
