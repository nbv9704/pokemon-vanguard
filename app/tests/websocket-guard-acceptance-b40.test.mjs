import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function open(port,room){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/${room}`);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return ws;}
function nextRaw(ws,predicate,timeout=5000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('B40 frame timeout'));},timeout),onMessage=raw=>{if(predicate(String(raw))){cleanup();resolve(String(raw));}},onClose=(code,reason)=>{cleanup();reject(Error(`socket closed before frame: ${code} ${reason}`));},cleanup=()=>{clearTimeout(timer);ws.off('message',onMessage);ws.off('close',onClose);};ws.on('message',onMessage);ws.on('close',onClose);});}
function nextFrame(ws,predicate,timeout=5000){return nextRaw(ws,raw=>{try{return predicate(JSON.parse(raw));}catch{return false;}},timeout).then(JSON.parse);}
function closed(ws,timeout=5000){if(ws.readyState===WebSocket.CLOSED)return Promise.resolve({code:null,reason:''});return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('B40 close timeout')),timeout);ws.once('close',(code,reason)=>{clearTimeout(timer);resolve({code,reason:String(reason)});});});}
async function joined(port,room,player=room){const ws=await open(port,room),state=nextFrame(ws,frame=>frame.type==='state');ws.send(JSON.stringify({type:'join',playerId:player,capabilities:['state-delta-v1']}));return {ws,state:await state};}
async function close(ws){if(!ws||ws.readyState===WebSocket.CLOSED)return;const done=closed(ws);ws.close();await done;}

test('real server enforces join deadline and four-tab account cap with bounded resource counters',async()=>{
 const saveDir=await mkdtemp(path.join(tmpdir(),'pv-b40-cap-')),app=createLocalServer({saveDir,websocketJoinDeadlineMs:1000,maxSocketsPerAccount:4,requestRateLimits:{ipUpgrades:100}}),tabs=[];let silent,overflow;
 try{
  const port=await app.listen(0);silent=await open(port,'silent');assert.equal((await closed(silent)).code,4000);
  for(let index=0;index<4;index++)tabs.push((await joined(port,'four-tabs','owner')).ws);
  assert.equal(app.resourceSnapshot().connectedSockets,4);
  overflow=await open(port,'four-tabs');const rejected=await closed(overflow);assert.equal(rejected.code,1013);assert.match(rejected.reason,/account sockets/);
  const snapshot=app.resourceSnapshot();assert.equal(snapshot.connectedSockets,4);assert.equal(snapshot.pendingSockets,0);assert.equal(snapshot.queuedJobs,0);
 }finally{await Promise.all(tabs.map(close));await close(silent);await close(overflow);await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('malformed flood is closed at queue bound without starving another account',async()=>{
 const saveDir=await mkdtemp(path.join(tmpdir(),'pv-b40-flood-')),app=createLocalServer({saveDir,requestRateLimits:{accountActions:1000,ipActions:10_000,socketMessages:1000,ipUpgrades:100}});let noisy,quiet,malformed;
 try{
  const port=await app.listen(0);noisy=(await joined(port,'noisy')).ws;quiet=(await joined(port,'quiet')).ws;malformed=(await joined(port,'malformed')).ws;
  const invalid=nextFrame(malformed,frame=>frame.type==='error');malformed.send('{');assert.equal((await invalid).error,'invalid json');
  const pong=nextRaw(quiet,raw=>raw==='__pong'),started=performance.now(),noisyClosed=closed(noisy);for(let index=0;index<1000;index++)noisy.send('{');quiet.send('__ping');
  await pong;assert.ok(performance.now()-started<3000,'unrelated account should receive pong within three seconds');const dropped=await noisyClosed;assert.equal(dropped.code,1013);assert.match(dropped.reason,/queued actions/);
  const snapshot=app.resourceSnapshot();assert.ok(snapshot.queuedJobs<=1);assert.equal(quiet.readyState,WebSocket.OPEN);
 }finally{await close(noisy);await close(quiet);await close(malformed);await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('oversized WebSocket frame is rejected by transport before application parsing',async()=>{
 const saveDir=await mkdtemp(path.join(tmpdir(),'pv-b40-payload-')),app=createLocalServer({saveDir,requestRateLimits:{ipUpgrades:100}});let ws;
 try{const port=await app.listen(0);ws=await open(port,'oversized');const done=closed(ws);ws.send(Buffer.alloc(71*1024,1));assert.equal((await done).code,1009);await wait(20);assert.equal(app.resourceSnapshot().connectedSockets,0);}
 finally{await close(ws);await app.close();await rm(saveDir,{recursive:true,force:true});}
});
