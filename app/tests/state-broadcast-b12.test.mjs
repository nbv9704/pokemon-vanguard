import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastSharedFrames,createDeltaStateBroadcaster} from '../server/state-broadcast.mjs';
import {sendSerializedBounded} from '../server/ws-flow-control.mjs';

test('broadcast projects and serializes once per audience while delivering every socket',()=>{
 const sockets=[{id:'a1'},{id:'a2'},{id:'spectator'}],clients=new Map([[sockets[0],'owner'],[sockets[1],'owner'],[sockets[2],'other']]);
 const projected=[],delivered=[];
 const stats=broadcastSharedFrames(clients,{project:audience=>{projected.push(audience);return {audience,nested:{safe:true}};},send:(socket,encoded)=>delivered.push([socket.id,encoded])});
 assert.deepEqual(stats,{sockets:3,projections:2,serializations:2,deliveredSockets:3,deliveredBytes:delivered.reduce((total,[,encoded])=>total+Buffer.byteLength(encoded),0)});
 assert.deepEqual(projected,['owner','other']);
 assert.equal(delivered[0][1],delivered[1][1]);
 assert.notEqual(delivered[1][1],delivered[2][1]);
 assert.deepEqual(delivered.map(([,encoded])=>JSON.parse(encoded).audience),['owner','owner','other']);
});

test('serialized bounded send reuses the exact frame and keeps slow-consumer protection',()=>{
 const sent=[],drops=[],socket={readyState:1,bufferedAmount:0,send:value=>sent.push(value),terminate(){this.terminated=true;}},encoded='{"type":"state","revision":7}',options={openState:1,maxBufferedBytes:16,onDrop:reason=>drops.push(reason)};
 assert.equal(sendSerializedBounded(socket,encoded,options),true);
 assert.equal(sent[0],encoded);
 socket.bufferedAmount=17;
 assert.equal(sendSerializedBounded(socket,encoded,options),false);
 assert.equal(socket.terminated,true);assert.deepEqual(drops,['backpressure']);
});

test('broadcast rejects undefined projection before sending a partial frame',()=>{
 const sent=[];assert.throws(()=>broadcastSharedFrames([[{},'owner']],{project:()=>undefined,send:(_s,frame)=>sent.push(frame)}),/JSON-serializable/);
 assert.deepEqual(sent,[]);
});

test('cursor broadcaster sends one shared full frame, then one shared domain delta to two tabs',()=>{
 const sockets=[{id:'tab-a'},{id:'tab-b'}],clients=new Map(sockets.map(socket=>[socket,'owner'])),sent=new Map(sockets.map(socket=>[socket,[]])),broadcaster=createDeltaStateBroadcaster();let view={coins:10,socialV1:{online:1},trainingV3:{large:'x'.repeat(2000)}};
 let stats=broadcaster.broadcast(clients,{project:()=>({type:'state',view}),send:(socket,encoded)=>sent.get(socket).push(encoded)});
 assert.equal(stats.projections,1);assert.equal(stats.serializations,1);assert.equal(stats.fullFrames,2);assert.equal(sent.get(sockets[0])[0],sent.get(sockets[1])[0]);assert.equal(JSON.parse(sent.get(sockets[0])[0]).cursor,1);
 view={...view,socialV1:{online:2}};stats=broadcaster.broadcast(clients,{project:()=>({type:'state',view}),send:(socket,encoded)=>sent.get(socket).push(encoded)});
 assert.equal(stats.projections,1);assert.equal(stats.serializations,2);assert.equal(stats.deltaFrames,2);assert.equal(sent.get(sockets[0])[1],sent.get(sockets[1])[1]);
 const delta=JSON.parse(sent.get(sockets[0])[1]);assert.deepEqual(delta,{type:'state-delta',baseCursor:1,cursor:2,patch:{socialV1:{online:2}},removed:[],changedKeys:['socialV1']});assert.ok(Buffer.byteLength(sent.get(sockets[0])[1])<Buffer.byteLength(sent.get(sockets[0])[0])/10);
 broadcaster.reset(sockets[1]);view={...view,coins:11};broadcaster.broadcast(clients,{project:()=>({type:'state',view}),send:(socket,encoded)=>sent.get(socket).push(encoded)});
 assert.equal(JSON.parse(sent.get(sockets[0])[2]).type,'state-delta');assert.equal(JSON.parse(sent.get(sockets[1])[2]).type,'state');
});
