import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {PvpRestartRecovery,activeRankedMarker} from '../server/pvp-restart-recovery.mjs';
import {RankedService,ensureRankedState} from '../server/ranked-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {assertSingleCoordinatorEnv} from '../local-server.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',NOW=Date.UTC(2026,9,1,12);
const session=name=>({provider:'google',name});
function state(name){const value={schemaVersion:3,owner:name,wallet:{coins:0,crystals:0,recruitmentTickets:2},progressionV3:createV3BetaProgression(v3Catalog)};ensureRankedState(value);return value;}
function runtime(storage,live,{persistPair}={}){
 const savePair=persistPair||((entries,id)=>storage.savePair(entries,id));
 const recovery=new PvpRestartRecovery({loadState:id=>storage.load(id),persistPair:savePair,publishState:(id,value)=>live.set(id,value),clock:{now:()=>NOW}});
 const service=new RankedService({catalog:v3Catalog,clock:{now:()=>NOW},getState:id=>live.get(id),loadState:id=>storage.load(id),persist:id=>storage.save(id,live.get(id)),persistPair:savePair,publishState:(id,value)=>live.set(id,value),restartRecovery:recovery,notify:()=>{},withAccounts:async(_ids,work)=>work()});
 return {service,recovery};
}
async function pair(service){service.register(A,session('Alpha'));service.register(B,session('Bravo'));await service.action(A,session('Alpha'),{type:'rankedV1.queue.join',mode:'single'});await service.action(B,session('Bravo'),{type:'rankedV1.queue.join',mode:'single'});return service.matches.get(service.playerMatch.get(A));}

test('B54 restart marker is atomic and excludes hidden battle decisions',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-b54-marker-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]);for(const [id,value] of live)await storage.save(id,value);
  const {service}=runtime(storage,live),match=await pair(service),savedA=await storage.load(A),savedB=await storage.load(B),marker=activeRankedMarker(savedA);
  assert.equal(marker.matchId,match.id);assert.deepEqual(marker,activeRankedMarker(savedB));
  assert.deepEqual(Object.keys(marker).sort(),['catalogVersion','createdAt','kind','matchId','mode','participants','rulesVersion','version']);
  assert.doesNotMatch(JSON.stringify(marker),/command|pending|battle|seed|roster|build/i);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('B54 restart converts an unfinished Ranked match to one durable no-contest',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-b54-recover-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]);for(const [id,value] of live)await storage.save(id,value);
  const first=runtime(storage,live),match=await pair(first.service),before=[live.get(A).rankedV1.rating,live.get(B).rankedV1.rating];
  const restartedLive=new Map(),restarted=runtime(storage,restartedLive);const recovered=await restarted.recovery.recoverForPlayer(A),savedA=await storage.load(A),savedB=await storage.load(B);
  assert.equal(activeRankedMarker(savedA),null);assert.equal(activeRankedMarker(savedB),null);assert.equal(recovered.rankedV1.rating,before[0]);
  assert.deepEqual([savedA.rankedV1.rating,savedB.rankedV1.rating],before);assert.deepEqual([savedA.rankedV1.matches,savedB.rankedV1.matches],[0,0]);assert.deepEqual([savedA.wallet.recruitmentTickets,savedB.wallet.recruitmentTickets],[2,2]);
  const left=savedA.rankedSettlementReceiptsV1.at(-1),right=savedB.rankedSettlementReceiptsV1.at(-1);assert.equal(left.matchId,match.id);assert.equal(left.key,right.key);assert.equal(left.result.outcome,'no-contest');assert.equal(left.result.reason,'server-restart-no-contest');assert.equal(left.result.ratingDelta,0);
  const fresh=runtime(storage,new Map([[A,savedA],[B,savedB]])).service,view=fresh.viewFor(A,savedA);assert.equal(view.status,'finished');assert.equal(view.recovered,true);assert.equal(view.result.outcome,'no-contest');
  await restarted.recovery.recoverForPlayer(B);assert.equal((await storage.load(B)).rankedSettlementReceiptsV1.length,1);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('B54 lost begin ACK is recovered from both durable markers without a second match',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-b54-begin-ack-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]);for(const [id,value] of live)await storage.save(id,value);
  let writes=0;const savePair=async(entries,id)=>{writes++;await storage.savePair(entries,id);if(writes===1)throw Error('BEGIN_ACK_LOST');};
  const {service}=runtime(storage,live,{persistPair:savePair}),match=await pair(service);
  assert.equal(service.matches.size,1);assert.equal(service.queue.length,0);assert.equal(activeRankedMarker(live.get(A)).matchId,match.id);assert.equal(activeRankedMarker(live.get(B)).matchId,match.id);assert.equal(writes,1);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('B54 reconnect to a match owned by this coordinator does not trigger restart recovery',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-b54-reconnect-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]);for(const [id,value] of live)await storage.save(id,value);
  const current=runtime(storage,live),match=await pair(current.service);let writes=0;
  const reconnect=new PvpRestartRecovery({loadState:id=>storage.load(id),persistPair:async()=>{writes++;},isMatchLive:id=>id===match.id,clock:{now:()=>NOW}}),loaded=await reconnect.recoverForPlayer(A);
  assert.equal(activeRankedMarker(loaded).matchId,match.id);assert.equal(writes,0);assert.equal(loaded.rankedSettlementReceiptsV1,undefined);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('B54 malformed or one-sided markers fail closed without changing either save',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-b54-corrupt-'));
 try{
  const storage=new JsonAdventureStorage(folder),aState=state('Alpha'),bState=state('Bravo');aState.activeRankedMatchV1={version:1,kind:'ranked'};await storage.save(A,aState);await storage.save(B,bState);
  const recovery=new PvpRestartRecovery({loadState:id=>storage.load(id),persistPair:()=>assert.fail('must not write'),clock:{now:()=>NOW}});
  await assert.rejects(recovery.recoverForPlayer(A),error=>error.code==='PVP_RECOVERY_MARKER_CORRUPT');assert.deepEqual(await storage.load(A),aState);assert.deepEqual(await storage.load(B),bState);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('B54 normal no-contest and rated settlement both clear the restart marker',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'pv-b54-finish-'));
 try{
  const storage=new JsonAdventureStorage(folder),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]);for(const [id,value] of live)await storage.save(id,value);
  let current=runtime(storage,live),match=await pair(current.service);await current.service.adminStopForPlayer(A,'admin-stop');
  let savedA=await storage.load(A),savedB=await storage.load(B);assert.equal(activeRankedMarker(savedA),null);assert.equal(activeRankedMarker(savedB),null);assert.equal(savedA.rankedSettlementReceiptsV1.at(-1).result.outcome,'no-contest');assert.equal(savedA.rankedV1.matches,0);
  live.set(A,savedA);live.set(B,savedB);current=runtime(storage,live);match=await pair(current.service);await current.service.action(A,session('Alpha'),{type:'rankedV1.surrender',actionId:'b54-surrender'});
  savedA=await storage.load(A);savedB=await storage.load(B);assert.equal(activeRankedMarker(savedA),null);assert.equal(activeRankedMarker(savedB),null);assert.equal(savedA.rankedV1.matches,1);assert.equal(savedB.rankedV1.matches,1);assert.equal(savedA.rankedSettlementReceiptsV1.at(-1).matchId,match.id);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('B54 UI discloses restart policy and renders recovered outcome as No Contest',async()=>{
 const [client,arena]=await Promise.all([readFile(new URL('../public/client.js',import.meta.url),'utf8'),readFile(new URL('../public/js/arena-view.js',import.meta.url),'utf8')]);
 assert.match(client,/outcome==='no-contest'\?'No Contest'/);assert.match(arena,/server restarts[\s\S]*no-contest[\s\S]*no rating or ticket change/);assert.match(arena,/Friendly rooms are session-only[\s\S]*server restarts/);
 assert.equal(assertSingleCoordinatorEnv({}),1);assert.equal(assertSingleCoordinatorEnv({PV_GAME_COORDINATOR_COUNT:'1'}),1);assert.throws(()=>assertSingleCoordinatorEnv({PV_GAME_COORDINATOR_COUNT:'2'}),/must be 1/);
});
