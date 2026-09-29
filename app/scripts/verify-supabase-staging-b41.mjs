import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SupabaseAdventureStorage} from '../server/storage-supabase.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).flatMap(line=>{
 const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(!match)return [];
 let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
 return [[match[1],value]];
}));
const env={...parseEnv(await readFile(path.join(appRoot,'.dev.vars'),'utf8')),...process.env};
const url=String(env.SUPABASE_URL||'').replace(/\/$/,''),publishableKey=env.SUPABASE_PUBLISHABLE_KEY||'',secretKey=env.SUPABASE_SECRET_KEY||'';
assert.ok(url.startsWith('https://')&&publishableKey&&secretKey,'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are required');
assert.ok(process.argv.includes('--live'),'Refusing live verification without --live');

const legacySecret=secretKey.startsWith('eyJ'),userAgent='PokemonVanguard-Supabase-Verification/1.0';
const headers=(key,token=null)=>({apikey:key,'User-Agent':userAgent,...(token?{Authorization:`Bearer ${token}`}:{})});
const bodyText=async response=>{const text=await response.text();if(!text)return null;try{return JSON.parse(text);}catch{return text.slice(0,500);}};
async function request(endpoint,{method='GET',key=publishableKey,token=null,body,prefer}={}){
 const response=await fetch(`${url}${endpoint}`,{method,headers:{...headers(key,token),...(body?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},body:body?JSON.stringify(body):undefined});
 const data=await bodyText(response);
 if(!response.ok){const error=new Error(`Supabase verification request failed (${response.status})`);error.status=response.status;error.details=typeof data==='object'?data?.code||data?.message:null;throw error;}
 return data;
}
const rest=(resource,options={})=>request(`/rest/v1/${resource}`,options);
const adminAuth=(resource,options={})=>request(`/auth/v1/admin/${resource}`,{...options,key:secretKey,token:legacySecret?secretKey:null});
const expectDenied=async operation=>{try{await operation();assert.fail('request unexpectedly succeeded');}catch(error){assert.ok([401,403,404].includes(error.status),`expected access denial, received ${error.status||error.code||error.message}`);}};
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const marker=randomBytes(10).toString('hex'),campaignId=`b41-live-${marker}`,displayPrefix=`PV B41 ${marker}`;
const password=`B41-${randomBytes(24).toString('base64url')}!9a`;
const users=[];
let campaignCreated=false,primaryError=null;
const checks=[];
const record=name=>checks.push(name);

async function createUser(label){
 const result=await adminAuth('users',{method:'POST',body:{email:`pv-b41-${label}-${marker}@example.test`,password,email_confirm:true,user_metadata:{purpose:'pokemon-vanguard-b41'}}});
 const user=result?.user||result;assert.match(String(user?.id||''),/^[0-9a-f-]{36}$/i);users.push(user.id);return user.id;
}
async function signIn(label){
 const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:`pv-b41-${label}-${marker}@example.test`,password}});
 assert.ok(result?.access_token);return result.access_token;
}
async function row(userId){
 const rows=await rest(`game_saves?user_id=eq.${userId}&select=state,revision`,{key:secretKey,token:legacySecret?secretKey:null});
 assert.equal(rows.length,1);return rows[0];
}

try{
 const first=await createUser('a'),second=await createUser('b'),ids=[first,second].sort();
 const profiles=ids.map((userId,index)=>({user_id:userId,display_name:`${displayPrefix} ${index+1}`}));
 const saves=ids.map((userId,index)=>({user_id:userId,schema_version:3,revision:0,state:{schemaVersion:3,b41:{marker,index,step:'initial'}}}));
 await rest('profiles',{method:'POST',key:secretKey,token:legacySecret?secretKey:null,prefer:'return=minimal',body:profiles});
 await rest('game_saves',{method:'POST',key:secretKey,token:legacySecret?secretKey:null,prefer:'return=minimal',body:saves});
 record('isolated-auth-fixture');

 const token=await signIn(first===ids[0]?'a':'b');
 const own=await rest(`profiles?user_id=eq.${ids[0]}&select=user_id`,{token}),other=await rest(`profiles?user_id=eq.${ids[1]}&select=user_id`,{token});
 assert.deepEqual(own,[{user_id:ids[0]}]);assert.deepEqual(other,[]);
 await expectDenied(()=>rest(`profiles?user_id=eq.${ids[0]}`,{method:'PATCH',token,body:{display_name:'forbidden'}}));
 await expectDenied(()=>rest('profiles?select=user_id'));
 await expectDenied(()=>rest('rpc/save_game_state_pair',{method:'POST',token,body:{}}));
 await expectDenied(()=>rest('rpc/admin_account_aggregate',{method:'POST',token,body:{}}));
 record('rls-and-rpc-role-denial');

 const firstWriter=new SupabaseAdventureStorage({url,secretKey}),staleWriter=new SupabaseAdventureStorage({url,secretKey});
 await firstWriter.load(ids[0]);await staleWriter.load(ids[0]);
 await firstWriter.save(ids[0],{schemaVersion:3,b41:{marker,step:'cas-winner'}});
 await assert.rejects(()=>staleWriter.save(ids[0],{schemaVersion:3,b41:{marker,step:'cas-stale'}}),error=>error?.code==='STORAGE_REVISION_CONFLICT');
 assert.equal((await row(ids[0])).state.b41.step,'cas-winner');record('optimistic-cas-conflict');

 const pairStore=new SupabaseAdventureStorage({url,secretKey});await Promise.all(ids.map(id=>pairStore.load(id)));
 const pairStates=ids.map((id,index)=>({userId:id,state:{schemaVersion:3,b41:{marker,index,step:'pair-commit'}}}));
 const operationId=`b41:pair:${marker}`,committed=await pairStore.savePair(pairStates,operationId),duplicate=await pairStore.savePair(pairStates,operationId);
 assert.equal(committed.duplicate,false);assert.equal(duplicate.duplicate,true);
 await assert.rejects(()=>pairStore.savePair(pairStates.map((entry,index)=>index?entry:{...entry,state:{schemaVersion:3,b41:{marker,step:'pair-conflict'}}}),operationId));
 assert.deepEqual((await Promise.all(ids.map(row))).map(item=>item.state.b41.step),['pair-commit','pair-commit']);
 record('pair-commit-duplicate-conflict');

 const rollbackStore=new SupabaseAdventureStorage({url,secretKey}),rightWriter=new SupabaseAdventureStorage({url,secretKey});
 await Promise.all(ids.map(id=>rollbackStore.load(id)));await rightWriter.load(ids[1]);
 const leftBefore=await row(ids[0]);await rightWriter.save(ids[1],{schemaVersion:3,b41:{marker,step:'right-winner'}});
 await assert.rejects(()=>rollbackStore.savePair([
  {userId:ids[0],state:{schemaVersion:3,b41:{marker,step:'must-roll-back'}}},
  {userId:ids[1],state:{schemaVersion:3,b41:{marker,step:'stale-right'}}}
 ],`b41:rollback:${marker}`));
 const leftAfter=await row(ids[0]),rightAfter=await row(ids[1]);
 assert.equal(leftAfter.revision,leftBefore.revision);assert.deepEqual(leftAfter.state,leftBefore.state);assert.equal(rightAfter.state.b41.step,'right-winner');
 record('pair-transaction-rollback');

 const service=new SupabaseAdventureStorage({url,secretKey});
 const page=await service.listAccounts({search:displayPrefix,limit:10}),aggregate=await service.overviewAggregate(),audience=await service.listAudienceIds({limit:1});
 assert.equal(page.total,2);assert.equal(page.accounts.length,2);assert.ok(aggregate.players>=2);assert.equal(audience.length,1);
 record('admin-reporting-rpcs');

 const manifest={campaignId,fingerprint:sha({marker}),audience:ids,gift:{wallet:{coins:1}}};
 campaignCreated=true;
 const registered=await service.registerCampaign(manifest);assert.deepEqual(registered,manifest);
 await expectDenied(()=>rest(`admin_gift_campaigns?campaign_id=eq.${campaignId}&select=campaign_id`));
 await expectDenied(()=>rest(`admin_gift_campaigns?campaign_id=eq.${campaignId}&select=campaign_id`,{token}));
 record('campaign-service-role-only');
}catch(error){primaryError=error;
}finally{
 const cleanupErrors=[];
 if(campaignCreated){try{await rest(`admin_gift_campaigns?campaign_id=eq.${campaignId}`,{method:'DELETE',key:secretKey,token:legacySecret?secretKey:null,prefer:'return=minimal'});}catch(error){cleanupErrors.push(error);}}
 for(const id of users.reverse()){try{await adminAuth(`users/${id}`,{method:'DELETE'});}catch(error){cleanupErrors.push(error);}}
 if(cleanupErrors.length&&!primaryError)primaryError=new AggregateError(cleanupErrors,'Supabase fixture cleanup failed');
}

if(primaryError)throw primaryError;
console.log(JSON.stringify({status:'PASS',batch:'B41',checks,fixtureCleanup:'PASS'},null,2));
