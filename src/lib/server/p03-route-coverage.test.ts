import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { issueCsrfToken } from './csrf';
const { sessionVerifier } = vi.hoisted(() => ({sessionVerifier: vi.fn()}));
vi.mock('@/lib/firebase-admin', async importOriginal => ({...await importOriginal<object>(), verifySessionCookie: sessionVerifier}));
const ROOT=path.resolve('src/app/api');
function files(dir:string):string[] { return readdirSync(dir,{withFileTypes:true}).flatMap(e=> e.isDirectory()?files(path.join(dir,e.name)):e.name==='route.ts'?[path.join(dir,e.name)]:[]); }
const routes=[...files(path.join(ROOT,'command-center')),...files(path.join(ROOT,'bridge'))];
const OWNER='owner_fixture_only';const COOKIE='fixture-session-'.repeat(5);const SECRET='fixture-not-a-real-secret-'.repeat(3);const ORIGIN='https://cockpit.example';
beforeEach(()=> {vi.stubEnv('PARALLAX_OWNER_UID',OWNER);vi.stubEnv('PARALLAX_TRUSTED_ORIGINS',ORIGIN);vi.stubEnv('PARALLAX_CSRF_SECRET',SECRET);sessionVerifier.mockResolvedValue({uid:OWNER,signInProvider:'password'});});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe('Every cockpit route denies independently of middleware',()=>{
 it('places each canonical guard before handler work, including reads and streams',()=>{
  for(const file of routes){
   const rel=path.relative(ROOT,file);
   if(['command-center/telegram/webhook/route.ts','command-center/auth/pin/route.ts'].includes(rel))continue;
   const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
   for(const fn of source.statements){
    if(!ts.isFunctionDeclaration(fn)||!fn.name||!fn.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||! /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(fn.name.text))continue;
    const required=['GET','HEAD','OPTIONS'].includes(fn.name.text)?'guardPrivateRead':'guardProtectedMutation';
    expect(fn.body?.statements[0]?.getText(source), rel+' '+fn.name.text).toMatch(new RegExp('await '+required+'\\('));
    expect(fn.body?.statements[1]?.getText(source), rel+' denial return').toMatch(/if \(!\w+\.ok\) return \w+\.response/);
   }
  }
 });
 for(const file of routes){
  const relative=path.relative(ROOT,file);
  if(['command-center/telegram/webhook/route.ts','command-center/auth/pin/route.ts'].includes(relative))continue;
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const methods=source.statements.flatMap(s=>ts.isFunctionDeclaration(s)&&s.name&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(s.name.text)?[s.name.text]:[]);
  // revenue delegates GET to stripe-revenue; dynamic call exercises that re-export too.
  if(relative==='command-center/revenue/route.ts')methods.push('GET');
  for(const method of methods){
   const mutation=!['GET','HEAD','OPTIONS'].includes(method);
   for(const scenario of ['unauthenticated','wrong-identity','expired-or-revoked',...(mutation?['wrong-origin','missing-csrf','cross-session-replay']:[])]){
    it(`${relative} ${method} denies ${scenario} before side effects`,async()=>{
     const routeModule=await import(file);
     const headers:Record<string,string>={origin:ORIGIN,'content-type':'application/json','x-ramon-uid':OWNER,'x-forwarded-host':'command.parallaxvinc.com'};
     if(scenario!=='unauthenticated')headers.cookie=`__session=${COOKIE}`;
     if(scenario==='wrong-identity')sessionVerifier.mockResolvedValue({uid:'someone_else',signInProvider:'password'});
     if(scenario==='expired-or-revoked')sessionVerifier.mockResolvedValue(null);
     if(scenario==='wrong-origin')headers.origin='https://cockpit.example.evil';
     if(scenario==='cross-session-replay'){const token=issueCsrfToken('different-session');if(token.ok)headers['x-parallax-csrf']=token.token;}
     const req=new NextRequest(`${ORIGIN}/api/${relative.replace('/route.ts','')}`,{method,headers,...(mutation?{body:JSON.stringify({uid:OWNER,role:'owner',from:'ramon',approvedBy:'ramon',authenticated:true})}:{})});
     const response=await routeModule[method](req,{params:Promise.resolve({id:'fixture'})});
     expect([401,403]).toContain(response.status);
     expect(response.headers.get('cache-control')).toBe('no-store');
     expect(await response.json()).toMatchObject({error:'denied'});
    });
   }
  }
 }
});
