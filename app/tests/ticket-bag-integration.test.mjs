import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {createLocalServer} from '../local-server.mjs';

async function connect(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/bag-net`),frames=[],waiting=[];
 ws.on('message',raw=>{
  const frame=JSON.parse(raw);const i=waiting.findIndex(entry=>entry.filter(frame));
  if(i===-1)frames.push(frame);else{const [entry]=waiting.splice(i,1);clearTimeout(entry.timer);entry.resolve(frame);}
 });
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 const next=filter=>{const i=frames.findIndex(filter);if(i>=0)return Promise.resolve(frames.splice(i,1)[0]);return new Promise((resolve,reject)=>{
  const entry={filter,resolve,timer:setTimeout(()=>{const index=waiting.indexOf(entry);if(index>=0)waiting.splice(index,1);reject(new Error('WebSocket Bag state timed out'));},4000)};waiting.push(entry);
 });};
 ws.send(JSON.stringify({type:'join',playerId:'bag-player'}));
 return {ws,next,initial:await next(frame=>frame.type==='state')};
}

test('real websocket Bag: ticket grants, rank protection, Shop and Training spending persist in the save',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-ticket-net-')),storage=new JsonAdventureStorage(dir);
 const base=upgradeAdventureToV3(upgradeAdventure(setup(['bag-player']),v2Catalog).state,v3Catalog).state;
 base.ticketBagV1={version:1,shopTickets:1,trainingTickets:1,rankTickets:1,rankProtectionArmed:false};
 await storage.save('bag-net',base);
 const app=createLocalServer({saveDir:dir});let ws;
 try{
  const port=await app.listen(0),client=await connect(port);ws=client.ws;
  const bag=client.initial.view.bagV1;
  assert.deepEqual(bag.tickets.map(item=>item.count),[base.wallet.recruitmentTickets,1,1,1]);
  let pending=client.next(frame=>frame.type==='state'&&frame.view.bagV1?.rankProtectionArmed);
  ws.send(JSON.stringify({type:'action',action:{type:'bagV1.rankProtection',enabled:true}}));
  let view=(await pending).view;assert.equal(view.bagV1.rankProtectionArmed,true);
  const coins=view.coins;
  pending=client.next(frame=>frame.type==='state'&&frame.view.shopV3?.items.find(item=>item.id==='charcoal')?.owned);
  ws.send(JSON.stringify({type:'action',action:{type:'shopV3.buy',itemId:'charcoal',payment:'ticket',actionId:'net:shop:1'}}));
  view=(await pending).view;assert.equal(view.coins,coins);assert.equal(view.bagV1.tickets.find(t=>t.id==='shop').count,0);
  const build=view.trainingV3.builds[0],updated={...build,natureId:build.natureId==='adamant'?'modest':'adamant'};
  pending=client.next(frame=>frame.type==='state'&&frame.view.bagV1?.tickets.find(item=>item.id==='training')?.count===0);
  ws.send(JSON.stringify({type:'action',action:{type:'buildV3.save',build:updated,expectedRevision:build.revision,payment:'ticket',actionId:'net:training:1'}}));
  view=(await pending).view;assert.equal(view.coins,coins);assert.equal(view.bagV1.rankProtectionArmed,true);
  const persisted=JSON.parse(await readFile(path.join(dir,'bag-net.json'),'utf8'));
  assert.deepEqual([persisted.ticketBagV1.shopTickets,persisted.ticketBagV1.trainingTickets,persisted.ticketBagV1.rankTickets],[0,0,1]);
  assert.equal(persisted.ticketBagV1.rankProtectionArmed,true);
 }finally{ws?.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
