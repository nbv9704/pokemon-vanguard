import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {friendCodeFor} from '../server/social-v1.mjs';
import {createLocalServer} from '../local-server.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const SECRET='test-session-secret-32-characters!!';
const signedCookie=(id,provider='google')=>{
 const payload=Buffer.from(JSON.stringify({accountId:id,playerId:id,roomId:id,name:id===A?'Alpha':'Bravo',provider,exp:Math.floor(Date.now()/1000)+60})).toString('base64url');
 const signature=createHmac('sha256',SECRET).update(payload).digest('base64url');return `pv_session=${payload}.${signature}`;
};
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
function mockCloud(){
 const rows=new Map([A,B].map(id=>[id,{revision:1,state:upgradeAdventureToV3(upgradeAdventure(setup([id]),v2Catalog).state,v3Catalog).state}]));
 let pairCommits=0,loseNextPairAck=true;
 const fetchImpl=async(url,init={})=>{
  const target=new URL(url),route=target.pathname,method=init.method||'GET';
  if(route.endsWith('/game_saves')){
   const id=target.searchParams.get('user_id')?.replace(/^eq\./,'');
   if(method==='GET'){const entry=rows.get(id);return json(entry?[{state:structuredClone(entry.state),revision:entry.revision}]:[]);}
   const data=JSON.parse(init.body);
   if(method==='POST'){rows.set(data.user_id,{state:data.state,revision:1});return json([{revision:1}]);}
   if(method==='PATCH'){const entry=rows.get(id),expected=Number(target.searchParams.get('revision').replace(/^eq\./,''));if(!entry||entry.revision!==expected)return json([]);entry.revision++;entry.state=data.state;return json([{revision:entry.revision}]);}
  }
  if(route.endsWith('/game_save_backups')&&method==='GET')return json([]);
  if(route.endsWith('/rpc/save_game_state_pair')){
   const data=JSON.parse(init.body),left=rows.get(data.p_left_user_id),right=rows.get(data.p_right_user_id);
   assert.equal(left.revision,data.p_left_expected_revision);assert.equal(right.revision,data.p_right_expected_revision);
   left.state=structuredClone(data.p_left_state);right.state=structuredClone(data.p_right_state);left.revision++;right.revision++;pairCommits++;
   if(loseNextPairAck){loseNextPairAck=false;throw Error('Simulated RPC response loss after commit');}
   return json({left_revision:left.revision,right_revision:right.revision,duplicate:false});
  }
  if(route.endsWith('/profiles'))return json([]);
  throw Error(`Unexpected mock storage request: ${method} ${route}`);
 };
 return {rows,fetchImpl,get pairCommits(){return pairCommits;}};
}
async function connect(port,id){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/${id}`,{headers:{Cookie:signedCookie(id)}}),frames=[],waiting=[];
 ws.on('message',raw=>{const m=JSON.parse(raw),index=waiting.findIndex(entry=>entry.filter(m));if(index<0)frames.push(m);else{const [entry]=waiting.splice(index,1);clearTimeout(entry.timer);entry.resolve(m);}});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 const next=filter=>{const index=frames.findIndex(filter);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>{const entry={filter,resolve,timer:setTimeout(()=>reject(Error('Cloud websocket frame timeout')),6000)};waiting.push(entry);});};
 ws.send(JSON.stringify({type:'join',playerId:id}));await next(frame=>frame.type==='state');
 return {ws,next,send:action=>ws.send(JSON.stringify({type:'action',action}))};
}

test('Real signed Social sockets recover a committed pair after RPC response loss; ACK only on confirmed retry',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-cloud-ack-')),cloud=mockCloud(),app=createLocalServer({saveDir:dir,authRequired:true,authEnv:{AUTH_SESSION_SECRET:SECRET,SUPABASE_URL:'https://mock.supabase.local',SUPABASE_SECRET_KEY:'test-only-secret'},storageFetch:cloud.fetchImpl});
 let alice,bob;
 try{
  const port=await app.listen(0);alice=await connect(port,A);bob=await connect(port,B);
  const request={type:'socialV1.friend.request',friendCode:friendCodeFor(B),actionId:'friend:rpc-response-lost'};
  const error=alice.next(m=>m.type==='error');alice.send(request);assert.match((await error).error,/Could not save/);
  assert.equal(cloud.pairCommits,1);assert.equal(cloud.rows.get(A).state.socialV1.outgoingRequests.length,1);assert.equal(cloud.rows.get(B).state.socialV1.incomingRequests.length,1);
  const ack=alice.next(m=>m.type==='action-ack'&&m.actionId===request.actionId);alice.send(request);
  assert.deepEqual({duplicate:(await ack).duplicate}, {duplicate:true});assert.equal(cloud.pairCommits,1);
  const conflict=alice.next(m=>m.type==='error'&&m.actionId===request.actionId);alice.send({...request,friendCode:friendCodeFor(A)});
  assert.equal((await conflict).error,'SOCIAL_ACTION_ID_CONFLICT');assert.equal(cloud.pairCommits,1);
 }finally{alice?.ws.close();bob?.ws.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
