import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {applyAdminMutation,appendAdminAudit} from '../server/admin-mutations.mjs';
import {adminPlayerDetail} from '../server/admin-projection.mjs';
import {createLocalAuth} from '../server/local-auth.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {adminItemSearchText,adminPokemonSearchText,adminSearchMatch} from '../public/js/admin-search.js';

const makeState=()=>({schemaVersion:3,revision:1,owner:'admin-test-player',progressionV3:createV3BetaProgression(v3Catalog),wallet:{coins:1000,crystals:50,recruitmentTickets:2},coins:1000,gems:50,recruitmentTickets:2});

test('admin access is derived server-side from ADMIN_ACCOUNT_IDS',()=>{
 const accountId='11111111-1111-4111-8111-111111111111',auth=createLocalAuth({env:{ADMIN_ACCOUNT_IDS:accountId}});
 assert.equal(auth.isAdmin({accountId,provider:'google'}),true);
 assert.equal(auth.isAdmin({accountId:'22222222-2222-4222-8222-222222222222',provider:'google'}),false);
 assert.equal(createLocalAuth({env:{ADMIN_ALLOW_LOCAL_BETA:'true'}}).isAdmin({accountId:'dev:test',provider:'local'}),true);
});

test('admin mutations manage balances, item ownership and ranked state without breaking invariants',()=>{
 let state=makeState(),result=applyAdminMutation(state,{type:'economy.set',coins:9000,crystals:800,recruitmentTickets:77},v3Catalog,{now:1000});assert.equal(result.ok,true);state=result.state;assert.deepEqual(state.wallet,{coins:9000,crystals:800,recruitmentTickets:77});
 result=applyAdminMutation(state,{type:'tickets.set',recruitmentTickets:12,shopTickets:5,trainingTickets:4,rankTickets:3,rankProtectionArmed:true},v3Catalog,{now:1000});assert.equal(result.ok,true);state=result.state;assert.equal(state.wallet.recruitmentTickets,12);assert.equal(state.ticketBagV1.shopTickets,5);assert.equal(state.ticketBagV1.trainingTickets,4);assert.equal(state.ticketBagV1.rankTickets,3);assert.equal(state.ticketBagV1.rankProtectionArmed,true);
 const owned=new Set(state.progressionV3.ownedItemIds),item=v3Catalog.items.find(entry=>entry.enabledForBattle&&!owned.has(entry.id)&&!state.progressionV3.builds.some(build=>build.itemId===entry.id));assert.ok(item);
 result=applyAdminMutation(state,{type:'item.grant',itemId:item.id},v3Catalog,{now:1001});assert.equal(result.ok,true);state=result.state;assert.ok(state.progressionV3.ownedItemIds.includes(item.id));
 result=applyAdminMutation(state,{type:'item.revoke',itemId:item.id},v3Catalog,{now:1002});assert.equal(result.ok,true);state=result.state;assert.equal(state.progressionV3.ownedItemIds.includes(item.id),false);
 const equipped=state.progressionV3.builds[0].itemId;result=applyAdminMutation(state,{type:'item.revoke',itemId:equipped},v3Catalog,{now:1003});assert.equal(result.ok,false);assert.match(result.code,/ITEM_IN_USE|BEGINNING_ITEM_LOCKED/);
 result=applyAdminMutation(state,{type:'ranked.setRating',rating:4200},v3Catalog,{now:1004});assert.equal(result.ok,true);assert.equal(result.state.rankedV1.rating,4200);
});

test('admin Pokémon ownership honors team references and creates a usable build for granted species',()=>{
 let state=makeState(),owned=new Set(state.progressionV3.mons.map(mon=>mon.speciesId)),species=v3Catalog.species.find(entry=>!owned.has(entry.id));assert.ok(species);
 let result=applyAdminMutation(state,{type:'pokemon.grant',speciesId:species.id},v3Catalog,{now:2000});assert.equal(result.ok,true);state=result.state;const mon=state.progressionV3.mons.find(entry=>entry.speciesId===species.id);assert.equal(mon.ownership,'permanent');assert.ok(state.progressionV3.builds.some(build=>build.monId===mon.monId));
 result=applyAdminMutation(state,{type:'pokemon.revoke',speciesId:species.id},v3Catalog,{now:2001});assert.equal(result.ok,true);state=result.state;assert.equal(state.progressionV3.mons.some(entry=>entry.speciesId===species.id),false);
 const starter=state.progressionV3.mons[0].speciesId;result=applyAdminMutation(state,{type:'pokemon.revoke',speciesId:starter},v3Catalog,{now:2002});assert.equal(result.ok,false);assert.equal(result.code,'POKEMON_IN_TEAM');
});

test('admin projection contains management data while audit and moderation remain private server state',()=>{
 let state=makeState(),result=applyAdminMutation(state,{type:'account.suspend',suspended:true,reason:'test moderation'},v3Catalog,{now:3000});assert.equal(result.ok,true);state=result.state;appendAdminAudit(state,{adminId:'admin-account',action:'account.suspend',details:result.details,now:3000});
 const detail=adminPlayerDetail({userId:'player-id',displayName:'Test Trainer',state},v3Catalog,{online:true,now:3001});assert.equal(detail.admin.suspended,true);assert.equal(detail.online,true);assert.ok(detail.items.length>=100);assert.ok(detail.items.some(item=>item.source&&item.sourceLabel));assert.equal(detail.pokemon.length,v3Catalog.species.length);assert.equal(detail.tickets.recruitment,2);assert.equal(detail.tickets.shop,0);assert.equal(detail.audit[0].action,'account.suspend');
});

test('admin ownership search matches held items and Pokémon by metadata and state',()=>{
 const item={name:'Choice Scarf',id:'choice-scarf',category:'held-item',source:'shop',sourceLabel:'Shop',owned:true,inUse:true,beginning:false},itemText=adminItemSearchText(item);
 assert.equal(adminSearchMatch(itemText,'choice'),true);assert.equal(adminSearchMatch(itemText,'held item'),true);assert.equal(adminSearchMatch(itemText,'shop'),true);assert.equal(adminSearchMatch(itemText,'choice-scarf'),true);assert.equal(adminSearchMatch(itemText,'owned'),true);assert.equal(adminSearchMatch(itemText,'equipped'),true);assert.equal(adminSearchMatch(itemText,'not owned'),false);
 const locked={...item,name:'Air Balloon',id:'air-balloon',owned:false,inUse:false,sourceLabel:'Shop'},lockedText=adminItemSearchText(locked);assert.equal(adminSearchMatch(lockedText,'not owned'),true);assert.equal(adminSearchMatch(lockedText,'owned'),false);
 const mon={name:'Charizard',id:'charizard',types:['Fire','Flying'],monId:'mon-charizard',buildId:'build-charizard',owned:true,inTeam:true},monText=adminPokemonSearchText(mon);assert.equal(adminSearchMatch(monText,'fire flying'),true);assert.equal(adminSearchMatch(monText,'charizard'),true);assert.equal(adminSearchMatch(monText,'owned'),true);assert.equal(adminSearchMatch(monText,'in team'),true);
});

test('JSON development storage can enumerate saves for the admin console',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-admin-storage-')),storage=new JsonAdventureStorage(dir);try{await storage.save('alpha',makeState());const second=makeState();second.owner='Beta Trainer';await storage.save('beta',second);const all=await storage.listAccounts({limit:10});assert.equal(all.total,2);assert.deepEqual(all.accounts.map(entry=>entry.userId),['alpha','beta']);const filtered=await storage.listAccounts({search:'bet',limit:10});assert.equal(filtered.total,1);assert.equal(filtered.accounts[0].displayName,'Beta Trainer');}finally{await rm(dir,{recursive:true,force:true});}
});

test('admin overview labels aggregates as a sample beyond the first hundred accounts',async()=>{
 const accounts=Array.from({length:150},(_,index)=>({userId:`aether-player-${index}`,displayName:`Player ${index}`,state:makeState()})),service=new AdminService({storage:{listAccounts:async({limit,offset})=>({total:accounts.length,accounts:accounts.slice(offset,offset+limit)})},catalog:v3Catalog,listOnlineAccountIds:()=>['aether-player-1','aether-player-149']});
 const overview=await service.overview();assert.equal(overview.players,150);assert.equal(overview.sampledAccounts,100);assert.equal(overview.aggregateScope,'sample');assert.equal(overview.online,2);assert.equal(overview.totalVp,100*makeState().wallet.coins);
});

import {Readable} from 'node:stream';
import {AdminService} from '../server/admin-service.mjs';

const responseStub=()=>({status:null,headers:null,body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(value=''){this.body+=value??'';}});
const requestStub=(method='GET',payload=null)=>{const stream=Readable.from(payload===null?[]:[Buffer.from(JSON.stringify(payload))]);stream.method=method;stream.headers={};return stream;};

test('admin HTTP service enforces server-side access and serializes mutations through the account lock',async()=>{
 const userId='33333333-3333-4333-8333-333333333333',records=new Map([[userId,makeState()]]),storage={load:async id=>records.get(id)||null,save:async(id,value)=>records.set(id,value),profile:async id=>({userId:id,displayName:'Managed Trainer'}),listAccounts:async()=>({total:1,accounts:[{userId,displayName:'Managed Trainer',state:records.get(userId)}]}),backup:async()=>`backup:${userId}`};let locks=0;
 const service=new AdminService({storage,catalog:v3Catalog,isAdmin:session=>session?.accountId==='admin',withAccountLock:async(_id,work)=>{locks++;return work();}}),url=new URL(`http://localhost/api/admin/players/${userId}/action`);
 let res=responseStub();await service.handle(requestStub('POST',{type:'economy.set',coins:1,crystals:2,recruitmentTickets:3}),res,url,null);assert.equal(res.status,401);
 res=responseStub();await service.handle(requestStub('POST',{type:'economy.set',coins:11,crystals:22,recruitmentTickets:33}),res,url,{accountId:'admin'});assert.equal(res.status,200);assert.equal(locks,1);assert.deepEqual(records.get(userId).wallet,{coins:11,crystals:22,recruitmentTickets:33});assert.equal(records.get(userId).adminAuditV1.entries[0].action,'economy.set');
});

import {adminGiftView,applyAdminGiftAction,enqueueAdminGift,normalizeGiftDraft} from '../server/admin-gifts.mjs';
import {missionView} from '../server/missions.mjs';

test('admin gift campaigns become claimable mailbox rewards with economy, item and Pokémon grants',()=>{
 let state=makeState(),ownedItems=new Set(state.progressionV3.ownedItemIds),ownedPokemon=new Set(state.progressionV3.mons.map(mon=>mon.speciesId));
 const item=v3Catalog.items.find(entry=>entry.enabledForBattle&&!ownedItems.has(entry.id)),species=v3Catalog.species.find(entry=>entry.enabledForBattle&&!ownedPokemon.has(entry.id));assert.ok(item);assert.ok(species);
 const draft=normalizeGiftDraft({title:'Server celebration',message:'Thanks for playing',coins:500,crystals:25,recruitmentTickets:2,itemIds:[item.id],speciesIds:[species.id]},v3Catalog,{campaignId:'campaign-1',sentBy:'admin',sentAt:4000});assert.equal(draft.ok,true);
 assert.equal(enqueueAdminGift(state,draft.gift).ok,true);assert.equal(adminGiftView(state,v3Catalog,{now:4500}).pendingCount,1);
 const claimed=applyAdminGiftAction(state,{type:'adminGift.claim',giftId:'campaign-1',actionId:'gift-claim-1'},v3Catalog,{now:5000});assert.equal(claimed.ok,true);state=claimed.state;
 assert.equal(state.wallet.coins,1500);assert.equal(state.wallet.crystals,75);assert.equal(state.wallet.recruitmentTickets,4);assert.ok(state.progressionV3.ownedItemIds.includes(item.id));assert.ok(state.progressionV3.mons.some(mon=>mon.speciesId===species.id&&mon.ownership==='permanent'));assert.equal(adminGiftView(state,v3Catalog,{now:5500}).pendingCount,0);
});

test('admin gift inbox rejects overflow without dropping an older pending entitlement',()=>{
 const state=makeState();for(let index=0;index<50;index++){const draft=normalizeGiftDraft({coins:1},v3Catalog,{campaignId:`pending-${index}`,sentBy:'admin',sentAt:1000+index});assert.equal(enqueueAdminGift(state,draft.gift).ok,true);}
 const before=structuredClone(state.adminGiftsV1.inbox),overflow=normalizeGiftDraft({coins:1},v3Catalog,{campaignId:'pending-overflow',sentBy:'admin',sentAt:2000});assert.deepEqual(enqueueAdminGift(state,overflow.gift),{ok:false,code:'GIFT_INBOX_FULL'});assert.deepEqual(state.adminGiftsV1.inbox,before);assert.equal(adminGiftView(state,v3Catalog,{now:2001}).pendingCount,50);
 const duplicate=normalizeGiftDraft({coins:1},v3Catalog,{campaignId:'pending-0',sentBy:'admin',sentAt:2002});assert.deepEqual(enqueueAdminGift(state,duplicate.gift),{ok:true,duplicate:true,changed:false});assert.equal(state.adminGiftsV1.inbox.length,50);
});

test('admin can complete and grant individual missions or whole categories',()=>{
 let state=makeState(),result=applyAdminMutation(state,{type:'missions.complete',category:'achievements',missionId:'achievement-wins-10'},v3Catalog,{now:6000});assert.equal(result.ok,true);state=result.state;
 let view=missionView(state,6000),achievement=view.achievements.find(entry=>entry.id==='achievement-wins-10');assert.equal(achievement.complete,true);assert.equal(achievement.claimable,true);
 result=applyAdminMutation(state,{type:'missions.claim',category:'achievements',missionId:'achievement-wins-10'},v3Catalog,{now:6001});assert.equal(result.ok,true);state=result.state;view=missionView(state,6001);achievement=view.achievements.find(entry=>entry.id==='achievement-wins-10');assert.equal(achievement.claimed,true);assert.equal(state.wallet.crystals,1050);
 result=applyAdminMutation(state,{type:'missions.completeCategory',category:'daily'},v3Catalog,{now:6002});assert.equal(result.ok,true);assert.equal(missionView(result.state,6002).daily.every(entry=>entry.complete),true);
});

test('admin gift HTTP endpoint can deliver to a selected player and records the campaign in save state',async()=>{
 const userId='44444444-4444-4444-8444-444444444444',records=new Map([[userId,makeState()]]),storage={load:async id=>records.get(id)||null,save:async(id,value)=>records.set(id,value),profile:async id=>({userId:id,displayName:'Gift Trainer'}),listAccounts:async()=>({total:1,accounts:[{userId,displayName:'Gift Trainer',state:records.get(userId)}]}),backup:async()=>`backup:${userId}`};
 const service=new AdminService({storage,catalog:v3Catalog,isAdmin:session=>session?.accountId==='admin'}),url=new URL('http://localhost/api/admin/gifts'),res=responseStub();
 await service.handle(requestStub('POST',{target:{scope:'player',userId},gift:{title:'Maintenance Gift',coins:250,crystals:5,recruitmentTickets:1,itemIds:[],speciesIds:[]}}),res,url,{accountId:'admin'});assert.equal(res.status,200);const payload=JSON.parse(res.body);assert.equal(payload.delivered,1);assert.equal(records.get(userId).adminGiftsV1.inbox.length,1);assert.equal(records.get(userId).adminAuditV1.entries[0].action,'gift.send');
});

import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

test('admin can stop an active PvE schema-3 battle without reward or mission settlement',()=>{
 let state=makeState(),team=state.progressionV3.teams.find(entry=>entry.teamId===state.progressionV3.activeTeamId),started=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'single',difficulty:'hard',teamId:team.teamId},v3Catalog);assert.equal(started.ok,true);started=applyV3BattleAction(started.state,{type:'battleV3.preview.lock',buildIds:team.buildIds.slice(0,3)},v3Catalog);assert.equal(started.ok,true);
 const stopped=applyAdminMutation(started.state,{type:'battle.stopLocal'},v3Catalog,{now:7000});assert.equal(stopped.ok,true);assert.equal(stopped.state.battleV3.phase,'FINISHED');assert.equal(stopped.state.battleV3.battle.result.winner,null);assert.equal(stopped.state.battleV3.battle.result.reason,'admin-stop');assert.deepEqual(stopped.state.battleV3.reward,{coins:0,crystals:0,receiptId:null});
});

test('admin gift audience supports selected groups, rank cohorts and the whole account set',async()=>{
 const a='55555555-5555-4555-8555-555555555555',b='66666666-6666-4666-8666-666666666666',states=new Map([[a,makeState()],[b,makeState()]]);states.get(b).rankedV1={rating:4200,peakRating:4200,matches:0,wins:0,losses:0,draws:0,history:[]};
 const rows=()=>[a,b].map(userId=>({userId,displayName:userId,state:states.get(userId)})),storage={load:async id=>states.get(id)||null,save:async(id,value)=>states.set(id,value),profile:async id=>({userId:id,displayName:id}),listAccounts:async({offset=0,limit=100}={})=>({total:2,accounts:rows().slice(offset,offset+limit)}),backup:async()=>''},service=new AdminService({storage,catalog:v3Catalog,isAdmin:()=>true});
 assert.deepEqual(await service.resolveGiftAudience({scope:'selected',userIds:[a,b,a]}),[a,b]);assert.deepEqual(await service.resolveGiftAudience({scope:'rank',tierId:'challenger'}),[b]);assert.deepEqual(await service.resolveGiftAudience({scope:'all'}),[a,b]);
});

test('player gift projection does not expose the sending admin account id',()=>{
 const state=makeState(),draft=normalizeGiftDraft({coins:1},v3Catalog,{campaignId:'privacy-gift',sentBy:'secret-admin-uuid',sentAt:1});enqueueAdminGift(state,draft.gift);const view=adminGiftView(state,v3Catalog,{now:2});assert.equal(Object.hasOwn(view.gifts[0],'sentBy'),false);
});


test('admin and player UI expose Gift Center, live operations, mission controls and claimable admin mail',async()=>{
 const adminClient=await readFile(new URL('../public/admin.js',import.meta.url),'utf8'),playerClient=await readFile(new URL('../public/client.js',import.meta.url),'utf8'),css=await readFile(new URL('../public/admin.css',import.meta.url),'utf8');
 assert.match(adminClient,/Server resources/);assert.match(adminClient,/Capacity rejected/);
 assert.match(adminClient,/Gift Center/);assert.match(adminClient,/Bag Tickets/);assert.match(adminClient,/data-tickets-form/);assert.match(adminClient,/tickets\.set/);assert.match(adminClient,/Expires if unread/);assert.match(adminClient,/Expires after opened/);assert.match(adminClient,/step=\"0\.01\"/);assert.match(adminClient,/Search name, type, ID or ownership/);assert.match(adminClient,/Search name, category, source, ID or ownership/);assert.match(adminClient,/adminItemSearchText/);assert.match(adminClient,/adminSearchMatch/);assert.match(adminClient,/Live Operations/);assert.match(adminClient,/data-mission-category-op="completeCategory"/);assert.match(adminClient,/data-live-stop/);assert.match(adminClient,/scope==='all'/);assert.match(playerClient,/adminGift\.claim/);assert.match(playerClient,/mailboxV1\.read/);assert.match(playerClient,/adminGiftsV1/);assert.match(css,/mission-admin-row/);assert.match(css,/live-row/);
});
