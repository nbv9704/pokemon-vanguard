import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {RankedService,ensureRankedState} from '../server/ranked-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',now=Date.UTC(2026,8,27,10);
const state=()=>{const s={schemaVersion:3,owner:'Tester',wallet:{coins:0,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)};ensureRankedState(s);return s;};
const make=(storage,live,{failAfterCommit=false}={})=>new RankedService({catalog:v3Catalog,clock:{now:()=>now},getState:id=>live.get(id),loadState:id=>storage.load(id),persist:async(id,value)=>storage.save(id,value),persistPair:async(entries,id)=>{await storage.savePair(entries,id);if(failAfterCommit)throw Error('SETTLEMENT_ACK_LOST');},publishState:(id,value)=>live.set(id,value),notify:()=>{},withAccounts:async(_ids,work)=>work()});
const session={provider:'google',name:'Trainer'};
async function ready(service){service.register(a,session);service.register(b,session);assert.equal((await service.action(a,session,{type:'rankedV1.queue.join',mode:'single'})).ok,true);assert.equal((await service.action(b,session,{type:'rankedV1.queue.join',mode:'single'})).ok,true);return service.matches.get(service.playerMatch.get(a));}

test('Ranked JSON settlement receipts recover lost response without applying RP twice',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-ranked-recovery-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[a,state()],[b,state()]]);for(const [id,value] of live)await storage.save(id,value);
  const failed=make(storage,live,{failAfterCommit:true}),match=await ready(failed),matchId=match.id;
  await assert.rejects(failed.action(a,session,{type:'rankedV1.surrender',actionId:'retry:forfeit'}),/SETTLEMENT_ACK_LOST/);
  assert.equal(live.get(a).rankedV1.rating,1000);assert.equal(match.settled,false);
  assert.deepEqual(await failed.action(a,session,{type:'rankedV1.surrender',actionId:'retry:forfeit',unexpected:'different-payload'}),{ok:false,code:'RANKED_ACTION_ID_CONFLICT'});
  assert.deepEqual(await failed.action(b,session,{type:'rankedV1.surrender',actionId:'opponent-forfeit'}),{ok:false,code:'SETTLEMENT_PENDING'});
  const savedA=await storage.load(a),savedB=await storage.load(b);
  assert.equal(savedA.rankedV1.rating,984);assert.equal(savedB.rankedV1.rating,1016);
  assert.equal(savedA.rankedSettlementReceiptsV1[0].key,savedB.rankedSettlementReceiptsV1[0].key);
  failed.persistPair=async()=>{throw Error('MUST_NOT_COMMIT_AGAIN');};
  assert.equal((await failed.action(a,session,{type:'rankedV1.surrender',actionId:'retry:forfeit'})).ok,true);
  assert.equal(match.settled,true);assert.equal(live.get(a).rankedV1.matches,1);assert.equal(live.get(b).rankedV1.matches,1);
  // A clean server has no live match, but can show the committed result.
  const freshLive=new Map([[a,await storage.load(a)],[b,await storage.load(b)]]),fresh=make(new JsonAdventureStorage(folder),freshLive);
  const recovered=fresh.viewFor(a,freshLive.get(a));assert.equal(recovered.status,'finished');assert.equal(recovered.recovered,true);assert.equal(recovered.match.id,matchId);assert.equal(recovered.result.outcome,'loss');assert.equal(recovered.result.ratingDelta,-16);
  assert.deepEqual(await fresh.action(a,session,{type:'rankedV1.dismiss'}),{ok:true});assert.equal(fresh.viewFor(a,freshLive.get(a)).status,'idle');
  assert.equal((await storage.load(a)).rankedSettlementReceiptsV1[0].dismissedAt,now);
  const code=await readFile(new URL('../local-server.mjs',import.meta.url),'utf8');assert.match(code,/rankedSettlementReceiptsV1:_privateRankedSettlementReceiptsV1/);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('Ranked receipt mismatch across two saves fails closed instead of replaying settlement',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-ranked-mismatch-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[a,state()],[b,state()]]);for(const [id,value] of live)await storage.save(id,value);
  const failed=make(storage,live,{failAfterCommit:true}),match=await ready(failed);
  await assert.rejects(failed.action(a,session,{type:'rankedV1.surrender',actionId:'forfeit'}),/SETTLEMENT_ACK_LOST/);
  const original=await storage.load(b),changed=structuredClone(original);delete changed.rankedSettlementReceiptsV1;await storage.save(b,changed);
  await assert.rejects(failed.action(a,session,{type:'rankedV1.surrender',actionId:'forfeit'}),error=>error.code==='RANKED_SETTLEMENT_RECEIPT_CONFLICT');
  assert.equal(live.get(a).rankedV1.rating,1000);assert.equal(match.settled,false);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('Ranked lifecycle tick recovers an already committed settlement without another pair write',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-ranked-tick-recovery-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[a,state()],[b,state()]]);
  for(const [id,value] of live)await storage.save(id,value);
  const failed=make(storage,live,{failAfterCommit:true}),match=await ready(failed),original={type:'rankedV1.surrender',actionId:'original-surrender'};
  await assert.rejects(failed.action(a,session,original),/SETTLEMENT_ACK_LOST/);
  failed.persistPair=async()=>{throw Error('SECOND_PAIR_WRITE_FORBIDDEN');};
  await failed.tick();
  assert.equal(match.settled,true);assert.equal(live.get(a).rankedV1.rating,984);
  assert.equal(live.get(b).rankedV1.rating,1016);
  assert.deepEqual(await failed.action(a,session,original),{ok:true,duplicate:true});
  assert.deepEqual(await failed.action(b,session,{type:'rankedV1.surrender',actionId:'new-surrender'}),{ok:false,code:'WRONG_PHASE'});
  assert.equal((await storage.load(a)).rankedSettlementReceiptsV1.length,1);
 }finally{await rm(folder,{recursive:true,force:true});}
});
