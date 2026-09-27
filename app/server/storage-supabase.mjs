import {createHash} from 'node:crypto';
import {validCampaignId} from './admin-campaigns.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_RESPONSE_BYTES=16*1024*1024;
async function boundedResponseText(response){
 const reader=response.body?.getReader?.();if(!reader){const text=await response.text();if(Buffer.byteLength(text)>MAX_RESPONSE_BYTES)throw Object.assign(new Error('Supabase response too large'),{code:'STORAGE_RESPONSE_TOO_LARGE'});return text;}
 const chunks=[];let length=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
   if(length>MAX_RESPONSE_BYTES)throw Object.assign(new Error('Supabase response too large'),{code:'STORAGE_RESPONSE_TOO_LARGE'});
   chunks.push(Buffer.from(value));
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 return Buffer.concat(chunks,length).toString('utf8');
}

export class SupabaseAdventureStorage{
 constructor({url,secretKey,fetchImpl=fetch,timeoutMs=10000}){this.url=String(url||'').replace(/\/$/,'');this.secretKey=secretKey||'';this.fetchImpl=fetchImpl;this.timeoutMs=Number.isInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=120000?timeoutMs:10000;this.configured=!!(this.url&&this.secretKey);this.revisions=new Map();}
 isAccountRoom(room){return UUID.test(room);}
 owns(room){return this.configured&&this.isAccountRoom(room);}
 async request(path,init={}){
  const legacy=String(this.secretKey).startsWith('eyJ'),controller=new AbortController();let timedOut=false,timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(new Error('STORAGE_REQUEST_DEADLINE'));},this.timeoutMs)});
  try{
   const signal=init.signal?AbortSignal.any([init.signal,controller.signal]):controller.signal;
   // Deadline covers headers AND response body, not just fetch() resolving.
   const body=async()=>{
    const response=await this.fetchImpl(`${this.url}/rest/v1/${path}`,{...init,signal,headers:{apikey:this.secretKey,...(legacy?{Authorization:`Bearer ${this.secretKey}`}:{ }),Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
    if(!response.ok){const error=new Error(`Supabase storage request failed (${response.status})`);error.status=response.status;error.code=[409,412].includes(response.status)?'STORAGE_REVISION_CONFLICT':'STORAGE_HTTP_ERROR';throw error;}
    const length=Number(response.headers?.get('content-length'));if(length>MAX_RESPONSE_BYTES)throw Object.assign(new Error('Supabase response too large'),{code:'STORAGE_RESPONSE_TOO_LARGE'});
    // Read once while the timer remains active. The proxy retains only public
    // Response metadata, never auth headers or an upstream response object.
    const text=await boundedResponseText(response);
    return {ok:true,status:response.status,headers:response.headers,json:async()=>{
     try{return JSON.parse(text);}catch{throw Object.assign(new Error('Invalid Supabase JSON response'),{code:'STORAGE_BAD_JSON'});}
    }};
   };
   return await Promise.race([body(),deadline]);
  }catch(error){
   if(timedOut)throw Object.assign(new Error('Supabase request deadline exceeded; the write outcome may be unknown'),{code:'STORAGE_TIMEOUT',retryable:true,cause:error});
   if(error?.name==='AbortError')throw Object.assign(new Error('Supabase request cancelled'),{code:'STORAGE_CANCELLED',cause:error});
   if(error?.code)throw error;
   throw Object.assign(new Error('Supabase request unavailable'),{code:'STORAGE_UNAVAILABLE',retryable:true,cause:error});
  }finally{clearTimeout(timer);}
 }
 async load(userId){const response=await this.request(`game_saves?user_id=eq.${encodeURIComponent(userId)}&select=state,revision&limit=1`),rows=await response.json(),row=rows[0];this.revisions.set(userId,row?Number(row.revision):null);return row?.state??null;}
 async profile(userId){const response=await this.request(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,display_name,avatar_url,created_at,updated_at&limit=1`),rows=await response.json(),row=rows[0];return row?{userId:row.user_id,displayName:row.display_name,avatarUrl:row.avatar_url,createdAt:row.created_at,updatedAt:row.updated_at}:null;}
 async listAccounts({search='',limit=50,offset=0}={}){
  const take=Math.min(100,Math.max(1,Math.trunc(limit)||50)),skip=Math.max(0,Math.trunc(offset)||0),params=new URLSearchParams({select:'user_id,display_name,avatar_url,created_at,updated_at',order:'updated_at.desc',limit:String(take),offset:String(skip)}),query=String(search||'').trim().replace(/[,*()]/g,'').slice(0,80);
  if(query){if(UUID.test(query))params.set('user_id',`eq.${query}`);else params.set('display_name',`ilike.*${query}*`);}
  const response=await this.request(`profiles?${params}`,{headers:{Prefer:'count=exact'}}),profiles=await response.json(),range=response.headers.get('content-range')||'',total=Number(range.split('/')[1]);
  if(!profiles.length)return {total:Number.isFinite(total)?total:0,accounts:[]};
  const ids=profiles.map(row=>row.user_id),saveParams=new URLSearchParams({select:'user_id,schema_version,revision,updated_at,state'});saveParams.set('user_id',`in.(${ids.join(',')})`);
  const saveResponse=await this.request(`game_saves?${saveParams}`),saves=await saveResponse.json(),byId=new Map(saves.map(row=>[row.user_id,row]));
  return {total:Number.isFinite(total)?total:profiles.length,accounts:profiles.map(row=>{const save=byId.get(row.user_id);return {userId:row.user_id,displayName:row.display_name,avatarUrl:row.avatar_url,createdAt:row.created_at,updatedAt:save?.updated_at||row.updated_at,schemaVersion:save?.schema_version||null,revision:save?.revision||0,state:save?.state||null};})};
 }
 async save(userId,state){
  if(!this.revisions.has(userId))throw Object.assign(new Error('Cloud save must be loaded before it can be written'),{code:'STORAGE_REVISION_REQUIRED'});
  const expected=this.revisions.get(userId),record={schema_version:Number(state?.schemaVersion)||3,state};
  const path=expected===null?'game_saves':`game_saves?user_id=eq.${encodeURIComponent(userId)}&revision=eq.${expected}&select=revision`,response=await this.request(path,{method:expected===null?'POST':'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(expected===null?{user_id:userId,...record}:record)}),rows=await response.json();
  if(!rows[0])throw Object.assign(new Error('Cloud save revision conflict'),{code:'STORAGE_REVISION_CONFLICT'});this.revisions.set(userId,Number(rows[0].revision));
 }
 async savePair(entries,operationId){
  const ordered=[...entries].sort((a,b)=>a.userId.localeCompare(b.userId));if(ordered.length!==2||ordered[0].userId===ordered[1].userId||ordered.some(entry=>!this.revisions.has(entry.userId)))throw Object.assign(new Error('Two loaded cloud saves are required'),{code:'STORAGE_PAIR_INVALID'});
  const payload={p_operation_id:String(operationId),p_fingerprint:fingerprint(ordered.map(entry=>[entry.userId,entry.state])),p_left_user_id:ordered[0].userId,p_left_expected_revision:this.revisions.get(ordered[0].userId),p_left_state:ordered[0].state,p_right_user_id:ordered[1].userId,p_right_expected_revision:this.revisions.get(ordered[1].userId),p_right_state:ordered[1].state},response=await this.request('rpc/save_game_state_pair',{method:'POST',body:JSON.stringify(payload)}),rows=await response.json(),result=Array.isArray(rows)?rows[0]:rows;if(!result)throw Object.assign(new Error('Cloud pair save returned no result'),{code:'STORAGE_PAIR_FAILED'});this.revisions.set(ordered[0].userId,Number(result.left_revision));this.revisions.set(ordered[1].userId,Number(result.right_revision));return {duplicate:!!result.duplicate};
 }
 async getCampaign(campaignId){if(!validCampaignId(campaignId))throw new Error('INVALID_CAMPAIGN_ID');const response=await this.request(`admin_gift_campaigns?campaign_id=eq.${encodeURIComponent(campaignId)}&select=campaign_id,fingerprint,audience,gift&limit=1`),rows=await response.json(),row=rows[0];return row?{campaignId:row.campaign_id,fingerprint:row.fingerprint,audience:row.audience,gift:row.gift}:null;}
 async registerCampaign(manifest){
  if(!validCampaignId(manifest.campaignId))throw new Error('INVALID_CAMPAIGN_ID');
  const payload={campaign_id:manifest.campaignId,fingerprint:manifest.fingerprint,audience:manifest.audience,gift:manifest.gift};
  await this.request('admin_gift_campaigns?on_conflict=campaign_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)});
  return this.getCampaign(manifest.campaignId);
 }
 async backup(userId,_backupDir,label){const response=await this.request('game_save_backups',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:userId,label:String(label||'backup').slice(0,80),state:await this.load(userId)})}),rows=await response.json();return `supabase:${userId}:${rows[0].id}`;}
 async restore(userId,reference){const id=String(reference).split(':').at(-1),response=await this.request(`game_save_backups?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`),rows=await response.json();if(!rows[0])throw new Error('Supabase backup not found');await this.load(userId);await this.save(userId,rows[0].state);return rows[0].state;}
}

export class HybridAdventureStorage{
 constructor({local,remote}){this.local=local;this.remote=remote;}
 target(room){if(this.remote.isAccountRoom?.(room)){if(!this.remote.configured)throw new Error('Supabase account save storage is required for authenticated accounts');return this.remote;}return this.local;}
 load(room){return this.target(room).load(room);}
 save(room,state){return this.target(room).save(room,state);}
 savePair(entries,operationId){const targets=[...new Set(entries.map(entry=>this.target(entry.userId)))];if(targets.length!==1||typeof targets[0].savePair!=='function')throw Object.assign(new Error('Cannot atomically save accounts across different storage providers'),{code:'STORAGE_PAIR_CROSS_BACKEND'});return targets[0].savePair(entries,operationId);}
 campaignStorage(){return this.remote.configured?this.remote:this.local;}
 getCampaign(campaignId){return this.campaignStorage().getCampaign(campaignId);}
 registerCampaign(manifest){return this.campaignStorage().registerCampaign(manifest);}
 backup(room,backupDir,label){return this.target(room).backup(room,backupDir,label);}
 restore(room,backupFile){return this.target(room).restore(room,backupFile);}
 profile(room){return this.target(room).profile?.(room)??null;}
 listAccounts(options){const target=this.remote.configured?this.remote:this.local;return target.listAccounts(options);}
}
