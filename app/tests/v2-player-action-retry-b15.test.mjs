import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {applyV2ProgressionAction} from '../server/v2-progression.mjs';
import {commitReceiptCommand} from '../server/receipt-command-handler.mjs';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {createLocalServer} from '../local-server.mjs';

const clone=value=>structuredClone(value);
const initial=()=>upgradeAdventure(setup(['v2-player']),v2Catalog).state;
async function loseAckThenRetry(state,action){let durable=clone(state),writes=0;const options={accountId:'v2-player',liveState:state,load:async()=>clone(durable),persist:async(_id,next)=>{durable=clone(next);writes++;if(writes===1)throw Error('ACK_LOST');},action,apply:(saved,input)=>applyV2ProgressionAction(saved,input,v2Catalog)};await assert.rejects(commitReceiptCommand(options),/ACK_LOST/);const retry=await commitReceiptCommand(options);return {retry,writes,invoke:next=>commitReceiptCommand({...options,action:next})};}

test('schema-2 Build save survives lost ACK without charging or saving twice',async()=>{
 const state=initial(),build=state.builds[0],action={type:'build.save',build:{...clone(build),name:'Durable Build',points:{...build.points,atk:10}},expectedRevision:build.revision,actionId:'b15:build'};
 const before=state.wallet.coins,run=await loseAckThenRetry(state,action);assert.equal(run.retry.duplicate,true);assert.equal(run.retry.state.wallet.coins,before-10);assert.equal(run.writes,1);
 assert.equal(run.retry.state.builds.find(entry=>entry.buildId===build.buildId).name,'Durable Build');
 const conflict=await run.invoke({...action,build:{...action.build,name:'Collision'}});assert.equal(conflict.code,'ACTION_ID_REUSED');
});

test('schema-2 Team save and Blueprint import have stable durable identities',async()=>{
 const teamState=initial(),team=teamState.teams[0],teamAction={type:'team.save',team:{...clone(team),name:'Durable Team'},expectedRevision:team.revision,actionId:'b15:team'},teamRun=await loseAckThenRetry(teamState,teamAction);assert.equal(teamRun.retry.duplicate,true);assert.equal(teamRun.retry.state.teams[0].name,'Durable Team');assert.equal(teamRun.writes,1);
 const blueprintState=initial(),species=v2Catalog.species[0],blueprint=JSON.stringify({schemaVersion:1,name:'Durable Blueprint',builds:[{speciesId:species.id,...clone(species.defaultBuild)}]}),blueprintAction={type:'blueprint.import',blueprint,actionId:'b15:blueprint'},blueprintRun=await loseAckThenRetry(blueprintState,blueprintAction);assert.equal(blueprintRun.retry.duplicate,true);assert.equal(blueprintRun.retry.state.blueprints.filter(entry=>entry.name==='Durable Blueprint').length,1);assert.equal(blueprintRun.writes,1);
});

async function connect(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/v2-retry`),frames=[],waiters=[];ws.on('message',raw=>{const frame=JSON.parse(raw),index=waiters.findIndex(entry=>entry.test(frame));if(index<0)frames.push(frame);else{const [entry]=waiters.splice(index,1);clearTimeout(entry.timer);entry.resolve(frame);}});const next=test=>{const index=frames.findIndex(test);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>{const entry={test,resolve,timer:setTimeout(()=>reject(Error('V2 retry frame timeout')),5000)};waiters.push(entry);});};await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',playerId:'v2-player'}));return {ws,next,initial:(await next(frame=>frame.type==='state')).view,send:action=>ws.send(JSON.stringify({type:'action',action}))};}

test('real WebSocket schema-2 Build ACK replays as duplicate after server restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b15-v2-player-')),storage=new JsonAdventureStorage(dir);await storage.save('v2-retry',initial());let app=createLocalServer({saveDir:dir}),client;
 try{let port=await app.listen(0);client=await connect(port);const build=client.initial.trainingV2.builds[0],action={type:'build.save',build:{...build,name:'WS Durable Build',points:{...build.points,atk:10}},expectedRevision:build.revision,actionId:'b15:ws:build'};client.send(action);let ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===action.actionId);assert.equal(ack.duplicate,false);const committed=await storage.load('v2-retry'),coins=committed.wallet.coins;client.ws.close();await app.close();app=createLocalServer({saveDir:dir});port=await app.listen(0);client=await connect(port);client.send(action);ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===action.actionId);assert.equal(ack.duplicate,true);assert.equal((await storage.load('v2-retry')).wallet.coins,coins);
 }finally{client?.ws.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
