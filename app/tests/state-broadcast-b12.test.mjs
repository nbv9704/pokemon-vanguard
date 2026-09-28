import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastSharedFrames} from '../server/state-broadcast.mjs';
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
