import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';

function waitState(ws,predicate=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error('state timeout'));},3000),onMessage=raw=>{const frame=JSON.parse(raw);if(frame.type==='error'){cleanup();reject(new Error(frame.error));}if(frame.type==='state'&&predicate(frame.view)){cleanup();resolve(frame.view);}},cleanup=()=>{clearTimeout(timer);ws.off('message',onMessage);};ws.on('message',onMessage);});}
async function connect(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/m3-persist`);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});const ready=waitState(ws);ws.send(JSON.stringify({type:'join',playerId:'m3-player'}));return {ws,view:await ready};}
async function action(ws,value,predicate){const ready=waitState(ws,predicate);ws.send(JSON.stringify({type:'action',action:value}));return ready;}

test('local server persists preview, v2 command result and projected battle view across restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'aether-m3-'));let app=createLocalServer({saveDir:dir}),port=await app.listen(0),connection=await connect(port),view=connection.view;
 view=await action(connection.ws,{type:'battleV2.preview.start',mode:'single',regulationId:'sandbox-v2',difficulty:'normal'},value=>value.battleV2?.phase==='PREVIEW');assert.equal(JSON.stringify(view.battleV2.opponentRoster).includes('moveIds'),false);
 const selected=view.battleV2.playerRoster.slice(0,3).map(mon=>mon.buildId);view=await action(connection.ws,{type:'battleV2.preview.lock',buildIds:selected},value=>value.battleV2?.phase==='COMMAND');const actor=view.battleV2.snapshot.own.find(mon=>mon.activeSlot===0),phaseRevision=view.battleV2.snapshot.phaseRevision;
 view=await action(connection.ws,{type:'battleV2.commands',phaseRevision,commands:[{kind:'move',actorId:actor.battleMonId,moveId:actor.buildSnapshot.moveIds[0],target:{side:'B',slot:0}}]},value=>value.battleV2?.events?.some(event=>event.kind==='turnEnded'));assert.equal(JSON.stringify(view.battleV2.snapshot.opponent).includes('buildSnapshot'),false);const persisted={phase:view.battleV2.phase,turn:view.battleV2.snapshot.turn};connection.ws.close();await app.close();
 app=createLocalServer({saveDir:dir});port=await app.listen(0);connection=await connect(port);assert.deepEqual({phase:connection.view.battleV2.phase,turn:connection.view.battleV2.snapshot.turn},persisted);connection.ws.close();await app.close();await rm(dir,{recursive:true,force:true});
});
