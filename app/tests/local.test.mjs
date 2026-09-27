import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { BETA_TEST_WALLET, createLocalServer } from '../local-server.mjs';

async function client(port, player='local-player') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/test`);
  const pending=[], frames=[];
  ws.on('message',raw=>{const m=JSON.parse(raw);const i=pending.findIndex(p=>p.predicate(m));if(i>=0){const p=pending.splice(i,1)[0];clearTimeout(p.timer);p.resolve(m);}else frames.push(m);});
  const next=(predicate=()=>true)=>{const i=frames.findIndex(predicate);if(i>=0)return Promise.resolve(frames.splice(i,1)[0]);return new Promise((resolve,reject)=>{const entry={predicate,resolve,timer:setTimeout(()=>reject(Error('Frame timeout')),3000)};pending.push(entry);});};
  await new Promise(resolve=>ws.once('open',resolve));
  ws.send(JSON.stringify({type:'join',playerId:player}));
  const initial=await next(m=>m.type==='state');
  return {ws,initial,next,action:a=>ws.send(JSON.stringify({type:'action',action:a}))};
}
test('local HTTP, saved rewards, reload after server restart, spectator protection and battles',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-local-'));
  let app=createLocalServer({saveDir});
  try {
    let port=await app.listen(0);
    const response=await fetch(`http://127.0.0.1:${port}/`);assert.equal(response.status,200);assert.match(await response.text(),/Pokémon Vanguard/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/src/logic.js`)).status,404);
    const a=await client(port);assert.equal(a.initial.view.catalog.length,36);
    a.action({type:'mail.claim',mailId:0,actionId:'mail:starter'});assert.equal((await a.next(m=>m.view?.gems===2300)).view.coins,2900);
    a.action({type:'mail.claim',mailId:0,actionId:'mail:starter-2'});assert.equal((await a.next(m=>m.type==='error')).error,'MAIL_ALREADY_CLAIMED');
    const spectator=await client(port,'spectator');assert.equal(spectator.initial.view.spectator,true);assert.equal(spectator.initial.view.trainingV2,undefined);assert.equal(spectator.initial.view.battleV2,undefined);
    spectator.action({type:'summon',count:1});assert.match((await spectator.next(m=>m.type==='error')).error,/spectator/);
    await app.close();app=createLocalServer({saveDir});port=await app.listen(0);
    const b=await client(port);assert.equal(b.initial.view.gems,2300);
    b.action({type:'summon',count:10,actionId:'summon:disabled'});assert.equal((await b.next(m=>m.type==='error')).error,'LEGACY_SUMMON_DISABLED');
    const recruitment=b.initial.view.recruitmentV2,offer=recruitment.offers.find(entry=>entry.ownership==='locked');b.action({type:'recruit.permanent',speciesId:offer.speciesId,payment:'ticket',actionId:'recruit:local-ticket',expectedRevision:recruitment.revision,cycleId:recruitment.cycleId});const recruited=(await b.next(m=>m.view?.recruitmentTickets===3&&m.view?.collection?.length===7)).view;assert.equal(recruited.gems,2300);
    for(const mode of ['single','double']) {
      b.action({type:'battleV2.preview.start',mode,regulationId:'sandbox-v2',difficulty:'normal'});let v=(await b.next(m=>m.view?.battleV2?.phase==='PREVIEW'&&m.view.battleV2.mode===mode)).view;
      b.action({type:'battleV2.preview.lock',buildIds:v.battleV2.playerRoster.slice(0,mode==='double'?4:3).map(mon=>mon.buildId)});v=(await b.next(m=>m.view?.battleV2?.phase==='COMMAND')).view;
      const commands=v.battleV2.snapshot.own.filter(mon=>mon.activeSlot>=0).map(mon=>({kind:'move',actorId:mon.battleMonId,moveId:mon.buildSnapshot.moveIds[0],target:{side:'B',slot:0}}));
      b.action({type:'battleV2.commands',phaseRevision:v.battleV2.snapshot.phaseRevision,commands});v=(await b.next(m=>m.view?.battleV2?.events?.some(event=>event.kind==='turnEnded'))).view;assert.ok(v.battleV2.snapshot.turn>=1);
      if(v.battleV2.phase!=='FINISHED'){b.action({type:'battleV2.surrender'});await b.next(m=>m.view?.battleV2?.phase==='FINISHED');}
    }
  } finally {await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('local beta mode tops new saves up with abundant testing currency',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-beta-funds-')),app=createLocalServer({saveDir,betaTestFunds:true});
  try{
    const port=await app.listen(0),connection=await client(port,'beta-tester');
    assert.deepEqual({coins:connection.initial.view.coins,crystals:connection.initial.view.gems,recruitmentTickets:connection.initial.view.recruitmentTickets},BETA_TEST_WALLET);
    connection.ws.close();
  }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});


test('authenticated mode rejects a missing or weak session secret before listening',()=>{
  assert.throws(()=>createLocalServer({authRequired:true,authEnv:{}}),/AUTH_SESSION_SECRET/);
  assert.throws(()=>createLocalServer({authRequired:true,authEnv:{AUTH_SESSION_SECRET:'test-secret'}}),/at least 32/);
  assert.throws(()=>createLocalServer({authRequired:true,authEnv:{AUTH_SESSION_SECRET:'replace-with-at-least-32-random-characters'}}),/non-default/);
  assert.throws(()=>createLocalServer({authRequired:true,authEnv:{AUTH_SESSION_SECRET:' '.repeat(40)}}),/at least 32/);
});

test('public auth defaults hide Local Beta and OAuth providers until cloud save is fully configured',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'pv-public-auth-')),app=createLocalServer({saveDir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:'test-session-secret-32-characters!!',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable'}});
  try{const port=await app.listen(0),response=await fetch(`http://127.0.0.1:${port}/api/auth/session`),body=await response.json();assert.equal(body.devLogin,false);assert.deepEqual(body.providers,{google:false,discord:false});assert.equal(body.cloudSaveConfigured,false);}finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('authenticated local mode issues an HttpOnly session and rejects anonymous game sockets',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-auth-')),app=createLocalServer({saveDir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:'test-session-secret-32-characters!!',AUTH_ALLOW_LOCAL_BETA:'true'}});
  try{
    const port=await app.listen(0),base=`http://127.0.0.1:${port}`;
    let response=await fetch(`${base}/api/auth/session`),body=await response.json();assert.equal(body.authenticated,false);
    response=await fetch(`${base}/api/auth/dev`,{method:'POST',body:new URLSearchParams({legacyPlayerId:'existing-player'}),redirect:'manual'});assert.equal(response.status,303);const cookie=response.headers.get('set-cookie');assert.match(cookie,/pv_session=/);assert.match(cookie,/HttpOnly/);
    response=await fetch(`${base}/api/auth/session`,{headers:{Cookie:cookie}});body=await response.json();assert.equal(body.authenticated,true);assert.equal(body.user.playerId,'existing-player');assert.equal(body.user.roomId,'aether-existing-player');
    const anonymous=new WebSocket(`ws://127.0.0.1:${port}/ws/aether-existing-player`),closeCode=await new Promise(resolve=>{anonymous.on('unexpected-response',(_,res)=>resolve(res.statusCode));anonymous.on('error',()=>{});});assert.equal(closeCode,401);
  }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('Google Supabase PKCE callback creates a stable account session',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-google-auth-')),authFetch=async url=>String(url).includes('/auth/v1/token')?new Response(JSON.stringify({access_token:'token',user:{id:'11111111-1111-4111-8111-111111111111',email:'trainer@example.test',user_metadata:{full_name:'Test Trainer',avatar_url:'https://example.test/avatar.png'},identities:[{provider:'google',identity_data:{}}]}}),{status:200,headers:{'content-type':'application/json'}}):String(url).includes('/rest/v1/profiles')?new Response(null,{status:201}):new Response(null,{status:404}),app=createLocalServer({saveDir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:'test-session-secret-32-characters!!',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',SUPABASE_SECRET_KEY:'server-secret'},authFetch});
  try{
    const port=await app.listen(0),base=`http://127.0.0.1:${port}`;
    let response=await fetch(`${base}/api/auth/google/start`,{redirect:'manual'});assert.equal(response.status,303);const location=new URL(response.headers.get('location')),flowCookie=/pv_supabase_flow=[^;]+/.exec(response.headers.get('set-cookie'))?.[0];assert.equal(location.hostname,'project.supabase.co');assert.equal(location.searchParams.get('provider'),'google');assert.equal(location.searchParams.get('code_challenge_method'),'s256');assert.ok(flowCookie);
    response=await fetch(`${base}/auth/callback?code=oauth-code`,{headers:{Cookie:flowCookie},redirect:'manual'});assert.equal(response.status,303);const sessionCookie=/pv_session=[^;,]+/.exec(response.headers.get('set-cookie'))?.[0];assert.ok(sessionCookie);
    response=await fetch(`${base}/api/auth/session`,{headers:{Cookie:sessionCookie}});const session=await response.json();assert.equal(session.authenticated,true);assert.equal(session.user.provider,'google');assert.equal(session.user.name,'Test Trainer');assert.equal(session.user.accountId,'11111111-1111-4111-8111-111111111111');
  }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('Discord Supabase PKCE callback creates a stable account session',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-discord-auth-')),authFetch=async url=>String(url).includes('/auth/v1/token')?new Response(JSON.stringify({access_token:'token',user:{id:'22222222-2222-4222-8222-222222222222',user_metadata:{full_name:'Discord Trainer'},identities:[{provider:'discord',identity_data:{}}]}}),{status:200,headers:{'content-type':'application/json'}}):String(url).includes('/rest/v1/profiles')?new Response(null,{status:201}):new Response(null,{status:404}),app=createLocalServer({saveDir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:'test-session-secret-32-characters!!',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',SUPABASE_SECRET_KEY:'server-secret'},authFetch});
  try{
    const port=await app.listen(0),base=`http://127.0.0.1:${port}`;
    let response=await fetch(`${base}/api/auth/discord/start`,{redirect:'manual'}),location=new URL(response.headers.get('location')),flowCookie=/pv_supabase_flow=[^;]+/.exec(response.headers.get('set-cookie'))?.[0];assert.equal(location.hostname,'project.supabase.co');assert.equal(location.searchParams.get('provider'),'discord');assert.ok(flowCookie);
    response=await fetch(`${base}/auth/callback?code=oauth-code`,{headers:{Cookie:flowCookie},redirect:'manual'});const sessionCookie=/pv_session=[^;,]+/.exec(response.headers.get('set-cookie'))?.[0];assert.ok(sessionCookie);
    response=await fetch(`${base}/api/auth/session`,{headers:{Cookie:sessionCookie}});const session=await response.json();assert.equal(session.authenticated,true);assert.equal(session.user.provider,'discord');assert.equal(session.user.name,'Discord Trainer');assert.equal(session.user.accountId,'22222222-2222-4222-8222-222222222222');
  }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});
