import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {WebSocket} from 'ws';
import {setup,applyAction,viewFor} from '../server/legacy/logic-v1.js';
import {migrateV1ToV2} from '../server/migrations.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {getV2Progression,applyV2ProgressionAction,v2TrainingView} from '../server/v2-progression.mjs';
import {settleV2Battle} from '../server/v2-settlement.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {createLocalServer} from '../local-server.mjs';

test('release migration remains legacy-view compatible and tutorial completes through the core loop',()=>{
 let state=migrateV1ToV2(setup(['release']),v2Catalog.species).state;assert.equal(state.schemaVersion,2);assert.equal(viewFor(state,'release').coins,2400);assert.equal(v2TrainingView(state,v2Catalog).builds.length,6);
 const progression=getV2Progression(state,v2Catalog),team=progression.teams[0];state=applyV2ProgressionAction(state,{type:'team.save',team,expectedRevision:team.revision},v2Catalog).state;assert.equal(state.tutorialV2.steps.team,true);
 state.battleV2={id:'reward-battle',phase:'FINISHED',mode:'single',regulationId:'alpha-single',gym:null,battle:{result:{winner:'A',reason:'all-fainted',receiptId:'reward-battle:result'}}};const before=state.coins;settleV2Battle(state,v2Catalog);settleV2Battle(state,v2Catalog);assert.equal(state.coins,before+180);assert.equal(state.rewardReceipts.filter(receipt=>receipt.receiptId==='reward-battle:result').length,1);assert.equal(state.tutorialV2.steps.reward,true);
 const build=state.builds[0],saved=applyV2ProgressionAction(state,{type:'build.save',build:{...structuredClone(build),name:'Build release'},expectedRevision:build.revision},v2Catalog);assert.equal(saved.ok,true);assert.equal(saved.state.tutorialV2.completed,true);assert.deepEqual(saved.state.wallet,{coins:saved.state.coins,crystals:saved.state.gems,recruitmentTickets:saved.state.recruitmentTickets});
});

test('gym first-clear bonus and badge settle once across repeated challenges',()=>{
 const state=migrateV1ToV2(setup(['gym-release']),v2Catalog.species).state,before=state.coins;state.battleV2={id:'gym-first',phase:'FINISHED',mode:'single',regulationId:'alpha-single',gym:0,battle:{result:{winner:'A',reason:'all-fainted',receiptId:'gym-first:result'}}};settleV2Battle(state,v2Catalog);settleV2Battle(state,v2Catalog);assert.equal(state.coins,before+680);assert.equal(state.gems,1800+380);assert.deepEqual(state.badges,[0]);assert.equal(state.battleV2.reward.firstClear,true);
 state.battleV2={id:'gym-repeat',phase:'FINISHED',mode:'single',regulationId:'alpha-single',gym:0,battle:{result:{winner:'A',reason:'all-fainted',receiptId:'gym-repeat:result'}}};settleV2Battle(state,v2Catalog);assert.equal(state.coins,before+860);assert.equal(state.battleV2.reward.firstClear,false);
});

test('active v1 battle shows its saved result, then is backed up, migrated and blocks new v1 battles',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'aether-release-')),storage=new JsonAdventureStorage(dir),owner='legacy-owner';let legacy=applyAction(setup([owner]),owner,{type:'battle',mode:'single'});await storage.save('legacy-room',legacy);const app=createLocalServer({saveDir:dir}),port=await app.listen(0);try{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/legacy-room`);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',playerId:owner}));let view=await waitFrame(ws,frame=>frame.type==='state');assert.equal(view.view.schemaVersion,undefined);ws.send(JSON.stringify({type:'action',action:{type:'surrender'}}));view=await waitFrame(ws,frame=>frame.type==='state'&&frame.view.battle?.result==='Surrendered');assert.equal(view.view.schemaVersion,undefined);ws.send(JSON.stringify({type:'action',action:{type:'legacy.finish'}}));view=await waitFrame(ws,frame=>frame.type==='state'&&frame.view.schemaVersion===2);assert.equal(view.view.migrationReceipt.legacyBattleResult,'Surrendered');ws.send(JSON.stringify({type:'action',action:{type:'battle',mode:'single'}}));const rejected=await waitFrame(ws,frame=>frame.type==='error');assert.equal(rejected.error,'LEGACY_BATTLE_DISABLED');const backups=await readdir(path.join(dir,'.migration-backups'));assert.equal(backups.length,1);ws.close();}finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

function waitFrame(ws,predicate){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('frame timeout')),3000),handler=raw=>{const frame=JSON.parse(raw);if(predicate(frame)){clearTimeout(timer);ws.off('message',handler);resolve(frame);}};ws.on('message',handler);});}
