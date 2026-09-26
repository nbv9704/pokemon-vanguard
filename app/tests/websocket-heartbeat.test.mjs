import test from 'node:test';
import assert from 'node:assert/strict';
import {heartbeatWebSockets,markWebSocketAlive,startWebSocketHeartbeat} from '../server/websocket-heartbeat.mjs';

function fakeSocket(){
 const listeners={};return {isAlive:true,pings:0,terminated:0,on(name,fn){listeners[name]=fn;},ping(){this.pings++;},terminate(){this.terminated++;},emit(name){listeners[name]?.();}};
}

test('websocket heartbeat requires a pong before the next sweep',()=>{
 const ws=fakeSocket(),wss={clients:new Set([ws])};markWebSocketAlive(ws);heartbeatWebSockets(wss);assert.equal(ws.pings,1);assert.equal(ws.isAlive,false);ws.emit('pong');assert.equal(ws.isAlive,true);heartbeatWebSockets(wss);assert.equal(ws.pings,2);assert.equal(ws.terminated,0);
});

test('websocket heartbeat terminates a socket that stays silent for a full sweep',()=>{
 const ws=fakeSocket(),wss={clients:new Set([ws])};heartbeatWebSockets(wss);assert.equal(ws.isAlive,false);heartbeatWebSockets(wss);assert.equal(ws.terminated,1);assert.equal(ws.pings,1);
});

test('websocket heartbeat helper clamps cadence and can be driven by a fake timer',()=>{
 const ws=fakeSocket(),wss={clients:new Set([ws])};let callback=null,delay=null;const timer={unrefCalled:false,unref(){this.unrefCalled=true;}};
 const returned=startWebSocketHeartbeat(wss,{intervalMs:10,setIntervalImpl:(fn,ms)=>{callback=fn;delay=ms;return timer;}});assert.equal(returned,timer);assert.equal(delay,1000);assert.equal(timer.unrefCalled,true);callback();assert.equal(ws.pings,1);
});
