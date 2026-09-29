import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';
import {parseServerEnvelope} from '../public/js/net.js';
import {deltaCanPatchChrome} from '../public/js/state-delta-render-policy.js';

async function connect(port,{delta}){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/b39-delta`),frames=[],waiters=[];
 ws.on('message',raw=>{const frame=JSON.parse(raw),index=waiters.findIndex(waiter=>waiter.predicate(frame));if(index<0)frames.push(frame);else{const [waiter]=waiters.splice(index,1);clearTimeout(waiter.timer);waiter.resolve(frame);}});
 const next=predicate=>{const index=frames.findIndex(predicate);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>waiters.push({predicate,resolve,timer:setTimeout(()=>reject(Error('B39 frame timeout')),5000)}));};
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 ws.send(JSON.stringify({type:'join',playerId:'b39-player',...(delta?{capabilities:['state-delta-v1']}:{})}));
 return {ws,next,initial:await next(frame=>frame.type==='state')};
}

test('delta envelope rejects cursor gaps, unsafe keys and malformed patch metadata',()=>{
 const valid={type:'state-delta',baseCursor:2,cursor:3,patch:{socialV1:{online:2}},removed:[],changedKeys:['socialV1']};assert.deepEqual(parseServerEnvelope(valid),valid);
 assert.equal(parseServerEnvelope({...valid,cursor:4}),null);assert.equal(parseServerEnvelope({...valid,patch:{__proto__:null},changedKeys:['__proto__']}),null);assert.equal(parseServerEnvelope({...valid,removed:['constructor']}),null);assert.equal(parseServerEnvelope({...valid,changedKeys:'socialV1'}),null);assert.equal(parseServerEnvelope({...valid,changedKeys:['battleV3']}),null);assert.equal(parseServerEnvelope({...valid,removed:['socialV1']}),null);
});

test('route policy patches chrome for unrelated deltas but never bypasses battle/playback state',()=>{
 const envelope=key=>({type:'state-delta',changedKeys:[key]});
 assert.equal(deltaCanPatchChrome({envelope:envelope('socialV1'),route:'teams',hasView:true,playback:false}),true);
 assert.equal(deltaCanPatchChrome({envelope:envelope('socialV1'),route:'friends',hasView:true,playback:false}),false);
 assert.equal(deltaCanPatchChrome({envelope:envelope('battleV3'),route:'shop',hasView:true,playback:false}),false);
 assert.equal(deltaCanPatchChrome({envelope:envelope('recruitmentV3'),route:'teams',hasView:true,playback:true}),false);
});

test('client chrome has stable live bindings and delta fast path without weakening render continuity',async()=>{
 const [client,shell]=await Promise.all([readFile(new URL('../public/client.js',import.meta.url),'utf8'),readFile(new URL('../public/js/client-shell-layout.js',import.meta.url),'utf8')]);
 assert.match(client,/updateLiveChrome\(\)/);assert.match(client,/deltaCanPatchChrome/);assert.match(client,/captureRenderContinuity/);assert.match(client,/hasFreshPlayback/);
 for(const marker of ['data-live-vp','data-live-gems','data-live-connection','data-nav-route'])assert.match(shell,new RegExp(marker));
});

test('real WebSocket negotiates delta, resyncs with a full snapshot and keeps legacy clients full-only',async()=>{
 const saveDir=await mkdtemp(path.join(tmpdir(),'pv-b39-delta-')),app=createLocalServer({saveDir});let modern,legacy;
 try{
  const port=await app.listen(0);modern=await connect(port,{delta:true});assert.equal(modern.initial.cursor,1);
  const nextModern=modern.next(frame=>frame.type==='state-delta');legacy=await connect(port,{delta:false});
  const delta=await nextModern;assert.equal(delta.baseCursor,modern.initial.cursor);assert.equal(delta.cursor,delta.baseCursor+1);assert.equal(legacy.initial.type,'state');assert.equal(legacy.initial.cursor,1);
  modern.ws.send(JSON.stringify({type:'resync',cursor:delta.cursor}));const recovered=await modern.next(frame=>frame.type==='state');assert.equal(recovered.cursor,1);assert.ok(recovered.view.trainingV3);
  legacy.ws.send(JSON.stringify({type:'resync'}));const legacyFull=await legacy.next(frame=>frame.type==='state');assert.equal(legacyFull.cursor,1);
 }finally{modern?.ws.close();legacy?.ws.close();await app.close();await rm(saveDir,{recursive:true,force:true});}
});
