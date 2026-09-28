import test from 'node:test';
import assert from 'node:assert/strict';
import {AdminService} from '../server/admin-service.mjs';
import {adminActionFingerprint,lookupAdminActionReceipt} from '../server/admin-action-receipts.mjs';
import {AdminPendingAction} from '../public/js/admin-pending-action.js';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {AccountCoordinator} from '../server/account-coordinator.mjs';

const userId='11111111-1111-4111-8111-111111111111',admin={accountId:'admin-1'};
const starter=()=>({schemaVersion:3,revision:1,owner:'Trainer',progressionV3:createV3BetaProgression(v3Catalog),wallet:{coins:1200,crystals:20,recruitmentTickets:2},coins:1200,gems:20,recruitmentTickets:2});
function fixture(){
 const saves=new Map([[userId,starter()]]);let live=structuredClone(saves.get(userId)),failAfterWrite=false;
 const storage={load:async id=>structuredClone(saves.get(id)),profile:async()=>({displayName:'Trainer'}),save:async(id,value)=>{saves.set(id,structuredClone(value));if(failAfterWrite)throw Error('NETWORK_TIMEOUT_AFTER_COMMIT');}};
 const service=()=>new AdminService({storage,catalog:v3Catalog,isAdmin:()=>true,getLiveState:()=>live,setLiveState:(_id,state)=>{live=structuredClone(state);}});
 return {saves,storage,service,getLive:()=>live,setFail:value=>{failAfterWrite=value;}};
}

test('canonical full-action fingerprint treats field order as equal but rejects changed payload/admin',()=>{
 const a={type:'tickets.set',actionId:'once',rankTickets:4,shopTickets:2,trainingTickets:0,recruitmentTickets:1};
 assert.equal(adminActionFingerprint('admin','user',a),adminActionFingerprint('admin','user',{trainingTickets:0,shopTickets:2,actionId:'once',recruitmentTickets:1,rankTickets:4,type:'tickets.set'}));
 assert.notEqual(adminActionFingerprint('admin','user',a),adminActionFingerprint('admin','user',{...a,rankTickets:5}));
 assert.notEqual(adminActionFingerprint('admin','user',a),adminActionFingerprint('different','user',a));
});

test('repeated Admin ticket action has one audit/receipt, survives service restart and rejects ID collision',async()=>{
 const f=fixture(),action={type:'tickets.set',actionId:'admin:ticket:1',recruitmentTickets:3,shopTickets:2,trainingTickets:4,rankTickets:5,rankProtectionArmed:true};
 const first=await f.service().handlePlayerAction(userId,action,admin);assert.equal(first.status,200);assert.equal(first.body.duplicate,undefined);
 const second=await f.service().handlePlayerAction(userId,action,admin);assert.equal(second.status,200);assert.equal(second.body.duplicate,true);
 const saved=f.saves.get(userId);assert.equal(saved.ticketBagV1.rankTickets,5);assert.equal(saved.adminAuditV1.entries.length,1);assert.equal(saved.adminActionReceiptsV1.length,1);
 const collided=await f.service().handlePlayerAction(userId,{...action,rankTickets:6},admin);assert.equal(collided.status,409);assert.equal(collided.body.error,'ADMIN_ACTION_ID_REUSED');assert.equal(f.saves.get(userId).ticketBagV1.rankTickets,5);
 const other=await f.service().handlePlayerAction(userId,action,{accountId:'admin-2'});assert.equal(other.status,409);
});

test('timeout after durable save: retry sees receipt even if in-memory state stayed old',async()=>{
 const f=fixture(),old=f.getLive(),action={type:'economy.set',actionId:'once:timeout',coins:99,crystals:12};f.setFail(true);
 await assert.rejects(f.service().handlePlayerAction(userId,action,admin),/NETWORK_TIMEOUT_AFTER_COMMIT/);
 assert.equal(f.getLive(),old);assert.equal(f.saves.get(userId).wallet.coins,99);
 f.setFail(false);const retry=await f.service().handlePlayerAction(userId,action,admin);
 assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(f.getLive().wallet.coins,99);assert.equal(f.saves.get(userId).adminAuditV1.entries.length,1);
 assert.equal(lookupAdminActionReceipt(f.saves.get(userId),action.actionId,adminActionFingerprint(admin.accountId,userId,action)).status,'duplicate');
});

test('invalid/unsupported ID rejected, legacy clients still use original code path',async()=>{
 const f=fixture(),service=f.service();assert.equal((await service.handlePlayerAction(userId,{type:'economy.set',actionId:'bad!id',coins:1,crystals:1},admin)).status,400);
 assert.equal((await service.handlePlayerAction(userId,{type:'save.backup',actionId:'id'},admin)).status,400);
 const legacy=await service.handlePlayerAction(userId,{type:'economy.set',coins:10,crystals:2},admin);assert.equal(legacy.status,200);assert.equal(f.saves.get(userId).wallet.coins,10);
});

test('pending Admin UI command preserves identical payload and ID across reload until explicit completion',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 let client=new AdminPendingAction(storage,'admin-1'),draft=client.begin(userId,{type:'ranked.setRating',rating:1500},()=> 'stable-id');
 assert.deepEqual(draft,{userId,action:{type:'ranked.setRating',rating:1500,actionId:'stable-id'}});
 assert.throws(()=>client.begin(userId,{type:'ranked.setRating',rating:1600},()=> 'other-id'),/pending/);
 client=new AdminPendingAction(storage,'admin-1');assert.deepEqual(client.get(),draft);assert.equal(new AdminPendingAction(storage,'admin-2').get(),null);
 client.complete('wrong-id');assert.deepEqual(client.get(),draft);client.complete('stable-id');assert.equal(client.get(),null);
});


test('public WebSocket projection uses the root allowlist instead of receipt blacklists',async()=>{
 const server=await readFile(new URL('../local-server.mjs',import.meta.url),'utf8');
 const source=await readFile(new URL('../server/public-state-projector.mjs',import.meta.url),'utf8');
 const websocket=await readFile(new URL('../server/websocket-controller.mjs',import.meta.url),'utf8');
 assert.match(server,/createWebsocketController\(/);
 assert.match(websocket,/createPlayerStateProjector\(/);
 assert.match(source,/legacyAdventurePublicView\(legacyView\)/);
 assert.doesNotMatch(source,/adminActionReceiptsV1:_privateAdminActionReceiptsV1/);
});


test('real JSON storage retains the Admin receipt across storage/service recreation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pv-admin-receipt-'));
 try{
  let storage=new JsonAdventureStorage(root);await storage.save('aether-trainer',starter());
  const service=()=>new AdminService({storage,catalog:v3Catalog,getLiveState:()=>null});
  const action={type:'ranked.setRating',rating:1888,actionId:'ranked-retry-one'};
  assert.equal((await service().handlePlayerAction('aether-trainer',action,admin)).status,200);
  storage=new JsonAdventureStorage(root);
  const duplicate=await service().handlePlayerAction('aether-trainer',action,admin);
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);
  const saved=await storage.load('aether-trainer');assert.equal(saved.rankedV1.rating,1888);
  assert.equal(saved.adminAuditV1.entries.length,1);assert.equal(saved.adminActionReceiptsV1.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('parallel same-ID requests serialize through the shared account coordinator',async()=>{
 const f=fixture(),coordinator=new AccountCoordinator(),svc=new AdminService({storage:f.storage,catalog:v3Catalog,isAdmin:()=>true,getLiveState:f.getLive,setLiveState:(_id,value)=>{},withAccountLock:(id,work)=>coordinator.withAccounts([id],work)});
 const action={type:'tickets.set',actionId:'same-parallel-action',recruitmentTickets:10,shopTickets:2,trainingTickets:1,rankTickets:0,rankProtectionArmed:false};
 const requests=await Promise.all([svc.handlePlayerAction(userId,action,admin),svc.handlePlayerAction(userId,action,admin)]);
 assert.deepEqual(requests.map(entry=>entry.status),[200,200]);assert.equal(requests.filter(entry=>entry.body.duplicate).length,1);
 assert.equal(f.saves.get(userId).adminAuditV1.entries.length,1);
});
