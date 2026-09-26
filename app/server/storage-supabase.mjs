const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SupabaseAdventureStorage{
 constructor({url,secretKey,fetchImpl=fetch}){this.url=String(url||'').replace(/\/$/,'');this.secretKey=secretKey||'';this.fetchImpl=fetchImpl;this.configured=!!(this.url&&this.secretKey);}
 isAccountRoom(room){return UUID.test(room);}
 owns(room){return this.configured&&this.isAccountRoom(room);}
 async request(path,init={}){const legacy=String(this.secretKey).startsWith('eyJ'),response=await this.fetchImpl(`${this.url}/rest/v1/${path}`,{...init,headers:{apikey:this.secretKey,...(legacy?{Authorization:`Bearer ${this.secretKey}`}:{ }),Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});if(!response.ok)throw new Error(`Supabase storage request failed (${response.status})`);return response;}
 async load(userId){const response=await this.request(`game_saves?user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`),rows=await response.json();return rows[0]?.state??null;}
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
 async save(userId,state){await this.request('game_saves?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,schema_version:Number(state?.schemaVersion)||3,state})});}
 async backup(userId,_backupDir,label){const response=await this.request('game_save_backups',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:userId,label:String(label||'backup').slice(0,80),state:await this.load(userId)})}),rows=await response.json();return `supabase:${userId}:${rows[0].id}`;}
 async restore(userId,reference){const id=String(reference).split(':').at(-1),response=await this.request(`game_save_backups?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`),rows=await response.json();if(!rows[0])throw new Error('Supabase backup not found');await this.save(userId,rows[0].state);return rows[0].state;}
}

export class HybridAdventureStorage{
 constructor({local,remote}){this.local=local;this.remote=remote;}
 target(room){if(this.remote.isAccountRoom?.(room)){if(!this.remote.configured)throw new Error('Supabase account save storage is required for authenticated accounts');return this.remote;}return this.local;}
 load(room){return this.target(room).load(room);}
 save(room,state){return this.target(room).save(room,state);}
 backup(room,backupDir,label){return this.target(room).backup(room,backupDir,label);}
 restore(room,backupFile){return this.target(room).restore(room,backupFile);}
 profile(room){return this.target(room).profile?.(room)??null;}
 listAccounts(options){const target=this.remote.configured?this.remote:this.local;return target.listAccounts(options);}
}
