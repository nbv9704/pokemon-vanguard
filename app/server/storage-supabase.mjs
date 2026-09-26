const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SupabaseAdventureStorage{
 constructor({url,secretKey,fetchImpl=fetch}){this.url=String(url||'').replace(/\/$/,'');this.secretKey=secretKey||'';this.fetchImpl=fetchImpl;this.configured=!!(this.url&&this.secretKey);}
 owns(room){return this.configured&&UUID.test(room);}
 async request(path,init={}){const legacy=String(this.secretKey).startsWith('eyJ'),response=await this.fetchImpl(`${this.url}/rest/v1/${path}`,{...init,headers:{apikey:this.secretKey,...(legacy?{Authorization:`Bearer ${this.secretKey}`}:{ }),Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});if(!response.ok)throw new Error(`Supabase storage request failed (${response.status})`);return response;}
 async load(userId){const response=await this.request(`game_saves?user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`),rows=await response.json();return rows[0]?.state??null;}
 async save(userId,state){await this.request('game_saves?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,schema_version:Number(state?.schemaVersion)||3,state})});}
 async backup(userId,_backupDir,label){const response=await this.request('game_save_backups',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:userId,label:String(label||'backup').slice(0,80),state:await this.load(userId)})}),rows=await response.json();return `supabase:${userId}:${rows[0].id}`;}
 async restore(userId,reference){const id=String(reference).split(':').at(-1),response=await this.request(`game_save_backups?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`),rows=await response.json();if(!rows[0])throw new Error('Supabase backup not found');await this.save(userId,rows[0].state);return rows[0].state;}
}

export class HybridAdventureStorage{
 constructor({local,remote}){this.local=local;this.remote=remote;}
 target(room){return this.remote.owns(room)?this.remote:this.local;}
 load(room){return this.target(room).load(room);}
 save(room,state){return this.target(room).save(room,state);}
 backup(room,backupDir,label){return this.target(room).backup(room,backupDir,label);}
 restore(room,backupFile){return this.target(room).restore(room,backupFile);}
}
