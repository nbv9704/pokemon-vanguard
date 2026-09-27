import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {SupabaseAdventureStorage} from '../server/storage-supabase.mjs';
import {AdminService} from '../server/admin-service.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyAdminGiftAction,adminGiftView,enqueueAdminGift,normalizeGiftDraft} from '../server/admin-gifts.mjs';
import {campaignFingerprint} from '../server/admin-campaigns.mjs';
import {legacyAdventurePublicView} from '../server/player-public-view.mjs';

const player=id=>({schemaVersion:3,revision:1,owner:id,wallet:{coins:100,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const session={accountId:'admin-test'};
const request=(campaignId='client-created-1')=>({campaignId,target:{scope:'all'},gift:{title:'Season gift',message:'Enjoy the event',coins:125,shopTickets:2}});

async function fixture(work){
 const dir=await mkdtemp(path.join(os.tmpdir(),'vanguard-campaign-')),base=new JsonAdventureStorage(dir);
 try{
  await base.save('trainer-a',player('trainer-a'));await base.save('trainer-b',player('trainer-b'));
  const service=storage=>new AdminService({storage,catalog:v3Catalog,clock:{now:()=>1000},isAdmin:()=>true,notify:()=>{},listOnlineAccountIds:()=>[]});
  await work({base,service,dir});
 }finally{await rm(dir,{recursive:true,force:true});}
}

test('admin campaign retry after partial save failure and service restart uses the original audience and gift',async()=>{
 await fixture(async({base,service})=>{
  let oneFailure=true;
  const flaky=new Proxy(base,{get(target,key,receiver){if(key==='save')return async(id,state)=>{if(id==='trainer-b'&&oneFailure){oneFailure=false;throw Object.assign(new Error('disk failure'),{code:'EIO'});}return target.save(id,state);};return Reflect.get(target,key,receiver);}});
  const first=await service(flaky).sendGiftCampaign(session,request());assert.equal(first.status,200);assert.equal(first.body.delivered,1);assert.equal(first.body.failed,1);
  assert.equal((await base.load('trainer-a')).adminGiftsV1.inbox.length,1);assert.equal((await base.load('trainer-b')).adminGiftsV1,undefined);
  // A separate server instance reloads the manifest from disk, instead of
  // creating a new gift ID or selecting a changed online/rank audience.
  const restarted=service(base),second=await restarted.sendGiftCampaign(session,request());assert.equal(second.status,200);assert.equal(second.body.failed,0);
  assert.equal(second.body.duplicates,1);assert.equal(second.body.targeted,2);
  for(const id of ['trainer-a','trainer-b']){const saved=await base.load(id);assert.equal(saved.adminGiftsV1.inbox.length,1);assert.equal(saved.adminGiftDeliveryReceiptsV1.length,1);assert.equal(saved.adminAuditV1.entries.filter(entry=>entry.action==='gift.send').length,1);}
  const manifest=await base.getCampaign(request().campaignId);assert.deepEqual(manifest.audience,['trainer-a','trainer-b']);assert.equal(manifest.gift.sentAt,1000);
 });
});

test('same Admin Gift ID with a different gift, target or admin identity is a conflict, even after restart',async()=>{
 await fixture(async({base,service})=>{
  const first=await service(base).sendGiftCampaign(session,request('immutable-request'));assert.equal(first.status,200);
  const restarted=service(base);
  assert.equal((await restarted.sendGiftCampaign(session,{...request('immutable-request'),gift:{...request().gift,coins:999}})).status,409);
  assert.equal((await restarted.sendGiftCampaign(session,{...request('immutable-request'),target:{scope:'player',userId:'trainer-a'}})).status,409);
  assert.equal((await restarted.sendGiftCampaign({accountId:'second-admin'},request('immutable-request'))).status,409);
  assert.equal((await restarted.sendGiftCampaign(session,{...request(),campaignId:'../bad'})).body.error,'INVALID_CAMPAIGN_ID');
 });
});

test('recipient tombstone keeps claimed or expired gift from being delivered again',async()=>{
 await fixture(async({base,service})=>{
  await service(base).sendGiftCampaign(session,request('expired-retry'));
  const old=await base.load('trainer-a'),claim=applyAdminGiftAction(old,{type:'adminGift.claim',giftId:'expired-retry'},v3Catalog,{now:1001});assert.equal(claim.ok,true);
  claim.state.adminGiftsV1.inbox=[];await base.save('trainer-a',claim.state);
  const retry=await service(base).sendGiftCampaign(session,request('expired-retry'));assert.equal(retry.body.duplicates,2);assert.equal(retry.body.failed,0);
  const saved=await base.load('trainer-a');assert.equal(saved.adminGiftsV1.inbox.length,0);assert.equal(saved.wallet.coins,225);assert.equal(saved.ticketBagV1.shopTickets,2);
  assert.equal(saved.adminGiftDeliveryReceiptsV1.length,1);assert.equal(adminGiftView(saved,v3Catalog,{now:1002}).pendingCount,0);
 });
});

test('concurrent same-ID requests serialize and do not write another recipient gift',async()=>{
 await fixture(async({base,service})=>{
  const current=service(base),results=await Promise.all([current.sendGiftCampaign(session,request('parallel')),current.sendGiftCampaign(session,request('parallel'))]);
  assert.deepEqual(results.map(entry=>entry.status),[200,200]);assert.equal(results[0].body.duplicates,0);assert.equal(results[1].body.duplicates,2);
  for(const id of ['trainer-a','trainer-b'])assert.equal((await base.load(id)).adminGiftDeliveryReceiptsV1.length,1);
 });
});

test('per-recipient receipt rejects a different fingerprint even after inbox retention ends',()=>{
 const state=player('recipient'),gift=normalizeGiftDraft({coins:30},v3Catalog,{campaignId:'stable-id',sentAt:1000}).gift;
 const fingerprint=campaignFingerprint('admin',{scope:'all'},gift);
 assert.equal(enqueueAdminGift(state,gift,{fingerprint}).ok,true);
 state.adminGiftsV1.inbox=[];
 assert.deepEqual(enqueueAdminGift(state,{...gift,reward:{...gift.reward,coins:1000}},{fingerprint:'different'}),{ok:false,code:'CAMPAIGN_ID_REUSED'});
 assert.deepEqual(enqueueAdminGift(state,gift,{fingerprint}),{ok:true,duplicate:true,changed:false});
});

test('campaign manifest is stored separately from player saves with a safe immutable ID',async()=>{
 await fixture(async({base,dir})=>{
  const manifest={campaignId:'snapshot-1',fingerprint:'f'.repeat(64),audience:['trainer-a'],gift:{title:'fixed'}};
  await Promise.all([base.registerCampaign(manifest),base.registerCampaign({...manifest,gift:{title:'changed'}})]);
  assert.deepEqual(await base.getCampaign('snapshot-1'),manifest);
  const file=JSON.parse(await readFile(path.join(dir,'.campaigns','snapshot-1.json'),'utf8'));assert.deepEqual(file,manifest);
  assert.throws(()=>base.campaignPath('../../private'),/INVALID_CAMPAIGN_ID/);
 });
});

test('concurrent campaign registrations through two JSON adapters preserve first local invocation',async()=>{
 await fixture(async({base,dir})=>{
  const second=new JsonAdventureStorage(dir),first={campaignId:'shared-first',fingerprint:'1'.repeat(64),audience:['trainer-a'],gift:{title:'First'}};
  const [a,b]=await Promise.all([base.registerCampaign(first),second.registerCampaign({...first,gift:{title:'Overwriting attempt'}})]);
  assert.deepEqual(a,first);assert.deepEqual(b,first);assert.deepEqual(await second.getCampaign(first.campaignId),first);
 });
});

test('cloud adapter records the immutable campaign manifest through a unique-key insert',async()=>{
 const requests=[],manifest={campaignId:'cloud-campaign',fingerprint:'a'.repeat(64),audience:['a','b'],gift:{title:'Cloud'}};
 const mockFetch=async(url,init)=>{requests.push({url,init});if(init.method==='POST')return Response.json([],{status:201});return Response.json([{campaign_id:manifest.campaignId,fingerprint:manifest.fingerprint,audience:manifest.audience,gift:manifest.gift}],{status:200});};
 const store=new SupabaseAdventureStorage({url:'https://example.invalid',secretKey:'test-secret',fetchImpl:mockFetch});
 assert.deepEqual(await store.registerCampaign(manifest),manifest);assert.match(requests[0].url,/admin_gift_campaigns\?on_conflict=campaign_id/);
 assert.match(requests[1].url,/admin_gift_campaigns\?campaign_id=eq.cloud-campaign/);
 const migration=await readFile(new URL('../supabase/migrations/202609260002_admin_campaign_identity.sql',import.meta.url),'utf8');
 assert.match(migration,/enable row level security/);assert.match(migration,/grant select, insert.*service_role/i);
});

test('player public payload explicitly excludes Admin Gift delivery receipts',()=>{
 const projected=legacyAdventurePublicView({coins:125,adminGiftDeliveryReceiptsV1:[{campaignId:'private'}]});
 assert.deepEqual(projected,{coins:125});
});
