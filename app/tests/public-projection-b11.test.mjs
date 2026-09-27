import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {setup,viewFor} from '../src/logic.js';
import {legacyAdventurePublicView} from '../server/player-public-view.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {getV2Progression,v2TrainingView} from '../server/v2-progression.mjs';
import {createV3BetaProgression,v3TrainingView} from '../server/v3-progression.mjs';
import {v3BattleView} from '../server/v3-battle-view.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {createLocalServer} from '../local-server.mjs';

const SENTINEL='SERVER_PRIVATE_SENTINEL_B11';
const serialized=value=>JSON.stringify(value);

test('legacy player root projection is allowlisted, detached, and excludes unknown private state',()=>{
 const state=setup(['owner']);state.schemaVersion=3;state.revision=9;state.adminV1={secret:SENTINEL};state.futureServerField={token:SENTINEL};
 const source=viewFor(state,'owner'),view=legacyAdventurePublicView(source);
 assert.equal(view.coins,state.coins);assert.equal(view.schemaVersion,3);assert.equal(view.revision,9);assert.doesNotMatch(serialized(view),new RegExp(SENTINEL));
 view.collection[0].level=999;assert.notEqual(state.collection[0].level,999);
});

test('V2 and V3 training DTOs allowlist nested Mon, build, team and blueprint fields',()=>{
 const v2State=upgradeAdventure(setup(['trainer']),v2Catalog).state,v2=getV2Progression(v2State,v2Catalog);
 v2.mons[0].privateToken=SENTINEL;v2.builds[0].receipt={secret:SENTINEL};v2.teams[0].lockOwner=SENTINEL;
 v2.blueprints=[{blueprintId:'bp',schemaVersion:1,name:'Safe',builds:[{speciesId:'cindrake',name:'Build',points:{hp:1},alignment:{up:null,down:null},moveIds:['a'],abilityId:'x',itemId:'none',secret:SENTINEL}],missingSpeciesIds:[],eligible:true,secret:SENTINEL}];
 v2State.mons=v2.mons;v2State.builds=v2.builds;v2State.teams=v2.teams;v2State.blueprints=v2.blueprints;
 const v2View=v2TrainingView(v2State,v2Catalog);assert.doesNotMatch(serialized(v2View),new RegExp(SENTINEL));
 const v3State=upgradeAdventureToV3(v2State,v3Catalog).state,progression=v3State.progressionV3;progression.privateToken=SENTINEL;progression.mons[0].privateToken=SENTINEL;progression.builds[0].receipt=SENTINEL;progression.teams[0].lockOwner=SENTINEL;
 const v3View=v3TrainingView(progression,v3Catalog);assert.doesNotMatch(serialized(v3View),new RegExp(SENTINEL));v3View.builds[0].name='changed';assert.notEqual(progression.builds[0].name,'changed');
});

test('schema-3 battle preview allowlists session and roster fields',()=>{
 const state={battleV3:{id:'preview',phase:'PREVIEW',mode:'single',difficulty:'normal',training:false,teamId:'team',serverSeed:SENTINEL,playerRoster:[{buildId:'b1',speciesId:'venusaur',name:'Venusaur',types:['grass'],spriteKey:'venusaur',privateToken:SENTINEL}],opponentRoster:[{speciesId:'charizard',name:'Charizard',types:['fire'],spriteKey:'charizard',hiddenBuild:SENTINEL}]}};
 const view=v3BattleView(state);assert.deepEqual(Object.keys(view).sort(),['difficulty','id','mode','opponentRoster','phase','playerRoster','teamId','training'].sort());assert.doesNotMatch(serialized(view),new RegExp(SENTINEL));
});

test('schema-3 live battle own-unit DTO excludes future mechanics internals',()=>{
 const progression=createV3BetaProgression(v3Catalog),base={schemaVersion:3,seed:7,progressionV3:progression};let result=applyV3BattleAction(base,{type:'battleV3.preview.start',mode:'single',difficulty:'normal'},v3Catalog),state=result.state;
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:state.battleV3.playerRoster.slice(0,3).map(entry=>entry.buildId)},v3Catalog);state=result.state;state.battleV3.battle.sides.A.roster[0].futureMechanicState={secret:SENTINEL};
 const view=v3BattleView(state);assert.doesNotMatch(serialized(view),new RegExp(SENTINEL));assert.ok(view.snapshot.own[0].buildSnapshot);assert.equal(view.snapshot.opponent[0].buildSnapshot,undefined);
});

test('real websocket never serializes known or future private save-root fields',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-projection-b11-')),storage=new JsonAdventureStorage(dir),state=upgradeAdventureToV3(upgradeAdventure(setup(['owner']),v2Catalog).state,v3Catalog).state;
 Object.assign(state,{rngState:{secret:SENTINEL},rewardReceipts:[SENTINEL],economyLedger:[SENTINEL],actionReceipts:[SENTINEL],adminV1:{secret:SENTINEL},adminAuditV1:{entries:[SENTINEL]},futureServerField:{secret:SENTINEL}});await storage.save('privacy-room',state);
 const app=createLocalServer({saveDir:dir});let ws;
 try{
  const port=await app.listen(0);ws=new WebSocket(`ws://127.0.0.1:${port}/ws/privacy-room`);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const frame=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('state timeout')),5000);ws.on('message',raw=>{const value=JSON.parse(raw);if(value.type==='state'){clearTimeout(timer);resolve(value);}});});ws.send(JSON.stringify({type:'join',playerId:'owner'}));const message=await frame;
  assert.doesNotMatch(serialized(message.view),new RegExp(SENTINEL));assert.equal(message.view.coins,state.coins);assert.ok(message.view.trainingV3);
 }finally{ws?.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
