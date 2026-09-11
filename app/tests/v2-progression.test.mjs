import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {createLocalServer} from '../local-server.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {applyV2ProgressionAction,getV2Progression} from '../server/v2-progression.mjs';

function edited(build){return {...structuredClone(build),name:'Build tốc độ',points:{hp:0,atk:16,def:0,spa:0,spd:0,spe:16},alignment:{up:'spe',down:'spa'},abilityId:'quick-start',moveIds:['flame-strike','gale-lance','guard','rally'],itemId:'swift-feather'};}

test('build save charges once, no-op is free and stale revision preserves coins',()=>{
 const state=setup(['builder']),progression=getV2Progression(state,v2Catalog),base=progression.builds[0];
 const saved=applyV2ProgressionAction(state,{type:'build.save',build:edited(base),expectedRevision:base.revision},v2Catalog);assert.equal(saved.ok,true);assert.equal(saved.cost,10);assert.equal(saved.state.coins,state.coins-10);
 const before=JSON.stringify(saved.state),noOp=applyV2ProgressionAction(saved.state,{type:'build.save',build:saved.build,expectedRevision:saved.build.revision},v2Catalog);assert.equal(noOp.noOp,true);assert.equal(noOp.cost,0);assert.equal(JSON.stringify(noOp.state),before);
 const stale=applyV2ProgressionAction(saved.state,{type:'build.save',build:{...saved.build,name:'Ghi đè'},expectedRevision:1},v2Catalog);assert.equal(stale.code,'STALE_REVISION');assert.equal(saved.state.coins,state.coins-10);
});

test('trial is read-only and a team cannot contain one species twice',()=>{
 const state=setup(['rules']);state.progressionV2=getV2Progression(state,v2Catalog);const base=state.progressionV2.builds[0];state.progressionV2.mons[0].ownership='trial';
 assert.equal(applyV2ProgressionAction(state,{type:'build.save',build:base,expectedRevision:1},v2Catalog).code,'TRIAL_READ_ONLY');state.progressionV2.mons[0].ownership='permanent';
 const copy=applyV2ProgressionAction(state,{type:'build.save',build:{...edited(base),buildId:undefined,name:'Build hai'},expectedRevision:undefined},v2Catalog);assert.equal(copy.ok,true);
 const illegal=applyV2ProgressionAction(copy.state,{type:'team.save',team:{name:'Trùng loài',buildIds:[base.buildId,copy.build.buildId]}},v2Catalog);assert.equal(illegal.code,'TEAM_ILLEGAL');
});

test('local server exposes catalog and persists build actions across restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'aether-m2-'));let app=createLocalServer({saveDir:dir}),port=await app.listen(0);
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/m2-room`);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',playerId:'m2-player'}));return ws;}
 const response=await fetch(`http://127.0.0.1:${port}/api/v2/catalog`);assert.equal(response.status,200);assert.equal((await response.json()).moves.length,48);
 let ws=await connect();const first=await new Promise(resolve=>ws.on('message',raw=>{const frame=JSON.parse(raw);if(frame.type==='state')resolve(frame.view);}));const base=first.trainingV2.builds[0];ws.send(JSON.stringify({type:'action',action:{type:'build.save',build:edited(base),expectedRevision:1}}));const saved=await new Promise(resolve=>ws.on('message',raw=>{const frame=JSON.parse(raw);if(frame.type==='state'&&frame.view.trainingV2.builds[0].revision===2)resolve(frame.view);}));assert.equal(saved.coins,2390);ws.close();await app.close();
 app=createLocalServer({saveDir:dir});port=await app.listen(0);ws=await connect();const reloaded=await new Promise(resolve=>ws.on('message',raw=>{const frame=JSON.parse(raw);if(frame.type==='state')resolve(frame.view);}));assert.equal(reloaded.trainingV2.builds[0].name,'Build tốc độ');assert.equal(reloaded.coins,2390);ws.close();await app.close();await rm(dir,{recursive:true,force:true});
});
