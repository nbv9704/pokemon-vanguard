import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {createLocalServer} from '../local-server.mjs';

const v2State=owner=>upgradeAdventure(setup([owner]),v2Catalog).state;
const waitState=ws=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('state timeout')),3000);ws.on('message',raw=>{const frame=JSON.parse(raw);if(frame.type==='error'){clearTimeout(timer);reject(new Error(frame.error));}if(frame.type==='state'){clearTimeout(timer);resolve(frame.view);}});});

test('v2 to v3 migration preserves account state and archives the old roster',()=>{
 const source=v2State('v3-migrate');source.wallet.coins=777;const before=structuredClone(source),result=upgradeAdventureToV3(source,v3Catalog);assert.equal(result.status,'migrated');assert.equal(result.state.schemaVersion,3);assert.equal(result.state.wallet.coins,777);assert.equal(result.state.progressionV3.mons.length,6);assert.equal(result.state.legacyV2Archive.mons.length,source.mons.length);assert.deepEqual(source,before);
 const current=upgradeAdventureToV3(result.state,v3Catalog);assert.equal(current.status,'current');assert.deepEqual(current.state,result.state);
});

test('schema-3 migration defers an unfinished battle',()=>{
 const source=v2State('v3-active');source.battleV2={phase:'COMMAND'};const result=upgradeAdventureToV3(source,v3Catalog);assert.equal(result.status,'deferred-active-battle');assert.equal(result.state.schemaVersion,2);assert.equal(result.state.progressionV3,undefined);
});

test('schema-3 catalog rebase preserves compatible builds and starter ownership',()=>{const source=upgradeAdventureToV3(v2State('v3-rebase'),v3Catalog).state;source.progressionV3.catalogVersion='older-beta';source.progressionV3.builds[0].name='Keep this build';source.progressionV3.mons[0].ownership='beta';const result=upgradeAdventureToV3(source,v3Catalog);assert.equal(result.status,'catalog-upgraded');assert.equal(result.state.progressionV3.catalogVersion,v3Catalog.metadata.catalogVersion);assert.equal(result.state.progressionV3.mons.length,6);assert.equal(result.state.progressionV3.builds[0].name,'Keep this build');assert.equal(result.state.progressionV3.mons[0].ownership,'permanent');});

test('local team save clears an unlocked stale preview before the next arena visit',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'vanguard-v3-team-preview-')),app=createLocalServer({saveDir:dir}),port=await app.listen(0),ws=new WebSocket(`ws://127.0.0.1:${port}/ws/v3-team-preview`);try{await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});let pending=waitState(ws);ws.send(JSON.stringify({type:'join',playerId:'owner'}));let view=await pending;pending=waitState(ws);ws.send(JSON.stringify({type:'action',action:{type:'battleV3.preview.start',mode:'single',difficulty:'normal'}}));view=await pending;assert.equal(view.battleV3.phase,'PREVIEW');const team=view.trainingV3.teams[0];pending=waitState(ws);ws.send(JSON.stringify({type:'action',action:{type:'teamV3.save',expectedRevision:team.revision,team:{...team,name:'Updated before battle'}}}));view=await pending;assert.equal(view.battleV3,null);assert.equal(view.trainingV3.teams[0].name,'Updated before battle');}finally{ws.close();await app.close();await rm(dir,{recursive:true,force:true});}});

test('local schema-3 build edits persist across restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vanguard-v3-release-'));let app=createLocalServer({saveDir:dir}),port=await app.listen(0),ws=new WebSocket(`ws://127.0.0.1:${port}/ws/v3-release`);try{
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});let statePromise=waitState(ws);ws.send(JSON.stringify({type:'join',playerId:'owner'}));let view=await statePromise;assert.equal(view.schemaVersion,3);const build=view.trainingV3.builds[0],draft={...build,name:'Persistent Beta Build'};
  statePromise=waitState(ws);ws.send(JSON.stringify({type:'action',action:{type:'buildV3.save',expectedRevision:build.revision,build:draft}}));view=await statePromise;assert.equal(view.trainingV3.builds[0].name,'Persistent Beta Build');ws.close();await app.close();
  app=createLocalServer({saveDir:dir});port=await app.listen(0);ws=new WebSocket(`ws://127.0.0.1:${port}/ws/v3-release`);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});statePromise=waitState(ws);ws.send(JSON.stringify({type:'join',playerId:'owner'}));view=await statePromise;assert.equal(view.trainingV3.builds[0].name,'Persistent Beta Build');assert.equal(JSON.parse(await readFile(path.join(dir,'v3-release.json'),'utf8')).schemaVersion,3);
 }finally{ws.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
