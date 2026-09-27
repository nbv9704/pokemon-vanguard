import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {getV2Progression} from '../server/v2-progression.mjs';
import {applyV2BattleAction,v2BattleView} from '../server/v2-battle-actions.mjs';
import {applyV2BattlePlayerAction} from '../server/v2-battle-player-actions.mjs';
import {commitReceiptCommand} from '../server/receipt-command-handler.mjs';
import {createLocalServer} from '../local-server.mjs';

const clone=value=>structuredClone(value);
function ready(){const state=setup(['v2-player']);state.progressionV2=getV2Progression(state,v2Catalog);state.progressionV2.teams[0].buildIds=state.progressionV2.builds.map(build=>build.buildId);return state;}
function started(){const state=ready(),preview=applyV2BattleAction(state,{type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal'},v2Catalog),lock=applyV2BattleAction(preview.state,{type:'battleV2.preview.lock',buildIds:preview.state.progressionV2.teams[0].buildIds.slice(0,3)},v2Catalog);assert.equal(lock.ok,true);return lock.state;}
async function loseAckThenRetry(state,action){let durable=clone(state),writes=0;const options={accountId:'v2-player',liveState:state,load:async()=>clone(durable),persist:async(_id,next)=>{durable=clone(next);writes++;if(writes===1)throw Error('ACK_LOST');},action,apply:(saved,input)=>applyV2BattlePlayerAction(saved,input,v2Catalog,{serverNow:1000})};await assert.rejects(commitReceiptCommand(options),/ACK_LOST/);const retry=await commitReceiptCommand(options);return {retry,writes,invoke:next=>commitReceiptCommand({...options,action:next})};}

test('schema-2 Preview retry returns its durable phase without creating another battle',async()=>{
 const action={type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal',actionId:'b16:preview'},run=await loseAckThenRetry(ready(),action);assert.equal(run.retry.duplicate,true);assert.equal(run.retry.state.battleV2.id,'v2-1');assert.equal(run.retry.state.battleV2Serial,1);assert.equal(run.writes,1);
 const conflict=await run.invoke({...action,mode:'double',regulationId:'alpha-double'});assert.equal(conflict.code,'ACTION_ID_REUSED');
});

test('schema-2 finishing command retry never settles its reward twice',async()=>{
 const state=started(),battle=state.battleV2.battle,activeId=battle.sides.B.active[0];for(const mon of battle.sides.B.roster){mon.hp=mon.battleMonId===activeId?1:0;if(mon.battleMonId===activeId)mon.types=['Bloom'];}const actor=battle.sides.A.roster.find(mon=>battle.sides.A.active.includes(mon.battleMonId)),before=state.coins,action={type:'battleV2.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId:actor.battleMonId,moveId:actor.buildSnapshot.moveIds[0],target:{side:'B',slot:0}}],actionId:'b16:finish'},run=await loseAckThenRetry(state,action);
 assert.equal(run.retry.duplicate,true);assert.equal(run.retry.state.battleV2.phase,'FINISHED');assert.equal(run.retry.state.coins,before+180);assert.equal(run.retry.state.rewardReceipts.length,1);assert.equal(run.writes,1);
});

async function connect(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/b16-v2`),frames=[],waiters=[];ws.on('message',raw=>{const frame=JSON.parse(raw),index=waiters.findIndex(entry=>entry.test(frame));if(index<0)frames.push(frame);else{const [entry]=waiters.splice(index,1);clearTimeout(entry.timer);entry.resolve(frame);}});const next=test=>{const index=frames.findIndex(test);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>{const entry={test,resolve,timer:setTimeout(()=>reject(Error('B16 frame timeout')),5000)};waiters.push(entry);});};await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',playerId:'v2-player'}));return {ws,next,initial:(await next(frame=>frame.type==='state')).view,send:action=>ws.send(JSON.stringify({type:'action',action}))};}

test('real WebSocket schema-2 Preview ACK replays as duplicate after restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b16-v2-battle-'));let app=createLocalServer({saveDir:dir}),client;const action={type:'battleV2.preview.start',mode:'single',regulationId:'sandbox-v2',difficulty:'normal',actionId:'b16:ws:preview'};
 try{let port=await app.listen(0);client=await connect(port);client.send(action);let ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===action.actionId);assert.equal(ack.duplicate,false);client.ws.close();await app.close();app=createLocalServer({saveDir:dir});port=await app.listen(0);client=await connect(port);assert.equal(client.initial.battleV2.phase,'PREVIEW');client.send(action);ack=await client.next(frame=>frame.type==='action-ack'&&frame.actionId===action.actionId);assert.equal(ack.duplicate,true);
 }finally{client?.ws.close();await app.close();await rm(dir,{recursive:true,force:true});}
});
