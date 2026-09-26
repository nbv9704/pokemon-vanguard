import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression,applyV3ProgressionAction} from '../server/v3-progression.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {V3_BEGINNING_ITEM_IDS,v3ItemAcquisition,validateV3ItemAcquisitionCatalog} from '../server/v3-item-acquisition.mjs';
import {applyV3ShopAction,v3ShopView} from '../server/v3-item-shop.mjs';
import {ShopView} from '../public/js/shop-view.js';
import {createLocalServer} from '../local-server.mjs';

const beginning=['bright-powder','choice-scarf','focus-band','focus-sash','kings-rock','leftovers','quick-claw','white-herb','lum-berry','sitrus-berry'];
function state(coins=5000){return {schemaVersion:3,owner:'trainer',coins,gems:0,recruitmentTickets:0,mail:[],progressionV3:createV3BetaProgression(v3Catalog)};}

test('Champions item acquisition table covers the full active M-A battle-item catalog',()=>{
 assert.deepEqual(validateV3ItemAcquisitionCatalog(v3Catalog),[]);
 assert.deepEqual(V3_BEGINNING_ITEM_IDS,beginning);
 const counts={};for(const item of v3Catalog.items){const a=v3ItemAcquisition(item);counts[a.kind]=(counts[a.kind]||0)+1;}
 assert.deepEqual(counts,{shop:122,beginning:10,'mega-tutorial':8,deposit:1});
 assert.equal(v3ItemAcquisition(v3Catalog.itemsById['charcoal']).priceCoins,700);
 assert.equal(v3ItemAcquisition(v3Catalog.itemsById['air-balloon']).priceCoins,1000);
 assert.equal(v3ItemAcquisition(v3Catalog.itemsById['cheri-berry']).priceCoins,400);
 assert.equal(v3ItemAcquisition(v3Catalog.itemsById['blastoisinite']).priceCoins,2000);
 assert.equal(v3ItemAcquisition(v3Catalog.itemsById['beedrillite']).kind,'mega-tutorial');
 assert.equal(v3ItemAcquisition(v3Catalog.itemsById['floettite']).kind,'deposit');
});

test('new schema-3 accounts own only Beginning unlocks and starter team uses legal unique owned items',()=>{
 const progression=createV3BetaProgression(v3Catalog),owned=new Set(progression.ownedItemIds),team=progression.teams.find(entry=>entry.teamId===progression.activeTeamId),items=team.buildIds.map(id=>progression.builds.find(build=>build.buildId===id).itemId);
 assert.deepEqual(progression.ownedItemIds,beginning);assert.equal(new Set(items).size,6);assert.ok(items.every(id=>owned.has(id)));
});

test('Shop purchase is authoritative, priced, idempotent and blocks non-Shop sources',()=>{
 let adventure=state(3000),result=applyV3ShopAction(adventure,{type:'shopV3.buy',itemId:'charcoal',actionId:'shop:charcoal'},v3Catalog);assert.equal(result.ok,true);adventure=result.state;
 assert.equal(adventure.wallet.coins,2300);assert.ok(adventure.progressionV3.ownedItemIds.includes('charcoal'));
 result=applyV3ShopAction(adventure,{type:'shopV3.buy',itemId:'charcoal',actionId:'shop:charcoal'},v3Catalog);assert.equal(result.ok,true);assert.equal(result.duplicate,true);assert.equal(result.state.wallet.coins,2300);
 assert.equal(applyV3ShopAction(adventure,{type:'shopV3.buy',itemId:'leftovers',actionId:'shop:leftovers'},v3Catalog).code,'ITEM_NOT_FOR_SALE');
 assert.equal(applyV3ShopAction(adventure,{type:'shopV3.buy',itemId:'beedrillite',actionId:'shop:bee'},v3Catalog).code,'ITEM_NOT_FOR_SALE');
 assert.equal(applyV3ShopAction(state(100),{type:'shopV3.buy',itemId:'charcoal',actionId:'shop:poor'},v3Catalog).ok,false);
});

test('build save rejects locked held items and accepts them after account unlock',()=>{
 let adventure=state(5000),progression=adventure.progressionV3,build=structuredClone(progression.builds[0]);build.itemId='charcoal';
 let result=applyV3ProgressionAction(progression,{type:'buildV3.save',build,expectedRevision:build.revision},v3Catalog);assert.equal(result.code,'ITEM_NOT_OWNED');
 const bought=applyV3ShopAction(adventure,{type:'shopV3.buy',itemId:'charcoal',actionId:'shop:unlock'},v3Catalog);progression=bought.state.progressionV3;build=structuredClone(progression.builds[0]);build.itemId='charcoal';
 result=applyV3ProgressionAction(progression,{type:'buildV3.save',build,expectedRevision:build.revision},v3Catalog);assert.equal(result.ok,true);
});

test('existing schema-3 saves migrate Beginning unlocks and preserve already-equipped items',()=>{
 const progression=createV3BetaProgression(v3Catalog);delete progression.ownedItemIds;delete progression.itemInventoryVersion;progression.builds[0].itemId='life-orb';
 const upgraded=upgradeAdventureToV3({schemaVersion:3,catalogVersion:v3Catalog.metadata.catalogVersion,rulesVersion:v3Catalog.metadata.rulesVersion,progressionV3:progression},v3Catalog);
 assert.equal(upgraded.status,'progression-upgraded');for(const id of beginning)assert.ok(upgraded.state.progressionV3.ownedItemIds.includes(id));assert.ok(upgraded.state.progressionV3.ownedItemIds.includes('life-orb'));
});

test('Shop view exposes source status and emits a purchase action',()=>{
 const adventure=state(5000),publicShop=v3ShopView(adventure,v3Catalog),sent=[],screen=new ShopView({sendAction:action=>sent.push(action),onChange:()=>{},createActionId:()=> 'shop:ui'}),html=screen.render({shopV3:publicShop});
 assert.match(html,/Battle Items/);assert.match(html,/Beginning/);assert.match(html,/data-shop-field="query"/);screen.handleInput({dataset:{shopField:'query'},value:'char'});assert.equal(screen.query,'char');assert.match(screen.render({shopV3:publicShop}),/Charcoal/);screen.query='';screen.selectedId='charcoal';const selectedHtml=screen.render({shopV3:publicShop});assert.match(selectedHtml,/Buy · 700 VP/);assert.match(selectedHtml,/shop-detail-icon/);screen.handleClick({dataset:{shop:'buy',itemId:'charcoal'}});assert.deepEqual(sent[0],{type:'shopV3.buy',itemId:'charcoal',payment:'coins',actionId:'shop:ui'});
});


test('Shop list cards keep their geometry against the later Pixel Era button primitive',async()=>{
 const css=await readFile(new URL('../public/shop.css',import.meta.url),'utf8');
 const pixel=await readFile(new URL('../public/pixel-era-ui.css',import.meta.url),'utf8');
 assert.match(css,/\.shop-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(pixel,/body\.pixel-era button\{[^}]*min-height:30px/);
 assert.match(css,/body\.pixel-era \.shop-grid\{[^}]*grid-auto-rows:minmax\(80px,max-content\)/s);
 assert.match(css,/body\.pixel-era \.shop-card\{[^}]*grid-template-columns:52px minmax\(0,1fr\)[^}]*min-height:80px!important[^}]*overflow:hidden/s);
 assert.match(css,/body\.pixel-era \.shop-card-icon\{[^}]*width:48px[^}]*height:48px/s);
 assert.match(css,/body\.pixel-era \.shop-card \.item-sprite\{[^}]*width:40px[^}]*height:40px[^}]*background-size:640px 1920px[^}]*-40px/s);
});

async function wsClient(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/shop-test`),frames=[],waiters=[];ws.on('message',raw=>{const msg=JSON.parse(raw);const i=waiters.findIndex(entry=>entry.p(msg));if(i>=0){const [entry]=waiters.splice(i,1);clearTimeout(entry.t);entry.r(msg);}else frames.push(msg);});await new Promise(resolve=>ws.once('open',resolve));const next=p=>{const i=frames.findIndex(p);if(i>=0)return Promise.resolve(frames.splice(i,1)[0]);return new Promise((r,j)=>waiters.push({p,r,j,t:setTimeout(()=>j(new Error('timeout')),3000)}));};ws.send(JSON.stringify({type:'join',playerId:'shop-player'}));return {ws,next,initial:await next(msg=>msg.type==='state')};}

test('server broadcasts Shop and persists a purchase through the account save state',async()=>{const saveDir=await mkdtemp(path.join(os.tmpdir(),'pv-shop-')),app=createLocalServer({saveDir,betaTestFunds:true});try{const port=await app.listen(0),client=await wsClient(port);assert.equal(client.initial.view.shopV3.totalCount,141);client.ws.send(JSON.stringify({type:'action',action:{type:'shopV3.buy',itemId:'charcoal',actionId:'shop:server'}}));const next=await client.next(msg=>msg.view?.shopV3?.items?.find(item=>item.id==='charcoal')?.owned===true);assert.equal(next.view.shopV3.items.find(item=>item.id==='charcoal').owned,true);client.ws.close();}finally{await app.close();await rm(saveDir,{recursive:true,force:true});}});
