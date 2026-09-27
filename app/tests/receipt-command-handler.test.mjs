import test from 'node:test';
import assert from 'node:assert/strict';
import {commitReceiptCommand} from '../server/receipt-command-handler.mjs';
import {applyV3ShopAction} from '../server/v3-item-shop.mjs';
import {applyV3RecruitmentAction} from '../server/v3-recruitment.mjs';
import {prepareV3RecruitmentState,v3RecruitmentView} from '../server/v3-recruitment-state.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {recordMissionEvent} from '../server/missions.mjs';
const fixture=()=>({owner:'receipt-player',schemaVersion:3,revision:1,seed:77,coins:5000,gems:0,recruitmentTickets:3,wallet:{coins:5000,crystals:0,recruitmentTickets:3},ticketBagV1:{shopTickets:2,trainingTickets:0,rankTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const crashAfterCommit=initial=>{
 let durable=structuredClone(initial),throws=true,saves=0;
 return {load:async()=>structuredClone(durable),persist:async(_id,value)=>{saves++;durable=structuredClone(value);if(throws){throws=false;throw Error('ACK_LOST_AFTER_DURABLE_SAVE');}},get snapshot(){return structuredClone(durable);},get saves(){return saves;}};
};
const shop=apply=>commitReceiptCommand({accountId:'receipt-player',liveState:null,load:apply.load,persist:apply.persist,action:{type:'shopV3.buy',itemId:'charcoal',payment:'ticket',actionId:'shop:retry-b06'},apply:(state,action)=>applyV3ShopAction(state,action,v3Catalog)});

test('Shop retry after a committed save losing its ACK uses durable receipt and never spends two tickets',async()=>{
 const storage=crashAfterCommit(fixture());await assert.rejects(shop(storage),/ACK_LOST/);
 assert.equal(storage.snapshot.ticketBagV1.shopTickets,1);
 const retry=await shop(storage);assert.equal(retry.ok,true);assert.equal(retry.duplicate,true);assert.equal(storage.saves,1);assert.equal(retry.state.ticketBagV1.shopTickets,1);
 const bad=await commitReceiptCommand({accountId:'receipt-player',liveState:null,...storage,action:{type:'shopV3.buy',itemId:'sitrus-berry',payment:'ticket',actionId:'shop:retry-b06'},apply:(state,action)=>applyV3ShopAction(state,action,v3Catalog)});assert.equal(bad.code,'ACTION_ID_REUSED');
});

test('Recruitment retry after a durable write cannot double-grant a Pokémon or repeat its mission event',async()=>{
 const start=fixture(),now=200000000;prepareV3RecruitmentState(start,v3Catalog,now);
 const view=v3RecruitmentView(start,v3Catalog,{serverNow:now}),offer=view.offers.find(row=>row.ownership==='locked');assert.ok(offer);
 const storage=crashAfterCommit(start),action={type:'recruitV3.permanent',speciesId:offer.speciesId,payment:'ticket',expectedRevision:view.revision,cycleId:view.cycleId,actionId:'recruit:retry-b06'};
 const invoke=act=>commitReceiptCommand({accountId:'receipt-player',liveState:null,load:storage.load,persist:storage.persist,action:act,apply:(state,act)=>{
  const result=applyV3RecruitmentAction(state,act,v3Catalog,{serverNow:now});if(result.ok&&!result.duplicate)recordMissionEvent(result.state,'recruits',1,now);return result;
 }});
 await assert.rejects(invoke(action),/ACK_LOST/);assert.equal(storage.snapshot.wallet.recruitmentTickets,2);
 const redo=await invoke(action);assert.equal(redo.ok,true);assert.equal(redo.duplicate,true);assert.equal(storage.saves,1);
 assert.equal(redo.state.progressionV3.mons.filter(mon=>mon.speciesId===offer.speciesId&&mon.ownership==='permanent').length,1);
 assert.equal((await invoke({...action,payment:'coins'})).code,'ACTION_ID_REUSED');
});
