import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {AccountCoordinator} from '../server/account-coordinator.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {SocialService,ensureSocialState,friendCodeFor} from '../server/social-v1.mjs';
import {SocialView} from '../public/js/social-view.js';

const [a,b,c]=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const session=name=>({provider:'google',name});
const fresh=()=>({schemaVersion:3,revision:1,wallet:{coins:0,crystals:0}});
const friends=count=>Array.from({length:count},(_,i)=>({accountId:`existing-${i}`,name:`Friend ${i}`}));
const accept=target=>({type:'socialV1.friend.accept',accountId:target,actionId:`accept:${target}`});
async function fixture(count=99){
 const directory=await mkdtemp(path.join(os.tmpdir(),'pv-social-b31-'));
 const storage=new JsonAdventureStorage(directory),live=new Map(),coordinator=new AccountCoordinator();
 for(const id of [a,b,c]){const state=fresh(),social=ensureSocialState(state);if(id===a){social.friends=friends(count);social.incomingRequests=[b,c].map(id=>({accountId:id,name:'Invite'}));}else social.outgoingRequests=[{accountId:a,name:'Alpha'}];await storage.save(id,state);live.set(id,state);}
 let commits=0;
 const service=new SocialService({clock:{now:()=>10000},getState:id=>live.get(id),loadState:id=>storage.load(id),loadProfile:async id=>({userId:id,displayName:id===a?'Alpha':'Stored Friend',avatarUrl:'https://example.test/avatar.png'}),persistPair:async(entries,id)=>{commits++;await storage.savePair(entries,id);},setLiveState:(id,state)=>live.set(id,state),withAccounts:(ids,work)=>coordinator.withAccounts(ids,work)});
 return {storage,live,service,directory,get commits(){return commits;},close:()=>rm(directory,{recursive:true,force:true})};
}

test('99→100: two simultaneous accepts touching one owner never exceed capacity or lose pending requests',async()=>{
 const ctx=await fixture();try{
  const responses=await Promise.all([ctx.service.action(a,session('Alpha'),accept(b)),ctx.service.action(a,session('Alpha'),accept(c))]);
  assert.deepEqual(responses.map(result=>result.ok).sort(),[false,true]);
  assert.equal(responses.find(result=>!result.ok).code,'SOCIAL_LIMIT_REACHED');
  const saved=await ctx.storage.load(a),winner=responses[0].ok?b:c,loser=winner===b?c:b;
  assert.equal(saved.socialV1.friends.length,100);
  assert.equal(saved.socialV1.incomingRequests.length,1);
  assert.equal(saved.socialV1.incomingRequests[0].accountId,loser);
  assert.equal((await ctx.storage.load(winner)).socialV1.friends[0].accountId,a);
  assert.equal((await ctx.storage.load(loser)).socialV1.outgoingRequests.length,1);
  assert.equal(ctx.commits,1);
  assert.deepEqual(ctx.live.get(a),saved);
 }finally{await ctx.close();}
});

test('98→100: concurrent accept requests for two distinct friends serialize with no lost updates',async()=>{
 const ctx=await fixture(98);try{
  const answers=await Promise.all([ctx.service.action(a,session('Alpha'),accept(b)),ctx.service.action(a,session('Alpha'),accept(c))]);
  assert.equal(answers.every(answer=>answer.ok),true);
  assert.equal((await ctx.storage.load(a)).socialV1.friends.length,100);
  assert.equal((await ctx.storage.load(a)).socialV1.incomingRequests.length,0);
  for(const id of [b,c])assert.equal((await ctx.storage.load(id)).socialV1.friends[0].accountId,a);
  assert.equal(ctx.commits,2);
 }finally{await ctx.close();}
});

test('100→100: acceptance fails without mutation, new request also refuses a full target',async()=>{
 const ctx=await fixture(100);try{
  const before=JSON.stringify([...ctx.live]);
  assert.deepEqual(await ctx.service.action(a,session('Alpha'),accept(b)),{ok:false,code:'SOCIAL_LIMIT_REACHED'});
  // No new friend requests may be sent toward a full account.
  const d='44444444-4444-4444-8444-444444444444';await ctx.storage.save(d,fresh());
  const requester=new SocialService({getState:id=>ctx.live.get(id),loadState:id=>ctx.storage.load(id),persistPair:async()=>{throw Error('should not commit');}});
  assert.deepEqual(await requester.action(d,session('Fourth'),{type:'socialV1.friend.request',friendCode:friendCodeFor(a)}),{ok:false,code:'SOCIAL_LIMIT_REACHED'});
  assert.equal(JSON.stringify([...ctx.live]),before);
  assert.equal(ctx.commits,0);
 }finally{await ctx.close();}
});

test('duplicate concurrent acceptance commits one pair and repeated legacy acceptance is idempotent',async()=>{
 const ctx=await fixture(99);try{
  const answers=await Promise.all([ctx.service.action(a,session('Alpha'),accept(b)),ctx.service.action(a,session('Alpha'),accept(b))]);
  assert.equal(answers.every(answer=>answer.ok),true);
  assert.equal(answers.filter(answer=>answer.duplicate).length,1);
  assert.equal(ctx.commits,1);
  assert.equal((await ctx.storage.load(a)).socialV1.friends.length,100);
  assert.deepEqual(await ctx.service.action(a,session('Alpha'),{type:'socialV1.friend.accept',accountId:b}),{ok:true,duplicate:true});
  assert.equal(ctx.commits,1);
 }finally{await ctx.close();}
});

test('asymmetric incoming request fails closed without mutating either account; reciprocal request is required',async()=>{
 const ctx=await fixture();try{
  const wrong=await ctx.storage.load(b);wrong.socialV1.outgoingRequests=[];await ctx.storage.save(b,wrong);
  const before=JSON.stringify([await ctx.storage.load(a),await ctx.storage.load(b)]);
  assert.deepEqual(await ctx.service.action(a,session('Alpha'),accept(b)),{ok:false,code:'REQUEST_NOT_MUTUAL'});
  assert.equal(JSON.stringify([await ctx.storage.load(a),await ctx.storage.load(b)]),before);
  assert.equal(ctx.commits,0);
 }finally{await ctx.close();}
});

test('atomic pair writer is mandatory: absence never falls back to two independent writes',async()=>{
 const states=new Map([[a,fresh()],[b,fresh()]]);let writes=0;
 const service=new SocialService({getState:id=>states.get(id),loadState:async id=>states.get(id),persist:async()=>{writes++;}});
 const action={type:'socialV1.friend.request',friendCode:friendCodeFor(b),actionId:'req:test'};
 await assert.rejects(service.action(a,session('Alpha'),action),error=>error.code==='SOCIAL_ATOMIC_STORAGE_REQUIRED');
 assert.equal(writes,0);
 assert.equal(states.get(a).socialV1,undefined);
 assert.equal(states.get(b).socialV1,undefined);
});

test('offline profile loads current durable identity, not the previous socket session; TTL and limit bound caching',async()=>{
 let now=1000,reads=0;const profiles=new Map([[b,{userId:b,displayName:'Stored Bravo',avatarUrl:'https://example.test/new.png',internalToken:'never-publish'}],[c,{userId:c,displayName:'Stored Charlie',avatarUrl:'https://example.test/charlie.png'}]]);
 const service=new SocialService({clock:{now:()=>now},loadProfile:async id=>{reads++;return profiles.get(id)||null;},profileTtlMs:50,profileCacheLimit:1});
 service.register(b,session('Old Browser Name'));
 assert.equal((await service.profile(b)).name,'Old Browser Name');
 service.unregister(b);
 assert.deepEqual(await service.profile(b),{accountId:b,name:'Stored Bravo',avatar:'https://example.test/new.png',provider:null});
 assert.equal(reads,1);
 assert.equal(JSON.stringify(await service.profile(b)).includes('internalToken'),false);
 profiles.set(b,{userId:b,displayName:'Renamed Bravo',avatarUrl:'https://example.test/renamed.png'});
 assert.equal((await service.profile(b)).name,'Stored Bravo'); // cached in a bounded TTL
 now+=51;assert.equal((await service.profile(b)).name,'Renamed Bravo');
 await service.profile(c);assert.equal(service.directory.entries.size,1);
 await service.profile(b);assert.equal(reads,4); // bounded size evicted b
 service.register(b,session('Active Bravo'));assert.equal((await service.profile(b)).name,'Active Bravo');
 service.unregister(b);assert.equal((await service.profile(b)).name,'Renamed Bravo');
});

test('mis-keyed offline profile cannot impersonate another trainer or publish a friend request',async()=>{
 const ctx=await fixture();try{
  const service=new SocialService({getState:id=>ctx.live.get(id),loadState:id=>ctx.storage.load(id),loadProfile:async()=>({userId:a,displayName:'Impersonator'}),persistPair:async()=>{throw Error('must not save');}});
  const before=JSON.stringify([await ctx.storage.load(a),await ctx.storage.load(b)]);
  // b's lookup gets a's record, so request must never commit.
  await assert.rejects(service.action(c,session('Third'),{type:'socialV1.friend.request',friendCode:friendCodeFor(b),actionId:'miskey'}),error=>error.code==='SOCIAL_PROFILE_MISMATCH');
  assert.equal(JSON.stringify([await ctx.storage.load(a),await ctx.storage.load(b)]),before);
 }finally{await ctx.close();}
});

test('Social renderer escapes profile names, provider labels and chat text',()=>{
 const malicious='</button><img src=x onerror=alert(1)>';
 const view=new SocialView({send:()=>true,actionId:()=> 'test'});
 const output=view.render({socialV1:{friends:[{accountId:b,name:malicious,provider:malicious,online:false}],incomingRequests:[{accountId:a,name:malicious,provider:malicious}],outgoingRequests:[],conversations:{[b]:[{fromAccountId:b,text:malicious}]}}});
 assert.equal(output.includes(malicious),false);
 assert.match(output,/&lt;img src=x onerror=alert\(1\)&gt;/);
});
