import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createPublicOriginPolicy} from '../server/public-origin-policy.mjs';
import {createLocalServer} from '../local-server.mjs';

const SECRET='test-session-secret-with-at-least-32-characters';
const request=(headers={},remoteAddress='127.0.0.1',url='/path')=>({url,headers:{host:'internal:3100',...headers},socket:{remoteAddress}});

test('public origin policy validates canonical origins and only trusts configured proxies',()=>{
 assert.throws(()=>createPublicOriginPolicy({env:{PUBLIC_ORIGIN:'https://play.example/path'}}),/only an http\(s\) origin/);
 assert.throws(()=>createPublicOriginPolicy({env:{PV_TRUSTED_PROXY_IPS:'proxy.local'}}),/invalid IP/);
 const policy=createPublicOriginPolicy({env:{PUBLIC_ORIGIN:'https://play.example',PV_TRUSTED_PROXY_IPS:'127.0.0.1'}});
 const proxied=request({origin:'https://play.example','x-forwarded-for':'203.0.113.9, 127.0.0.1'});
 assert.equal(policy.requestUrl(proxied).origin,'https://play.example');
 assert.equal(policy.originAllowed(proxied),true);
 assert.equal(policy.clientIp(proxied),'203.0.113.9');
 assert.equal(policy.clientIp(request({'x-forwarded-for':'203.0.113.9'},'198.51.100.4')),'198.51.100.4');
 assert.equal(policy.browserMutationAllowed(request({origin:'https://evil.example'})),false);
 assert.equal(policy.browserMutationAllowed(request({'sec-fetch-site':'cross-site'})),false);
});

test('HTTPS public origin controls OAuth callback and Secure flow cookie',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-origin-b10-'));
 const app=createLocalServer({saveDir:dir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:SECRET,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',SUPABASE_SECRET_KEY:'secret',PUBLIC_ORIGIN:'https://play.example'}});
 try{
  const port=await app.listen(0),response=await fetch(`http://127.0.0.1:${port}/api/auth/google/start`,{redirect:'manual'});
  assert.equal(response.status,303);
  assert.equal(new URL(response.headers.get('location')).searchParams.get('redirect_to'),'https://play.example/auth/callback');
  assert.match(response.headers.get('set-cookie'),/; Secure/);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('browser mutations and websocket upgrades reject a forged origin',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-csrf-b10-'));
 const app=createLocalServer({saveDir:dir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:SECRET,AUTH_ALLOW_LOCAL_BETA:'true',PUBLIC_ORIGIN:'https://play.example'}});
 try{
  const port=await app.listen(0),login=await fetch(`http://127.0.0.1:${port}/api/auth/dev`,{method:'POST',redirect:'manual',headers:{origin:'https://evil.example','content-type':'application/x-www-form-urlencoded'},body:'legacyPlayerId=tester'});
  assert.equal(login.status,403);
  await assert.rejects(new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/test`,{origin:'https://evil.example'});ws.once('open',resolve);ws.once('error',reject);}),/Unexpected server response: 403/);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('OAuth exchange has a bounded upstream deadline',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-oauth-deadline-b10-'));
 const authFetch=(_url,{signal}={})=>new Promise((resolve,reject)=>signal?.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}));
 const app=createLocalServer({saveDir:dir,authRequired:true,authFetch,authEnv:{AUTH_SESSION_SECRET:SECRET,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',SUPABASE_SECRET_KEY:'secret',PV_OAUTH_TIMEOUT_MS:'100'}});
 try{
  const port=await app.listen(0),start=await fetch(`http://127.0.0.1:${port}/api/auth/google/start`,{redirect:'manual'}),flow=start.headers.get('set-cookie').split(';')[0];
  const began=Date.now(),callback=await fetch(`http://127.0.0.1:${port}/auth/callback?code=test`,{redirect:'manual',headers:{cookie:flow}});
  assert.equal(callback.status,303);assert.match(callback.headers.get('location'),/auth_error=oauth_timeout/);assert.ok(Date.now()-began<2000);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('OAuth deadline also bounds a stalled token response body',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-oauth-body-b10-'));
 const authFetch=async()=>new Response(new ReadableStream({start(){}}),{status:200,headers:{'content-type':'application/json'}});
 const app=createLocalServer({saveDir:dir,authRequired:true,authFetch,authEnv:{AUTH_SESSION_SECRET:SECRET,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',SUPABASE_SECRET_KEY:'secret',PV_OAUTH_TIMEOUT_MS:'100'}});
 try{
  const port=await app.listen(0),start=await fetch(`http://127.0.0.1:${port}/api/auth/google/start`,{redirect:'manual'}),flow=start.headers.get('set-cookie').split(';')[0];
  const callback=await fetch(`http://127.0.0.1:${port}/auth/callback?code=test`,{redirect:'manual',headers:{cookie:flow}});
  assert.equal(callback.status,303);assert.match(callback.headers.get('location'),/auth_error=oauth_timeout/);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('close is idempotent before listen',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-close-b10-')),app=createLocalServer({saveDir:dir,shutdownDeadlineMs:100});
 try{await Promise.all([app.close(),app.close()]);}finally{await rm(dir,{recursive:true,force:true});}
});

test('graceful close stops an active websocket and remains bounded',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-live-close-b10-')),app=createLocalServer({saveDir:dir,shutdownDeadlineMs:500});
 try{
  const port=await app.listen(0),ws=new WebSocket(`ws://127.0.0.1:${port}/ws/shutdown-test`);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const closed=new Promise(resolve=>ws.once('close',resolve)),began=Date.now();await Promise.all([app.close(),app.close()]);await closed;
  assert.ok(Date.now()-began<2000);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
