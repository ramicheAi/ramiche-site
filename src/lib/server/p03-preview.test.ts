import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/firebase-admin',()=>({verifySessionCookie:async()=>({uid:'fixture_owner',signInProvider:'password'})}));
vi.mock('fs',()=>({existsSync:()=>true,readFileSync:()=>Buffer.from('<script>/* untrusted fixture */</script>')}));
import { GET } from '@/app/api/command-center/yolo-builds/preview/[...path]/route';
afterEach(()=>vi.unstubAllEnvs());
it('never publicly caches an authenticated preview and gives scripts an opaque origin',async()=>{vi.stubEnv('PARALLAX_OWNER_UID','fixture_owner');const req=new NextRequest('https://cockpit.example/api/command-center/yolo-builds/preview/index.html',{headers:{cookie:'__session='+'fixture-cookie-'.repeat(4)}});const response=await GET(req,{params:Promise.resolve({path:['index.html']})});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('content-security-policy')).toBe('sandbox allow-scripts');});
