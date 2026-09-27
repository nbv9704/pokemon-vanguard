import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {HybridAdventureStorage,SupabaseAdventureStorage} from '../server/storage-supabase.mjs';
import {setup,applyAction} from '../server/legacy/logic-v1.js';
import {migrateV1ToV2} from '../server/migrations.mjs';

const identities=JSON.parse(await readFile(new URL('../content/species-identities.json',import.meta.url),'utf8'));

test('JSON storage saves atomically, backs up and restores validated state',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'aether-storage-')),backups=path.join(root,'backups'),storage=new JsonAdventureStorage(path.join(root,'saves'));
 try{
  assert.equal(await storage.load('room'),null);await storage.save('room',{owner:'one',coins:10});
  const backup=await storage.backup('room',backups,'before-test');await storage.save('room',{owner:'one',coins:20});
  const secondBackup=await storage.backup('room',backups,'before-test');assert.notEqual(secondBackup,backup);assert.equal((await readdir(backups)).length,2);
  assert.equal((await storage.load('room')).coins,20);assert.equal((await storage.restore('room',backup)).coins,10);assert.equal((await storage.load('room')).coins,10);
  await assert.rejects(storage.load('../escape'),/Invalid adventure room name/);
  await writeFile(storage.pathFor('broken'),'{bad json');await assert.rejects(storage.load('broken'),/JSON/);assert.equal(await readFile(storage.pathFor('broken'),'utf8'),'{bad json');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('JSON storage rejects future schemas and invalid balances without replacing a valid save',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pv-storage-validation-')),storage=new JsonAdventureStorage(root),valid={schemaVersion:3,owner:'one',wallet:{coins:10,crystals:2,recruitmentTickets:1}};try{await storage.save('room',valid);await assert.rejects(storage.save('room',{...valid,schemaVersion:99}),/Unsupported adventure save schema/);assert.deepEqual(await storage.load('room'),valid);await assert.rejects(storage.save('room',{...valid,wallet:{...valid.wallet,coins:Infinity}}),/Invalid adventure wallet balance/);assert.deepEqual(await storage.load('room'),valid);await writeFile(storage.pathFor('future'),JSON.stringify({...valid,schemaVersion:4}));await assert.rejects(storage.load('future'),/Unsupported adventure save schema/);}finally{await rm(root,{recursive:true,force:true});}
});

test('Supabase storage persists authenticated UUID saves while beta rooms stay local',async()=>{
 const rows=new Map(),backups=[],calls=[],fetchImpl=async(url,init={})=>{calls.push({url:String(url),init});const target=new URL(url),body=init.body?JSON.parse(init.body):null;if(target.pathname.endsWith('/game_saves')){const userId=target.searchParams.get('user_id')?.replace(/^eq\./,'');if(init.method==='POST'){if(rows.has(body.user_id))return new Response(null,{status:409});rows.set(body.user_id,{state:body.state,revision:0});return Response.json([{revision:0}],{status:201});}if(init.method==='PATCH'){const row=rows.get(userId),expected=Number(target.searchParams.get('revision')?.replace(/^eq\./,''));if(!row||row.revision!==expected)return Response.json([]);row.state=body.state;row.revision++;return Response.json([{revision:row.revision}]);}const row=rows.get(userId);return Response.json(row?[row]:[]);}if(target.pathname.endsWith('/game_save_backups')&&init.method==='POST'){const row={id:backups.length+1,...body};backups.push(row);return Response.json([row],{status:201});}return Response.json([]);};
 const root=await mkdtemp(path.join(os.tmpdir(),'aether-hybrid-storage-')),local=new JsonAdventureStorage(root),remote=new SupabaseAdventureStorage({url:'https://project.supabase.co',secretKey:'server-secret',fetchImpl}),storage=new HybridAdventureStorage({local,remote}),userId='33333333-3333-4333-8333-333333333333';
 try{
  assert.equal(await storage.load(userId),null);await storage.save(userId,{schemaVersion:3,coins:50});assert.equal((await storage.load(userId)).coins,50);assert.equal(calls[0].init.headers.apikey,'server-secret');
  await storage.save('aether-local-player',{coins:10});assert.equal((await storage.load('aether-local-player')).coins,10);assert.equal(calls.length,3);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('Supabase storage rejects stale writers with optimistic revision checks',async()=>{
 const userId='55555555-5555-4555-8555-555555555555',row={state:{schemaVersion:3,coins:10},revision:4},fetchImpl=async(url,init={})=>{const target=new URL(url);if(!init.method)return Response.json([{state:structuredClone(row.state),revision:row.revision}]);if(init.method==='PATCH'){const expected=Number(target.searchParams.get('revision').replace(/^eq\./,''));if(expected!==row.revision)return Response.json([]);row.state=JSON.parse(init.body).state;row.revision++;return Response.json([{revision:row.revision}]);}return new Response(null,{status:500});},first=new SupabaseAdventureStorage({url:'https://project.supabase.co',secretKey:'server-secret',fetchImpl}),stale=new SupabaseAdventureStorage({url:'https://project.supabase.co',secretKey:'server-secret',fetchImpl});
 await first.load(userId);await stale.load(userId);await first.save(userId,{schemaVersion:3,coins:20});await assert.rejects(stale.save(userId,{schemaVersion:3,coins:30}),error=>error.code==='STORAGE_REVISION_CONFLICT');assert.equal(row.state.coins,20);assert.equal(row.revision,5);
});

test('Supabase storage sends two loaded saves through one atomic pair RPC',async()=>{
 const left='11111111-1111-4111-8111-111111111111',right='22222222-2222-4222-8222-222222222222',rows=new Map([[left,{state:{schemaVersion:3,coins:10},revision:2}],[right,{state:{schemaVersion:3,coins:20},revision:7}]]),calls=[],fetchImpl=async(url,init={})=>{const target=new URL(url),body=init.body?JSON.parse(init.body):null;calls.push({target,init,body});if(target.pathname.endsWith('/game_saves')){const userId=target.searchParams.get('user_id').replace(/^eq\./,'');return Response.json([structuredClone(rows.get(userId))]);}if(target.pathname.endsWith('/rpc/save_game_state_pair')){assert.equal(init.method,'POST');assert.equal(body.p_operation_id,'ranked:settlement:test');assert.equal(body.p_left_expected_revision,2);assert.equal(body.p_right_expected_revision,7);assert.match(body.p_fingerprint,/^[0-9a-f]{64}$/);return Response.json([{left_revision:3,right_revision:8,duplicate:false}]);}return new Response(null,{status:404});},storage=new SupabaseAdventureStorage({url:'https://project.supabase.co',secretKey:'server-secret',fetchImpl});
 await storage.load(right);await storage.load(left);const result=await storage.savePair([{userId:right,state:{schemaVersion:3,coins:18}},{userId:left,state:{schemaVersion:3,coins:12}}],'ranked:settlement:test');assert.deepEqual(result,{duplicate:false});assert.equal(calls.length,3);assert.equal(storage.revisions.get(left),3);assert.equal(storage.revisions.get(right),8);
});


test('authenticated UUID accounts never silently fall back to local JSON when cloud storage is missing',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pv-account-storage-')),local=new JsonAdventureStorage(root),remote=new SupabaseAdventureStorage({url:'',secretKey:''}),storage=new HybridAdventureStorage({local,remote}),userId='44444444-4444-4444-8444-444444444444';
 try{assert.throws(()=>storage.save(userId,{schemaVersion:3}),/Supabase account save storage is required/);assert.equal(await local.load(userId),null);}finally{await rm(root,{recursive:true,force:true});}
});

test('v1 migration preserves progression and is idempotent',()=>{
 const v1=setup(['migration-owner']);v1.coins=3210;v1.gems=777;v1.pity=12;v1.summons=18;v1.wins=4;v1.badges=[0,1];v1.mail=[0];v1.collection[0].level=9;v1.collection[0].item=4;
 const result=migrateV1ToV2(v1,identities);assert.equal(result.status,'migrated');assert.equal(result.state.schemaVersion,2);
 assert.deepEqual(result.state.wallet,{coins:3210,crystals:777,recruitmentTickets:1});assert.equal(result.state.pity,12);assert.equal(result.state.summons,18);assert.deepEqual(result.state.mailClaims,[0]);assert.equal(result.state.economyVersion,2);assert.deepEqual(result.state.economyLedger,[]);assert.deepEqual(result.state.actionReceipts,[]);assert.equal(result.state.mons[0].legacyLevel,9);assert.equal(result.state.builds[0].itemId,'swift-feather');assert.equal(result.state.teams[0].buildIds.length,6);
 const again=migrateV1ToV2(result.state,identities);assert.equal(again.status,'current');assert.deepEqual(again.state,result.state);
});

test('migration defers an active v1 battle and rejects newer saves',()=>{
 const owner='active-owner',active=applyAction(setup([owner]),owner,{type:'battle',mode:'single'}),before=JSON.stringify(active);
 const result=migrateV1ToV2(active,identities);assert.equal(result.status,'deferred-active-battle');assert.equal(JSON.stringify(result.state),before);
 assert.throws(()=>migrateV1ToV2({schemaVersion:3},identities),/newer/);
});

test('migration preserves builds created by the v2 training sidecar',()=>{
 const v1=setup(['trained-owner']);v1.progressionV2={activeTeamId:'team-custom',builds:[{buildId:'build-custom-1',monId:'mon-emberlyn',name:'Tốc độ',points:{hp:0,atk:16,def:0,spa:0,spd:0,spe:16},alignment:{up:'spe',down:'spa'},abilityId:'quick-start',moveIds:['flame-strike','gale-lance','guard','rally'],itemId:'swift-feather',revision:2}],teams:[{teamId:'team-custom',name:'Đội custom',buildIds:['build-custom-1'],revision:2}]};
 const migrated=migrateV1ToV2(v1,identities).state;assert.equal(migrated.builds[0].name,'Tốc độ');assert.equal(migrated.teams[0].teamId,'team-custom');assert.equal(migrated.activeTeamId,'team-custom');
});
