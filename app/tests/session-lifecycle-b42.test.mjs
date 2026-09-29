import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {FileSessionRevocationStore,sidHash} from '../server/session-revocation-store.mjs';
import {SessionCommitContext} from '../server/session-commit-context.mjs';
import {RuntimeMetrics,instrumentPersistence} from '../server/runtime-metrics.mjs';
import {createLocalAuth} from '../server/local-auth.mjs';
import {createLocalServer} from '../local-server.mjs';

const SECRET='b42-session-secret-with-at-least-32-characters';
const response=()=>({status:null,headers:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(){}});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const close=ws=>new Promise(resolve=>{if(!ws||ws.readyState===WebSocket.CLOSED)return resolve();ws.once('close',resolve);ws.close();});

test('revocation journal survives adapter restart and concurrent OS processes without raw session IDs',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b42-journal-')),file=path.join(dir,'revocations.json'),expiry=Math.floor(Date.now()/1000)+3600;
 try{
  const first=new FileSessionRevocationStore({filePath:file}),session={sid:'session-A-abcdefghijklmnop',exp:expiry};await first.revoke(session);
  assert.equal(await new FileSessionRevocationStore({filePath:file}).isRevoked(session),true);
  const moduleUrl=new URL('../server/session-revocation-store.mjs',import.meta.url).href,children=[];
  for(let index=0;index<4;index++)children.push(new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--input-type=module','--eval',`import {FileSessionRevocationStore} from ${JSON.stringify(moduleUrl)};await new FileSessionRevocationStore({filePath:process.env.PV_FILE}).revoke({sid:process.env.PV_SID,exp:Number(process.env.PV_EXP)});`],{env:{...process.env,PV_FILE:file,PV_SID:`session-${index}-abcdefghijklmnop`,PV_EXP:String(expiry)},stdio:'pipe'});
   let error='';child.stderr.on('data',chunk=>{error+=chunk;});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(error||`child ${code}`)));
  }));
  await Promise.all(children);const stored=JSON.parse(await readFile(file,'utf8'));assert.equal(Object.keys(stored.entries).length,5);
  assert.equal(JSON.stringify(stored).includes('session-A'),false);assert.equal(stored.entries[sidHash(session.sid)],expiry);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('commit gate rejects expiry or revocation that happens after action admission but before storage mutation',async()=>{
 let timestamp=2_000_000_000_000;const dir=await mkdtemp(path.join(tmpdir(),'pv-b42-commit-')),store=new FileSessionRevocationStore({filePath:path.join(dir,'revocations.json'),now:()=>timestamp}),auth=createLocalAuth({env:{AUTH_SESSION_SECRET:SECRET},now:()=>timestamp,revocationStore:store});
 const session={accountId:'dev:gate',playerId:'gate',roomId:'aether-gate',name:'Gate',provider:'local',sid:'commit-boundary-abcdefgh',exp:Math.floor(timestamp/1000)+1},context=new SessionCommitContext({authorize:value=>auth.sessionStatus(value)});let writes=0;
 const storage=instrumentPersistence({async save(){writes++;}},new RuntimeMetrics(),['save'],()=>{},()=>{},()=>context.beforeCommit());
 try{
  await assert.rejects(()=>context.run(session,async()=>{assert.equal(await auth.sessionActive(session),true);timestamp=session.exp*1000;await storage.save();}),error=>error.code==='AUTH_EXPIRED');assert.equal(writes,0);
  timestamp=2_000_000_000_000;session.exp=Math.floor(timestamp/1000)+3600;session.sid='revoked-boundary-abcdef';
  await assert.rejects(()=>context.run(session,async()=>{assert.equal(await auth.sessionActive(session),true);await store.revoke(session);await storage.save();}),error=>error.code==='AUTH_REVOKED');assert.equal(writes,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('revocation-store failure fails authentication closed and clears the logout cookie',async()=>{
 const unavailable={async isRevoked(){throw Error('private upstream detail');},async revoke(){throw Error('private upstream detail');}},auth=createLocalAuth({env:{AUTH_SESSION_SECRET:SECRET,AUTH_ALLOW_LOCAL_BETA:'true'},revocationStore:unavailable});
 const login=response(),request={method:'POST',headers:{cookie:''},[Symbol.asyncIterator]:async function*(){yield Buffer.from('legacyPlayerId=fail-closed');}};await auth.handle(request,login,new URL('http://localhost/api/auth/dev'));const cookie=/pv_session=[^;]+/.exec(login.headers['Set-Cookie'])?.[0];assert.ok(cookie);
 await assert.rejects(()=>auth.authenticate({headers:{cookie}}),error=>error.code==='AUTH_REVOCATION_STORE_UNAVAILABLE'&&error.statusCode===503);
 const logout=response();await auth.handle({method:'POST',headers:{cookie}},logout,new URL('http://localhost/api/auth/logout'));assert.equal(logout.status,503);assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
});

test('logout on one server closes another server socket and remains revoked after restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b42-servers-')),env={AUTH_SESSION_SECRET:SECRET,AUTH_ALLOW_LOCAL_BETA:'true'},a=createLocalServer({saveDir:dir,authRequired:true,authEnv:env}),b=createLocalServer({saveDir:dir,authRequired:true,authEnv:env});let ws,c;
 try{
  const [portA,portB]=await Promise.all([a.listen(0),b.listen(0)]),login=await fetch(`http://127.0.0.1:${portA}/api/auth/dev`,{method:'POST',body:new URLSearchParams({legacyPlayerId:'b42-user'}),redirect:'manual'}),cookie=/pv_session=[^;]+/.exec(login.headers.get('set-cookie'))?.[0];assert.ok(cookie);
  ws=new WebSocket(`ws://127.0.0.1:${portB}/ws/aether-b42-user`,{headers:{Cookie:cookie}});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const state=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('state timeout')),5000);ws.on('message',raw=>{try{if(JSON.parse(raw).type==='state'){clearTimeout(timer);resolve();}}catch{}});});ws.send(JSON.stringify({type:'join',playerId:'b42-user'}));await state;
  const revoked=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('revocation sweep timeout')),4000);ws.once('close',(code,reason)=>{clearTimeout(timer);resolve({code,reason:String(reason)});});});
  const logout=await fetch(`http://127.0.0.1:${portA}/api/auth/logout`,{method:'POST',headers:{Cookie:cookie},redirect:'manual'});assert.equal(logout.status,303);const dropped=await revoked;assert.equal(dropped.code,4001);assert.match(dropped.reason,/revoked/);
  await Promise.all([a.close(),b.close()]);c=createLocalServer({saveDir:dir,authRequired:true,authEnv:env});const portC=await c.listen(0),session=await fetch(`http://127.0.0.1:${portC}/api/auth/session`,{headers:{Cookie:cookie}}).then(res=>res.json());assert.equal(session.authenticated,false);
 }finally{await close(ws);await a.close();await b.close();await c?.close();await wait(10);await rm(dir,{recursive:true,force:true});}
});
