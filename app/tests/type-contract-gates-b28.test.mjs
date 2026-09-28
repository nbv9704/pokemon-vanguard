import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStoragePort,REQUIRED_METHODS} from '../server/storage-port.mjs';
import {parseServerEnvelope,AdventureConnection} from '../public/js/net.js';
import {createShopPurchase} from '../public/js/typed-shop-action.js';
import {ShopView} from '../public/js/shop-view.js';

function fixtureStorage(){
 const calls=[];const port={
  load:async id=>{calls.push(['load',id]);return {schemaVersion:3,owner:id};},
  save:async (id,state)=>{calls.push(['save',id,state]);},
  savePair:async (entries,id)=>{calls.push(['savePair',entries,id]);return {duplicate:false};},
  profile:async()=>null,listAccounts:async()=>({total:0,accounts:[]}),
  getCampaign:async()=>null,registerCampaign:async()=>null,
  backup:async()=>'/synthetic/backup',restore:async()=>null
 };return {port,calls};
}

test('storage facade is checked without a proxy, clone, serialization change or IO',async()=>{
 const {port,calls}=fixtureStorage();
 assert.deepEqual(REQUIRED_METHODS,['load','save','savePair','profile','listAccounts','getCampaign','registerCampaign','backup','restore']);
 assert.equal(assertStoragePort(port),port);assert.deepEqual(calls,[]);
 assert.deepEqual(await port.load('fixture'),{schemaVersion:3,owner:'fixture'});
 assert.deepEqual(await port.savePair([{userId:'a',state:{}},{userId:'b',state:{}}],'op'),{duplicate:false});
 assert.equal(calls[1][2],'op');
});

test('storage assertion fails closed on incomplete or forged ports',()=>{
 assert.throws(()=>assertStoragePort(null),/STORAGE_PORT_INVALID/);
 assert.throws(()=>assertStoragePort({load:async()=>{}}),/STORAGE_PORT_MISSING_METHOD:save/);
 for(const name of REQUIRED_METHODS){const {port}=fixtureStorage();port[name]=false;assert.throws(()=>assertStoragePort(port),new RegExp(`STORAGE_PORT_MISSING_METHOD:${name}`));}
});

test('network parses valid discriminated envelopes and rejects malformed ACK/state frames',()=>{
 assert.equal(parseServerEnvelope(null),null);
 assert.equal(parseServerEnvelope([]),null);
 assert.equal(parseServerEnvelope({type:'state',view:[]}),null);
 assert.equal(parseServerEnvelope({type:'state',view:null}),null);
 assert.equal(parseServerEnvelope({type:'action-ack',actionType:'shopV3.buy'}),null);
 assert.equal(parseServerEnvelope({type:'action-ack',actionId:'a',actionType:'shopV3.buy',duplicate:'false'}),null);
 assert.equal(parseServerEnvelope({type:'action-ack',actionId:'a',actionType:'shopV3.buy',committedRevision:-1}),null);
 assert.equal(parseServerEnvelope({type:'action-ack',actionId:'a',actionType:'shopV3.buy',committedRevision:1.5}),null);
 assert.equal(parseServerEnvelope({type:'action-ack',actionId:'a'.repeat(129),actionType:'shopV3.buy'}),null);
 assert.equal(parseServerEnvelope({type:'error',error:42}),null);
 assert.deepEqual(parseServerEnvelope({type:'state',view:{schemaVersion:3}}),{type:'state',view:{schemaVersion:3}});
 assert.deepEqual(parseServerEnvelope({type:'action-ack',actionId:'a:1',actionType:'shopV3.buy',committedRevision:0}),{type:'action-ack',actionId:'a:1',actionType:'shopV3.buy',committedRevision:0});
});

test('malformed ACK cannot acknowledge or unblock a pending browser action',()=>{
 class MockSocket{
  static OPEN=1; static current=null;
  constructor(){this.readyState=0;this.sent=[];MockSocket.current=this;}
  send(frame){this.sent.push(frame);}
  close(){this.readyState=3;}
  event(value){this.onmessage?.({data:JSON.stringify(value)});}
 }
 const ack=[],state=[],conn=new AdventureConnection({url:'ws://fixture',playerId:'a',WebSocketImpl:MockSocket,onActionAck:frame=>ack.push(frame),onState:view=>state.push(view),reconnect:false,pingMs:60000});
 conn.start();const socket=MockSocket.current;socket.readyState=1;socket.onopen();
 socket.event({type:'state',view:[]});assert.equal(conn.joined,false);
 socket.event({type:'state',view:{revision:2}});assert.equal(conn.joined,true);
 socket.event({type:'action-ack',actionId:'a1',actionType:'shopV3.buy',committedRevision:'2'});
 socket.event({type:'action-ack',actionId:'a1',actionType:'shopV3.buy',duplicate:false,committedRevision:2});
 assert.deepEqual(state,[{revision:2}]);assert.equal(ack.length,1);assert.equal(ack[0].committedRevision,2);
 conn.stop();
});

test('typed Shop purchase builder cannot emit malformed payment or missing target',()=>{
 assert.deepEqual(createShopPurchase({itemId:'charcoal',payment:'coins',actionId:'shop:ok'}),{type:'shopV3.buy',itemId:'charcoal',payment:'coins',actionId:'shop:ok'});
 assert.equal(createShopPurchase({itemId:'',payment:'coins',actionId:'shop:ok'}),null);
 assert.equal(createShopPurchase({itemId:'charcoal',payment:'free',actionId:'shop:ok'}),null);
 assert.equal(createShopPurchase({itemId:'charcoal',payment:'ticket',actionId:'bad id'}),null);
 const sent=[],view=new ShopView({sendAction:action=>sent.push(action),onChange:()=>{},createActionId:()=> 'typed:ok'});
 assert.equal(view.handleClick({dataset:{shop:'buy'}}),false);
 assert.equal(sent.length,0);
 assert.equal(view.handleClick({dataset:{shop:'buy-ticket',itemId:'charcoal'}}),true);
 assert.equal(sent[0].payment,'ticket');
});
