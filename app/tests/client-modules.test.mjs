import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserStore} from '../public/js/store.js';
import {createRouter,NAV_ITEMS} from '../public/js/router.js';
import {AdventureConnection,websocketUrl} from '../public/js/net.js';

function memoryStorage(entries={}){const values=new Map(Object.entries(entries));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),values};}

test('browser store recovers invalid settings and keeps a stable player room',()=>{
 const storage=memoryStorage({'aether-settings':'not-json'});
 const store=createBrowserStore({storage,cryptoApi:{randomUUID:()=> 'player-1'},locationLike:{search:''}});
 assert.equal(store.playerId,'player-1');assert.equal(store.room,'aether-player-1');assert.deepEqual(store.settings,{});
 store.settings.reduce=true;store.saveSettings();
 const again=createBrowserStore({storage,cryptoApi:{randomUUID:()=> 'wrong'},locationLike:{search:'?room=review_room'}});
 assert.equal(again.playerId,'player-1');assert.equal(again.room,'review_room');assert.equal(again.settings.reduce,true);
});

test('router accepts only declared screens',()=>{
 const router=createRouter('unknown');assert.equal(router.current,'home');assert.equal(NAV_ITEMS.length,10);
 assert.equal(router.go('battle'),true);assert.equal(router.current,'battle');
 assert.equal(router.go('admin'),false);assert.equal(router.current,'battle');
});

test('connection joins, filters protocol frames and sends authoritative actions',()=>{
 class FakeSocket{
  static OPEN=1;constructor(url){this.url=url;this.readyState=0;FakeSocket.instance=this;}send(value){this.sent??=[];this.sent.push(value);}close(){this.readyState=3;}
 }
 const states=[],errors=[],statuses=[];
 const connection=new AdventureConnection({url:'ws://local/ws/test',playerId:'p1',WebSocketImpl:FakeSocket,onState:view=>states.push(view),onError:error=>errors.push(error),onStatus:value=>statuses.push(value),reconnect:false,pingMs:60000});
 connection.start();const socket=FakeSocket.instance;socket.readyState=1;socket.onopen();
 socket.onmessage({data:'not json'});socket.onmessage({data:'__pong'});socket.onmessage({data:JSON.stringify({type:'state',view:{coins:1}})});socket.onmessage({data:JSON.stringify({type:'error',error:'bad'})});
 assert.deepEqual(JSON.parse(socket.sent[0]),{type:'join',playerId:'p1'});assert.equal(connection.sendAction({type:'claim',id:0}),true);
 assert.deepEqual(JSON.parse(socket.sent[1]),{type:'action',action:{type:'claim',id:0}});assert.deepEqual(states,[{coins:1}]);assert.deepEqual(errors,['bad']);assert.deepEqual(statuses,[true]);
 connection.stop();assert.equal(connection.sendAction({type:'claim',id:1}),false);
 assert.equal(websocketUrl({protocol:'https:',host:'game.test'},'a b'),'wss://game.test/ws/a%20b');
});
