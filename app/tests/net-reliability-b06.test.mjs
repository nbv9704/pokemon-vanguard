import test from 'node:test';
import assert from 'node:assert/strict';
import {AdventureConnection} from '../public/js/net.js';
class FakeSocket{
 static OPEN=1;static created=[];
 constructor(){this.readyState=0;this.sent=[];this.closed=false;FakeSocket.created.push(this);}
 send(text){this.sent.push(text);}
 close(code){this.closed=true;this.readyState=3;this.closeCode=code;}
 establish(){this.readyState=1;this.onopen?.();}
 message(frame){this.onmessage?.({data:JSON.stringify(frame)});}
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('connection cannot send a paid action before join state, and jittered reconnect waits for confirmed join',()=>{
 FakeSocket.created=[];const status=[],conn=new AdventureConnection({url:'ws://example',playerId:'a',WebSocketImpl:FakeSocket,onStatus:v=>status.push(v),reconnect:false});
 conn.start();const socket=FakeSocket.created.at(-1);socket.establish();assert.equal(conn.connected,true);assert.equal(conn.sendAction({type:'shopV3.buy'}),false);
 socket.message({type:'state',view:{coins:1}});assert.equal(conn.joined,true);assert.equal(conn.sendAction({type:'shopV3.buy'}),true);
 assert.equal(conn.retry,0);assert.deepEqual(status,[true]);conn.stop();
});
test('silent joined socket fails its join deadline instead of appearing ready indefinitely',async()=>{
 FakeSocket.created=[];const status=[],conn=new AdventureConnection({url:'ws://example',playerId:'a',WebSocketImpl:FakeSocket,onStatus:v=>status.push(v),reconnect:false,pingMs:60000,joinTimeoutMs:50});
 conn.start();const socket=FakeSocket.created.at(-1);socket.establish();await wait(100);
 assert.equal(socket.closed,true);assert.equal(socket.closeCode,4000);assert.equal(conn.connected,false);assert.deepEqual(status,[true,false]);conn.stop();
});
test('suspension close code disables reconnect and reports a terminal session failure',async()=>{
 FakeSocket.created=[];const fatals=[],conn=new AdventureConnection({url:'ws://example',playerId:'a',WebSocketImpl:FakeSocket,onFatal:code=>fatals.push(code),joinTimeoutMs:60000,pingMs:60000,random:()=>0});
 conn.start();const socket=FakeSocket.created.at(-1);socket.establish();socket.onclose({code:4003});
 await wait(10);assert.deepEqual(fatals,[4003]);assert.equal(conn.stopped,true);assert.equal(conn.reconnectTimer,null);assert.equal(FakeSocket.created.length,1);conn.stop();
});
