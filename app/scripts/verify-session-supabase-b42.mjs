import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).flatMap(line=>{const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(!match)return [];let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);return [[match[1],value]];}));
const source={...parseEnv(await readFile(path.join(appRoot,'.dev.vars'),'utf8')),...process.env},url=String(source.SUPABASE_URL||'').replace(/\/$/,''),publishableKey=source.SUPABASE_PUBLISHABLE_KEY||'',secretKey=source.SUPABASE_SECRET_KEY||'',sessionSecret=source.AUTH_SESSION_SECRET||'';
assert.ok(process.argv.includes('--live'),'Refusing live verification without --live');
assert.ok(url.startsWith('https://')&&publishableKey&&secretKey&&sessionSecret.length>=32,'Complete Supabase and session configuration is required');
const legacySecret=secretKey.startsWith('eyJ'),adminHeaders={apikey:secretKey,'User-Agent':'PokemonVanguard-Session-Verification/1.0',...(legacySecret?{Authorization:`Bearer ${secretKey}`}:{})},marker=randomBytes(10).toString('hex'),email=`pv-b42-${marker}@example.test`,password=`B42-${randomBytes(24).toString('base64url')}!9a`;
const request=async(endpoint,{method='GET',headers={},body}={})=>{const response=await fetch(`${url}${endpoint}`,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}if(!response.ok)throw Object.assign(Error(`Supabase session verification failed (${response.status})`),{status:response.status});return data;};
const signedCookie=session=>{const payload=Buffer.from(JSON.stringify(session)).toString('base64url'),signature=createHmac('sha256',sessionSecret).update(payload).digest('base64url');return `pv_session=${payload}.${signature}`;};
const nextState=ws=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('B42 cloud state timeout')),10_000);ws.on('message',raw=>{try{const frame=JSON.parse(raw);if(frame.type==='state'){clearTimeout(timer);resolve(frame);}}catch{}});ws.once('close',(code,reason)=>{clearTimeout(timer);reject(Error(`B42 cloud socket closed ${code} ${reason}`));});});
const closeWs=ws=>new Promise(resolve=>{if(!ws||ws.readyState===WebSocket.CLOSED)return resolve();ws.once('close',resolve);ws.close();});

let userId=null,a=null,b=null,c=null,ws=null,cleanupError=null;const saveDir=await mkdtemp(path.join(tmpdir(),'pv-b42-cloud-'));
try{
 const created=await request('/auth/v1/admin/users',{method:'POST',headers:adminHeaders,body:{email,password,email_confirm:true,user_metadata:{purpose:'pokemon-vanguard-b42'}}}),user=created?.user||created;userId=user?.id;assert.match(String(userId||''),/^[0-9a-f-]{36}$/i);
 const env={AUTH_SESSION_SECRET:sessionSecret,SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:publishableKey,SUPABASE_SECRET_KEY:secretKey},session={accountId:userId,playerId:userId,roomId:userId,name:'B42 Cloud Fixture',avatar:null,provider:'google',sid:randomBytes(16).toString('base64url'),exp:Math.floor(Date.now()/1000)+3600},cookie=signedCookie(session);
 a=createLocalServer({saveDir,authRequired:true,authEnv:env});b=createLocalServer({saveDir,authRequired:true,authEnv:env});const [portA,portB]=await Promise.all([a.listen(0),b.listen(0)]);
 ws=new WebSocket(`ws://127.0.0.1:${portB}/ws/${userId}`,{headers:{Cookie:cookie}});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});const state=nextState(ws);ws.send(JSON.stringify({type:'join',playerId:userId}));await state;
 const saved=await request(`/rest/v1/game_saves?user_id=eq.${userId}&select=user_id,revision`,{headers:adminHeaders});assert.equal(saved.length,1);
 const dropped=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('B42 cloud revocation sweep timeout')),5000);ws.once('close',(code,reason)=>{clearTimeout(timer);resolve({code,reason:String(reason)});});});
 const logout=await fetch(`http://127.0.0.1:${portA}/api/auth/logout`,{method:'POST',headers:{Cookie:cookie},redirect:'manual'});assert.equal(logout.status,303);const closed=await dropped;assert.equal(closed.code,4001);assert.match(closed.reason,/revoked/);
 await Promise.all([a.close(),b.close()]);a=b=null;c=createLocalServer({saveDir,authRequired:true,authEnv:env});const portC=await c.listen(0),status=await fetch(`http://127.0.0.1:${portC}/api/auth/session`,{headers:{Cookie:cookie}}).then(response=>response.json());assert.equal(status.authenticated,false);
}finally{
 await closeWs(ws).catch(()=>{});await a?.close().catch(()=>{});await b?.close().catch(()=>{});await c?.close().catch(()=>{});
 if(userId)try{await request(`/auth/v1/admin/users/${userId}`,{method:'DELETE',headers:adminHeaders});}catch(error){cleanupError=error;}
 await rm(saveDir,{recursive:true,force:true});
}
if(cleanupError)throw cleanupError;
console.log(JSON.stringify({status:'PASS',batch:'B42',checks:['supabase-uuid-save','cross-server-socket-revocation','restart-rejection'],fixtureCleanup:'PASS'},null,2));
