import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';

async function joined(port,name){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/${name}`),frames=[];
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 ws.on('message',raw=>frames.push(JSON.parse(raw)));
 ws.send(JSON.stringify({type:'join',playerId:name}));
 for(let index=0;index<100;index++){const state=frames.find(frame=>frame.type==='state');if(state)return {ws,state};await new Promise(resolve=>setTimeout(resolve,10));}
 throw new Error('state frame timeout');
}
async function close(ws){if(ws.readyState===WebSocket.CLOSED)return;await new Promise(resolve=>{ws.once('close',resolve);ws.close();});}
async function settled(app){for(let index=0;index<100;index++){const snapshot=app.resourceSnapshot();if(!snapshot.connectedSockets&&!snapshot.pendingSockets&&!snapshot.queuedJobs)return snapshot;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('room cleanup timeout');}
async function rejectedStatus(port,name){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/${name}`);ws.once('open',()=>{ws.close();resolve(101);});ws.once('unexpected-response',(_req,res)=>{const status=res.statusCode;res.resume();resolve(status);});ws.once('error',error=>{if(!String(error.message).includes('Unexpected server response'))reject(error);});});}

test('room hard cap rejects active overflow, then LRU-evicts detached saves and reloads them',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b17-room-cap-')),app=createLocalServer({saveDir:dir,maxResidentRooms:1,roomRetentionMs:60_000});let a,b,reloaded;
 try{
  const port=await app.listen(0);a=await joined(port,'alpha');assert.equal(app.resourceSnapshot().rooms,1);
  assert.equal(await rejectedStatus(port,'bravo'),503);assert.equal(app.resourceSnapshot().capacityRejected,1);assert.equal(app.resourceSnapshot().rooms,1);
  await close(a.ws);await settled(app);b=await joined(port,'bravo');let snapshot=app.resourceSnapshot();assert.equal(snapshot.rooms,1);assert.equal(snapshot.evictions.capacity,1);
  await close(b.ws);await settled(app);reloaded=await joined(port,'alpha');snapshot=app.resourceSnapshot();assert.equal(snapshot.rooms,1);assert.equal(snapshot.evictions.capacity,2);assert.equal(reloaded.state.you,'alpha');assert.ok(snapshot.runtime.persist.samples>=3);assert.ok(snapshot.runtime.broadcast.frames>=3);assert.ok(snapshot.runtime.broadcast.bytes>0);
 }finally{await close(a?.ws);await close(b?.ws);await close(reloaded?.ws);await app.close();await rm(dir,{recursive:true,force:true});}
});
