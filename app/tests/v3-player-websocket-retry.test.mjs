import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';

async function connect(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/v3-retry`),frames=[],pending=[];
 ws.on('message',raw=>{const m=JSON.parse(raw),index=pending.findIndex(entry=>entry.filter(m));if(index<0)frames.push(m);else{const [entry]=pending.splice(index,1);clearTimeout(entry.timeout);entry.resolve(m);}});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 const next=filter=>{const index=frames.findIndex(filter);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>{const entry={filter,resolve,timeout:setTimeout(()=>reject(Error('WS frame timeout')),5000)};pending.push(entry);});};
 ws.send(JSON.stringify({type:'join',playerId:'synthetic'}));const initial=(await next(frame=>frame.type==='state')).view;
 return {ws,next,initial,send:action=>ws.send(JSON.stringify({type:'action',action}))};
}

test('WebSocket persisted V3 Training/Team save produces an ACK; retry after server restart is duplicate',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-v3-retry-'));let app=createLocalServer({saveDir:dir}),client;
 try{
  let port=await app.listen(0);client=await connect(port);
  const build=client.initial.trainingV3.builds[0],updated={...build,natureId:build.natureId==='adamant'?'modest':'adamant'},action={type:'buildV3.save',expectedRevision:build.revision,build:updated,actionId:'test:training:restart'};
  const result=client.next(frame=>frame.type==='action-ack'&&frame.actionId===action.actionId);client.send(action);assert.deepEqual({duplicate:(await result).duplicate}, {duplicate:false});
  const after=(await new JsonAdventureStorage(dir).load('v3-retry'));const amount=after.wallet.coins,revision=after.progressionV3.builds[0].revision,ledger=after.economyLedger.length;
  client.ws.close();await app.close();app=createLocalServer({saveDir:dir});port=await app.listen(0);client=await connect(port);
  const retry=client.next(frame=>frame.type==='action-ack'&&frame.actionId===action.actionId);client.send(action);assert.equal((await retry).duplicate,true);
  const stored=await new JsonAdventureStorage(dir).load('v3-retry');assert.equal(stored.wallet.coins,amount);assert.equal(stored.progressionV3.builds[0].revision,revision);assert.equal(stored.economyLedger.length,ledger);
  const conflict=client.next(frame=>frame.type==='error'&&frame.error==='ACTION_ID_REUSED');client.send({...action,payment:'ticket'});assert.equal((await conflict).error,'ACTION_ID_REUSED');
  const team=client.initial.trainingV3.teams[0],teamAction={type:'teamV3.save',expectedRevision:team.revision,team:{...team,name:'Saved once'},actionId:'test:team:restart'};
  const teamAck=client.next(frame=>frame.type==='action-ack'&&frame.actionId===teamAction.actionId);client.send(teamAction);assert.equal((await teamAck).duplicate,false);
  const teamRetry=client.next(frame=>frame.type==='action-ack'&&frame.actionId===teamAction.actionId);client.send(teamAction);assert.equal((await teamRetry).duplicate,true);
  assert.equal((await new JsonAdventureStorage(dir).load('v3-retry')).progressionV3.teams[0].name,'Saved once');
 }finally{client?.ws.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
