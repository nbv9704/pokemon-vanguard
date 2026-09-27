import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {AccountCoordinator} from '../server/account-coordinator.mjs';
import {SocialService,friendCodeFor} from '../server/social-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {inspectSocialReceipt,socialFingerprint,validSocialActionId} from '../server/social-action-receipts.mjs';
import {legacyAdventurePublicView} from '../server/player-public-view.mjs';

const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const fresh=()=>({schemaVersion:3,revision:1,wallet:{coins:0,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const person={name:'Alpha',provider:'google'};
const request={type:'socialV1.friend.request',friendCode:friendCodeFor(b),actionId:'req:1'};
const viewFor=(storage,live,broken=false)=>new SocialService({clock:{now:()=>10000},getState:id=>live.get(id),loadState:id=>storage.load(id),persistPair:async(entries,id)=>{await storage.savePair(entries,id);if(broken)throw Error('ACK_LOST');},setLiveState:(id,state)=>live.set(id,state),withAccounts:async(_ids,work)=>work()});

// These tests use entirely synthetic accounts and isolated tmp files.
test('Social receipts survive JSON pair commit, lost ACK and a fresh service; no duplicate requests',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-social-receipts-'));
 try{
  const storage=new JsonAdventureStorage(dir),live=new Map([[a,fresh()],[b,fresh()]]);for(const [id,state] of live)await storage.save(id,state);
  const broken=viewFor(storage,live,true);
  await assert.rejects(broken.action(a,person,request),/ACK_LOST/);
  assert.equal(live.get(a).socialV1,undefined);
  const savedA=await storage.load(a),savedB=await storage.load(b);
  assert.equal(savedA.socialV1.outgoingRequests.length,1);assert.equal(savedB.socialV1.incomingRequests.length,1);
  assert.equal(savedA.socialActionReceiptsV1.length,1);
  const restarted=viewFor(new JsonAdventureStorage(dir),live);
  assert.deepEqual(await restarted.action(a,person,request),{ok:true,duplicate:true});
  assert.equal(live.get(a).socialV1.outgoingRequests.length,1);assert.equal(live.get(b).socialV1.incomingRequests.length,1);
  const altered=await restarted.action(a,person,{...request,friendCode:friendCodeFor(a)});
  assert.deepEqual(altered,{ok:false,code:'SOCIAL_ACTION_ID_CONFLICT'});
  assert.equal((await storage.load(a)).socialActionReceiptsV1.length,1);
  assert.equal(JSON.stringify(restarted.viewFor(a,live.get(a))).includes('socialActionReceiptsV1'),false);
  assert.equal(Object.hasOwn(legacyAdventurePublicView(savedA),'socialActionReceiptsV1'),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Social chat retry after save + lost ACK does not send again, including after chat throttle and restart',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-social-chat-'));
 try{
  const storage=new JsonAdventureStorage(dir),live=new Map([[a,fresh()],[b,fresh()]]);for(const [id,state] of live)await storage.save(id,state);
  let svc=viewFor(storage,live);
  assert.equal((await svc.action(a,person,request)).ok,true);
  assert.equal((await svc.action(b,{name:'Bravo',provider:'discord'},{type:'socialV1.friend.accept',accountId:a,actionId:'accept:1'})).ok,true);
  const chat={type:'socialV1.chat.send',accountId:b,text:'Hello friend',actionId:'chat:1'};
  svc=viewFor(storage,live,true);await assert.rejects(svc.action(a,person,chat),/ACK_LOST/);
  svc=viewFor(new JsonAdventureStorage(dir),live);
  assert.deepEqual(await svc.action(a,person,chat),{ok:true,duplicate:true});
  assert.equal((await storage.load(a)).socialV1.conversations[b].length,1);
  assert.equal((await storage.load(b)).socialV1.conversations[a].length,1);
  assert.deepEqual(await svc.action(a,person,{...chat,text:'another message'}),{ok:false,code:'SOCIAL_ACTION_ID_CONFLICT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Social fingerprint includes type, target and normalized message; malformed IDs are rejected',async()=>{
 assert.equal(validSocialActionId('good:123'),true);assert.equal(validSocialActionId('x'.repeat(128)),true);
 for(const bad of ['',null,'space x','a'.repeat(129),'../../target'])assert.equal(validSocialActionId(bad),false);
 const id='same-id',action={type:'socialV1.chat.send',accountId:b,text:' hi ',actionId:id};
 assert.equal(socialFingerprint(a,action),socialFingerprint(a,{...action,text:'hi'}));
 assert.notEqual(socialFingerprint(a,action),socialFingerprint(a,{...action,text:'goodbye'}));
 assert.notEqual(socialFingerprint(a,action),socialFingerprint(a,{...action,accountId:a}));
 assert.notEqual(socialFingerprint(a,action),socialFingerprint(b,action));
 assert.equal(inspectSocialReceipt({socialActionReceiptsV1:[{actionId:id,fingerprint:socialFingerprint(a,action)}]},id,socialFingerprint(a,action)).status,'duplicate');
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-social-validate-'));
 try{const storage=new JsonAdventureStorage(dir),live=new Map([[a,fresh()],[b,fresh()]]);for(const [key,state] of live)await storage.save(key,state);
  const svc=viewFor(storage,live);assert.deepEqual(await svc.action(a,person,{...request,actionId:'bad space'}),{ok:false,code:'INVALID_SOCIAL_ACTION_ID'});
  assert.equal((await storage.load(a)).socialActionReceiptsV1,undefined);
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('Two concurrent requests with the same Social ID serialize and produce exactly one pair commit',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-social-concurrent-'));
 try{
  const storage=new JsonAdventureStorage(dir),live=new Map([[a,fresh()],[b,fresh()]]),coordinator=new AccountCoordinator();
  for(const [id,value] of live)await storage.save(id,value);
  let commits=0;const svc=new SocialService({clock:{now:()=>10000},getState:id=>live.get(id),loadState:id=>storage.load(id),persistPair:async(entries,id)=>{commits++;await storage.savePair(entries,id);},setLiveState:(id,value)=>live.set(id,value),withAccounts:(ids,work)=>coordinator.withAccounts(ids,work)});
  const [first,second]=await Promise.all([svc.action(a,person,request),svc.action(a,person,request)]);
  assert.equal(first.ok,true);assert.deepEqual(second,{ok:true,duplicate:true});assert.equal(commits,1);
  assert.equal(live.get(a).socialV1.outgoingRequests.length,1);assert.equal(live.get(b).socialV1.incomingRequests.length,1);
  assert.equal((await storage.load(a)).socialActionReceiptsV1.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
