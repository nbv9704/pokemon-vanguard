import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {createLocalServer} from '../local-server.mjs';

async function connect(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/commerce-net`),frames=[],waiters=[];
 ws.on('message',data=>{const frame=JSON.parse(data);const i=waiters.findIndex(entry=>entry.test(frame));if(i<0)frames.push(frame);else{const [entry]=waiters.splice(i,1);clearTimeout(entry.timeout);entry.resolve(frame);}});
 const next=test=>{const i=frames.findIndex(test);if(i>=0)return Promise.resolve(frames.splice(i,1)[0]);return new Promise((resolve,reject)=>{const entry={test,resolve,timeout:setTimeout(()=>reject(Error('Timed out waiting for commerce frame')),4000)};waiters.push(entry);});};
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 ws.send(JSON.stringify({type:'join',playerId:'commerce-player'}));
 const initial=await next(frame=>frame.type==='state');
 return {ws,next,initial,send:action=>ws.send(JSON.stringify({type:'action',action}))};
}

test('real WS: Shop/Recruitment ACK is durable across restart, replay is duplicate, different payload rejected',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b06-commerce-')),storage=new JsonAdventureStorage(dir);
 const base=upgradeAdventureToV3(upgradeAdventure(setup(['commerce-player']),v2Catalog).state,v3Catalog).state;
 base.ticketBagV1={version:1,shopTickets:2,trainingTickets:0,rankTickets:0,rankProtectionArmed:false};base.wallet.recruitmentTickets=3;base.recruitmentTickets=3;
 await storage.save('commerce-net',base);let app=createLocalServer({saveDir:dir}),client;
 const shop={type:'shopV3.buy',itemId:'charcoal',payment:'ticket',actionId:'b06:shop:durable'};
 try{
  let port=await app.listen(0);client=await connect(port);
  const first=client.initial.view;assert.ok(first.recruitmentV3?.offers?.length);
  const offer=first.recruitmentV3.offers.find(row=>row.ownership==='locked');assert.ok(offer);
  const recruit={type:'recruitV3.permanent',speciesId:offer.speciesId,payment:'ticket',expectedRevision:first.recruitmentV3.revision,cycleId:first.recruitmentV3.cycleId,actionId:'b06:recruit:durable'};
  client.send(shop);
  let ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===shop.actionId);assert.equal(ack.duplicate,false);assert.ok(ack.committedRevision>client.initial.view.revision);
  client.send(recruit);
  ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===recruit.actionId);assert.equal(ack.duplicate,false);assert.ok(ack.committedRevision>client.initial.view.revision);
  const prior=await storage.load('commerce-net');assert.equal(prior.ticketBagV1.shopTickets,1);assert.equal(prior.wallet.recruitmentTickets,2);
  client.ws.close();await app.close();app=createLocalServer({saveDir:dir});port=await app.listen(0);client=await connect(port);
  assert.doesNotMatch(JSON.stringify(client.initial.view),/actionReceipts|economyLedger/);
  client.send(shop);ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===shop.actionId);assert.equal(ack.duplicate,true);
  client.send(recruit);ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===recruit.actionId);assert.equal(ack.duplicate,true);
  const after=await storage.load('commerce-net');assert.equal(after.ticketBagV1.shopTickets,1);assert.equal(after.wallet.recruitmentTickets,2);
  assert.equal(after.progressionV3.mons.filter(mon=>mon.speciesId===offer.speciesId&&mon.ownership==='permanent').length,1);
  client.send({...shop,itemId:'sitrus-berry'});
  const error=await client.next(frame=>frame.type==='error'&&frame.actionId===shop.actionId);assert.equal(error.error,'ACTION_ID_REUSED');
 }finally{client?.ws.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
