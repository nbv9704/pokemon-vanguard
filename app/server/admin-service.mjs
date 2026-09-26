import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {applyAdminMutation,appendAdminAudit} from './admin-mutations.mjs';
import {adminPlayerDetail,adminPlayerSummary} from './admin-projection.mjs';
import {enqueueAdminGift,normalizeGiftDraft} from './admin-gifts.mjs';
import {MISSION_DEFINITIONS} from './missions.mjs';
import {RANKED_TIERS,rankedTierView} from './ranked-tiers.mjs';
import {MAIL_RETENTION_PRESETS,mailboxDurationDays} from './mailbox-v1.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
async function body(req,max=64*1024){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Object.assign(new Error('Request too large'),{statusCode:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw Object.assign(new Error('Invalid JSON'),{statusCode:400});}}
const safeUserId=value=>String(value||'').slice(0,128);
const validUserId=value=>UUID.test(value)||value.startsWith('dev:')||value.startsWith('aether-');
const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim();

async function pooled(items,limit,worker){
 const queue=[...items],results=[];async function run(){while(queue.length){const item=queue.shift();results.push(await worker(item));}}await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return results;
}

export class AdminService{
 constructor({storage,catalog,clock={now:()=>Date.now()},isAdmin=()=>false,isOnline=()=>false,listOnlineAccountIds=()=>[],getLiveState=()=>null,setLiveState=()=>{},notify=()=>{},disconnect=()=>{},withAccountLock=async(_accountId,work)=>work(),liveOperations={overview:async()=>({}),statusForPlayer:()=>null,stopForPlayer:async()=>({ok:false})},backupDir='.admin-backups'}){
  Object.assign(this,{storage,catalog,clock,isAdmin,isOnline,listOnlineAccountIds,getLiveState,setLiveState,notify,disconnect,withAccountLock,liveOperations,backupDir});
 }
 async record(userId){const state=this.getLiveState(userId)||await this.storage.load(userId),profile=await this.storage.profile?.(userId);if(!state&&!profile)return null;return {userId,displayName:profile?.displayName||state?.owner||userId,avatarUrl:profile?.avatarUrl||null,createdAt:profile?.createdAt||null,updatedAt:profile?.updatedAt||null,schemaVersion:state?.schemaVersion||null,revision:state?.revision||0,state};}
 async detail(record,userId){const projected=adminPlayerDetail(record,this.catalog,{online:this.isOnline(userId),now:this.clock.now()}),external=this.liveOperations.statusForPlayer?.(userId)||null,v3=record.state?.battleV3,v2=record.state?.battleV2,local=!external&&v3&&v3.phase!=='FINISHED'?{kind:'pve',id:v3.id||`pve:${userId}`,mode:v3.mode||'single',status:v3.phase,difficulty:v3.difficulty||'normal'}:!external&&v2&&v2.phase!=='FINISHED'?{kind:'pve-v2',id:v2.id||`pve-v2:${userId}`,mode:v2.mode||'single',status:v2.phase,difficulty:v2.difficulty||'normal'}:null;return {...projected,live:external||local};}
 async overview(){
  const listed=await this.storage.listAccounts({limit:100,offset:0}),summaries=listed.accounts.map(record=>adminPlayerSummary(record,{online:this.isOnline(record.userId)})),live=await this.liveOperations.overview();
  return {players:listed.total,loaded:summaries.length,online:summaries.filter(x=>x.online).length,suspended:summaries.filter(x=>x.suspended).length,totalVp:summaries.reduce((n,x)=>n+x.wallet.coins,0),totalCrystals:summaries.reduce((n,x)=>n+x.wallet.crystals,0),activeRanked:(live.ranked?.matches?.length||0)+(live.ranked?.queue?.length||0),activeFriendly:live.friendly?.rooms?.length||0,rankDistribution:Object.fromEntries([...new Set(summaries.map(x=>x.ranked.tier))].map(tier=>[tier,summaries.filter(x=>x.ranked.tier===tier).length]))};
 }
 async listAllAccounts(){
  const out=[];let offset=0,total=Infinity;while(offset<total){const page=await this.storage.listAccounts({limit:100,offset});out.push(...page.accounts);total=Number.isFinite(page.total)?page.total:out.length;if(!page.accounts.length)break;offset+=page.accounts.length;if(out.length>50_000)throw new Error('ADMIN_AUDIENCE_TOO_LARGE');}return out;
 }
 async resolveGiftAudience(target){
  const scope=target?.scope||'player';
  if(scope==='player'){const id=safeUserId(target.userId);return validUserId(id)?[id]:[];}
  if(scope==='selected')return [...new Set((target.userIds||[]).map(safeUserId).filter(validUserId))].slice(0,200);
  if(scope==='online')return [...new Set(this.listOnlineAccountIds())];
  const records=await this.listAllAccounts();if(scope==='all')return records.map(record=>record.userId);
  if(scope==='rank'){const tierId=String(target.tierId||'');return records.filter(record=>rankedTierView(record.state?.rankedV1?.rating||1000).tierId===tierId).map(record=>record.userId);}
  return [];
 }
 async sendGiftCampaign(session,payload){
  const campaignId=randomUUID(),normalized=normalizeGiftDraft(payload.gift,this.catalog,{campaignId,sentBy:session.accountId,sentAt:this.clock.now()});if(!normalized.ok)return {status:400,body:{error:normalized.code}};
  const accountIds=await this.resolveGiftAudience(payload.target);if(!accountIds.length)return {status:400,body:{error:'GIFT_AUDIENCE_EMPTY'}};
  const results=await pooled(accountIds,12,async userId=>this.withAccountLock(userId,async()=>{try{const record=await this.record(userId);if(!record?.state)return {userId,ok:false,error:'PLAYER_SAVE_NOT_FOUND'};const state=structuredClone(record.state),queued=enqueueAdminGift(state,normalized.gift);appendAdminAudit(state,{adminId:session.accountId,action:'gift.send',details:{campaignId,title:normalized.gift.title,mailType:normalized.gift.mailType,unreadTtlMs:normalized.gift.unreadTtlMs,readTtlMs:normalized.gift.readTtlMs,duplicate:!!queued.duplicate},now:this.clock.now()});await this.storage.save(userId,state);this.setLiveState(userId,state);this.notify([userId]);return {userId,ok:true,duplicate:!!queued.duplicate};}catch(error){return {userId,ok:false,error:error.message||'GIFT_DELIVERY_FAILED'};}}));
  const delivered=results.filter(entry=>entry.ok).length,failed=results.filter(entry=>!entry.ok);return {status:200,body:{ok:true,campaignId,targeted:accountIds.length,delivered,failed:failed.length,errors:failed.slice(0,20)}};
 }
 async handlePlayerAction(userId,action,session){
  return this.withAccountLock(userId,async()=>{
   const record=await this.record(userId);if(!record?.state)return {status:404,body:{error:'PLAYER_SAVE_NOT_FOUND'}};
   if(action.type==='save.backup'){const reference=await this.storage.backup(userId,this.backupDir,`admin-${new Date(this.clock.now()).toISOString().replace(/[:.]/g,'-')}`);return {status:200,body:{ok:true,reference}};}
   if(action.type==='session.disconnect'){
    const state=structuredClone(record.state);appendAdminAudit(state,{adminId:session.accountId,action:'session.disconnect',details:{reason:clean(action.reason).slice(0,240)},now:this.clock.now()});await this.storage.save(userId,state);this.setLiveState(userId,state);this.disconnect(userId,'ADMIN_DISCONNECT');return {status:200,body:{ok:true,player:await this.detail({...record,state},userId)}};
   }
   if(action.type==='battle.stop'){
    const external=await this.liveOperations.stopForPlayer?.(userId,clean(action.reason).slice(0,120)||'admin-stop'),local=applyAdminMutation(record.state,{type:'battle.stopLocal'},this.catalog,{now:this.clock.now()});
    if(!external?.ok&&!local.ok)return {status:400,body:{error:'NO_ACTIVE_BATTLE'}};const state=local.ok?local.state:structuredClone(record.state),stopped=[...(local.ok?local.details.stopped:[]),...(external?.ok?[external.kind]:[])];appendAdminAudit(state,{adminId:session.accountId,action:'battle.stop',details:{stopped,reason:clean(action.reason).slice(0,120)},now:this.clock.now()});await this.storage.save(userId,state);this.setLiveState(userId,state);this.notify([userId,...(external?.accounts||[])]);return {status:200,body:{ok:true,stopped,player:await this.detail({...record,state},userId)}};
   }
   const result=applyAdminMutation(record.state,action,this.catalog,{now:this.clock.now()});if(!result.ok)return {status:400,body:{error:result.code,details:result.details||[]}};
   appendAdminAudit(result.state,{adminId:session.accountId,action:action.type,details:result.details,now:this.clock.now()});await this.storage.save(userId,result.state);this.setLiveState(userId,result.state);this.notify([userId]);if(action.type==='account.suspend'&&result.state.adminV1?.suspended)this.disconnect(userId,'ACCOUNT_SUSPENDED');return {status:200,body:{ok:true,player:await this.detail({...record,state:result.state},userId)}};
  });
 }
 async handle(req,res,url,session){
  if(!url.pathname.startsWith('/api/admin'))return false;if(!session)return json(res,401,{error:'AUTH_REQUIRED'}),true;if(!this.isAdmin(session))return json(res,403,{error:'ADMIN_REQUIRED'}),true;
  if(req.method==='POST'&&req.headers.origin){try{if(new URL(req.headers.origin).host!==url.host)return json(res,403,{error:'ORIGIN_MISMATCH'}),true;}catch{return json(res,403,{error:'ORIGIN_MISMATCH'}),true;}}
  if(url.pathname==='/api/admin/overview'&&req.method==='GET'){json(res,200,await this.overview());return true;}
  if(url.pathname==='/api/admin/catalog'&&req.method==='GET'){json(res,200,{items:this.catalog.items.filter(item=>item.enabledForBattle).map(item=>({id:item.id,name:item.name,category:item.category})),pokemon:this.catalog.species.filter(species=>species.enabledForBattle).map(species=>({id:species.id,name:species.name})),missions:MISSION_DEFINITIONS,rankTiers:RANKED_TIERS,mailRetentionPresets:Object.values(MAIL_RETENTION_PRESETS).map(preset=>({id:preset.id,name:preset.label,unreadDays:mailboxDurationDays(preset.unreadTtlMs),readDays:mailboxDurationDays(preset.readTtlMs)}))});return true;}
  if(url.pathname==='/api/admin/live'&&req.method==='GET'){json(res,200,await this.liveOperations.overview());return true;}
  if(url.pathname==='/api/admin/gifts'&&req.method==='POST'){const outcome=await this.sendGiftCampaign(session,await body(req));json(res,outcome.status,outcome.body);return true;}
  if(url.pathname==='/api/admin/players'&&req.method==='GET'){const search=url.searchParams.get('search')||'',limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||25)),offset=Math.max(0,Number(url.searchParams.get('offset'))||0),listed=await this.storage.listAccounts({search,limit,offset});json(res,200,{total:listed.total,players:listed.accounts.map(record=>adminPlayerSummary(record,{online:this.isOnline(record.userId)}))});return true;}
  const match=/^\/api\/admin\/players\/([^/]+)$/.exec(url.pathname),actionMatch=/^\/api\/admin\/players\/([^/]+)\/action$/.exec(url.pathname);
  if(match&&req.method==='GET'){const userId=safeUserId(decodeURIComponent(match[1])),record=await this.record(userId);if(!record?.state)return json(res,404,{error:'PLAYER_SAVE_NOT_FOUND'}),true;json(res,200,await this.detail(record,userId));return true;}
  if(actionMatch&&req.method==='POST'){const userId=safeUserId(decodeURIComponent(actionMatch[1]));if(!validUserId(userId))return json(res,400,{error:'INVALID_PLAYER_ID'}),true;const outcome=await this.handlePlayerAction(userId,await body(req),session);json(res,outcome.status,outcome.body);return true;}
  json(res,405,{error:'ADMIN_ENDPOINT_NOT_FOUND'});return true;
 }
}
