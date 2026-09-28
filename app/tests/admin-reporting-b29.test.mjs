import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AdminService} from '../server/admin-service.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {SupabaseAdventureStorage} from '../server/storage-supabase.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {adminPlayerSummary} from '../server/admin-projection.mjs';

const cleanState=(id,index)=>({owner:id,schemaVersion:3,revision:1,wallet:{coins:100+index,crystals:index,recruitmentTickets:0},adminV1:{suspended:index%7===0},rankedV1:{rating:1000+index*8,matches:index}});
const uuid=index=>`a0000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const service=storage=>new AdminService({storage,catalog:v3Catalog,listOnlineAccountIds:()=>[uuid(1),uuid(225)],clock:{now:()=>100000},isAdmin:()=>true});

test('overview aggregates all 225 accounts, including accounts beyond first 100, with known ranks',async()=>{
 const accounts=Array.from({length:225},(_,index)=>({userId:uuid(index),displayName:`Trainer ${index}`,state:cleanState(uuid(index),index)}));
 const storage={listAccounts:async({offset,limit})=>({total:accounts.length,accounts:accounts.slice(offset,offset+limit)})};
 const result=await service(storage).overview();
 assert.equal(result.players,225);assert.equal(result.sampledAccounts,225);assert.equal(result.aggregateScope,'all');
 assert.equal(result.online,2);assert.equal(result.suspended,accounts.filter((_,i)=>i%7===0).length);
 assert.equal(result.totalVp,accounts.reduce((a,_,i)=>a+100+i,0));
 assert.equal(result.totalCrystals,accounts.reduce((a,_,i)=>a+i,0));
 assert.equal(Object.values(result.rankDistribution).reduce((a,b)=>a+b,0),225);
});

test('JSON local ID cursor does not duplicate or omit users when updatedAt mutates',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-admin-b29-'));
 try{
  const store=new JsonAdventureStorage(dir);
  for(let index=0;index<151;index++)await store.save(`player-${String(index).padStart(3,'0')}`,cleanState(`player-${index}`,index));
  const page1=await store.listAudienceIds({limit:100});
  await store.save('player-010',{...await store.load('player-010'),updatedAt:'2099-01-01T00:00:00Z'});
  const page2=await store.listAudienceIds({after:page1.at(-1),limit:100});
  assert.equal(page1.length,100);assert.equal(page2.length,51);assert.equal(new Set([...page1,...page2]).size,151);
  const summary=(await store.listAccounts({limit:100,offset:100})).accounts.map(adminPlayerSummary);
  assert.equal(summary.length,51);assert.equal(summary.at(-1).userId,'player-150');
  const challenger=await store.listAudienceIds({tierId:'challenger'});assert.equal(challenger.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Supabase admin endpoints only request server-role summary, aggregate and keyset RPCs',async()=>{
 const calls=[],id=uuid(1),metric={wallet:{coins:789,crystals:90,recruitmentTickets:0},ticketBagV1:{shopTickets:0,trainingTickets:0,rankTickets:0},rankedV1:{rating:2500,matches:5},suspended:true,ownedPokemon:3,ownedItems:2};
 const mock=async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('rpc/admin_account_page'))return Response.json([{user_id:id,display_name:'Trainer',avatar_url:null,created_at:null,updated_at:null,revision:9,schema_version:3,metrics:metric,total:225}]);
  if(url.endsWith('rpc/admin_account_aggregate'))return Response.json([{players:225,suspended:10,total_vp:123456,total_crystals:987,rank_distribution:{'Poké Ball':80,Challenger:145}}]);
  if(url.endsWith('rpc/admin_gift_audience_page'))return Response.json([{user_id:id}]);
  throw Error(`Forbidden admin SQL path: ${url}`);
 };
 const store=new SupabaseAdventureStorage({url:'https://db.example.invalid',secretKey:'test-service-role',fetchImpl:mock});
 const listed=await store.listAccounts({limit:50});assert.equal(listed.accounts.length,1);
 assert.equal(listed.accounts[0].state,undefined);assert.deepEqual(Object.keys(listed.accounts[0].metrics).sort(),Object.keys(metric).sort());
 const projected=adminPlayerSummary(listed.accounts[0]);assert.equal(projected.ownedPokemon,3);assert.equal(projected.ranked.tierId,'challenger');assert.equal(projected.wallet.coins,789);
 assert.equal((await service(store).overview()).totalVp,123456);
 assert.deepEqual(await store.listAudienceIds({limit:250}),[id]);
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname.split('/').at(-1)),['admin_account_page','admin_account_aggregate','admin_gift_audience_page']);
 assert.ok(calls.every(c=>c.init.headers.apikey==='test-service-role'));
 assert.ok(calls.every(c=>!c.url.includes('game_saves')));
 await assert.rejects(()=>store.listAudienceIds({after:'bad'}),/INVALID_AUDIENCE_CURSOR/);
});

test('215-recipient campaign sends bounded 100-person chunks, supports lost ACK retries and frozen audience',async()=>{
 const ids=Array.from({length:215},(_,index)=>uuid(index)).sort(),records=new Map(ids.map((id,index)=>[id,cleanState(id,index)]));
 const campaigns=new Map(),reads=[];
 const storage={
  listAudienceIds:async({after,limit})=>{const page=ids.filter(id=>after===null||id>after).slice(0,limit);reads.push({after,size:page.length});return page;},
  load:async id=>records.get(id),profile:async id=>({userId:id,displayName:id}),
  save:async(id,state)=>{records.set(id,state);},
  getCampaign:async id=>campaigns.get(id)||null,
  registerCampaign:async m=>{if(!campaigns.has(m.campaignId))campaigns.set(m.campaignId,m);return campaigns.get(m.campaignId);}
 };
 const admin=service(storage),session={accountId:'admin'},draft={campaignId:'large-b29',target:{scope:'all'},gift:{title:'Event',coins:10}};
 const first=await admin.sendGiftCampaign(session,draft);assert.equal(first.status,200);assert.equal(first.body.delivered,100);assert.equal(first.body.nextCursor,100);assert.equal(first.body.remaining,115);
 assert.equal(campaigns.get('large-b29').audience.length,215);assert.equal(reads.length,1);
 // A failed HTTP ACK resends the same immutable command/cursor safely.
 const repeat=await admin.sendGiftCampaign(session,draft);assert.equal(repeat.body.duplicates,100);assert.equal(repeat.body.nextCursor,100);
 const second=await admin.sendGiftCampaign(session,{...draft,cursor:100});assert.equal(second.body.delivered,100);assert.equal(second.body.nextCursor,200);
 const final=await admin.sendGiftCampaign(session,{...draft,cursor:200});assert.equal(final.body.delivered,15);assert.equal(final.body.nextCursor,null);
 assert.ok([...records.values()].every(s=>s.adminGiftDeliveryReceiptsV1.length===1));
 assert.ok([...records.values()].every(s=>s.adminGiftsV1.inbox.length===1));
 const bad=await admin.sendGiftCampaign(session,{...draft,cursor:10000});assert.equal(bad.body.error,'INVALID_CAMPAIGN_CURSOR');
 assert.equal(reads.length,1,'immutable manifest reused; no audience repagination during retry');
});

test('SQL read-only reporting migration grants only service role and never selects full JSON state',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/202609280003_admin_reporting.sql',import.meta.url),'utf8');
 for(const name of ['admin_account_page','admin_account_aggregate','admin_gift_audience_page']){
  assert.match(sql,new RegExp(`create or replace function public\\.${name}\\(`));
  assert.match(sql,new RegExp(`revoke all on function public\\.${name}\\([^;]+from public,anon,authenticated;`));
  assert.match(sql,new RegExp(`grant execute on function public\\.${name}\\([^;]+to service_role;`));
 }
 assert.equal((sql.match(/security definer set search_path = ''/g)||[]).length,3);
 assert.match(sql,/order by ranked\.user_id/);assert.doesNotMatch(sql,/select\s+(gs\.)?state\s+from\s+public\.game_saves/i);
 const ui=await readFile(new URL('../public/admin.js',import.meta.url),'utf8');assert.match(ui,/data-admin-more/);assert.match(ui,/result\.nextCursor/);
});

test('admin list HTTP response stays on the summary allowlist, without receipts, secrets or full state',async()=>{
 const id=uuid(100),state=cleanState(id,100);state.secret='LEAK_SENTINEL';state.adminGiftDeliveryReceiptsV1=[{private:'LEAK_SENTINEL'}];
 const storage={listAccounts:async()=>({total:1,accounts:[{userId:id,displayName:'Trainer 100',state}]})};
 const admin=service(storage),res={status:null,body:'',writeHead(status){this.status=status;},end(text){this.body=text;}};
 const handled=await admin.handle({method:'GET',headers:{}},res,new URL('http://localhost/api/admin/players'),{accountId:'admin'});
 assert.equal(handled,true);assert.equal(res.status,200);
 assert.doesNotMatch(res.body,/LEAK_SENTINEL|adminGiftDeliveryReceiptsV1|"state"/);
 assert.equal(JSON.parse(res.body).players[0].wallet.coins,200);
});
