import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserStore} from '../public/js/store.js';
import {createRouter,NAV_ITEMS} from '../public/js/router.js';
import {AdventureConnection,websocketUrl} from '../public/js/net.js';
import {RecruitmentView} from '../public/js/recruitment-view.js';

function memoryStorage(entries={}){const values=new Map(Object.entries(entries));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),values};}

test('browser store recovers invalid settings and keeps a stable player room',()=>{
 const storage=memoryStorage({'aether-settings':'not-json'});
 const store=createBrowserStore({storage,cryptoApi:{randomUUID:()=> 'player-1'},locationLike:{search:''}});
 assert.equal(store.playerId,'player-1');assert.equal(store.room,'aether-player-1');assert.deepEqual(store.settings,{});
 store.settings.reduce=true;store.saveSettings();
 const again=createBrowserStore({storage,cryptoApi:{randomUUID:()=> 'wrong'},locationLike:{search:'?room=review_room'}});
 assert.equal(again.playerId,'player-1');assert.equal(again.room,'review_room');assert.equal(again.settings.reduce,true);
});

test('browser store falls back to memory identity when browser storage is blocked',()=>{
 const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}},store=createBrowserStore({storage:blocked,cryptoApi:{randomUUID:()=> 'ephemeral-player'},locationLike:{search:''}});assert.equal(store.playerId,'ephemeral-player');assert.equal(store.room,'aether-ephemeral-player');assert.equal(store.persistent,false);store.settings.reduce=true;assert.equal(store.saveSettings(),false);assert.equal(store.persistent,false);
});

test('browser store reports settings read failures even if player ID is readable',()=>{
 const storage={getItem:key=>{if(key==='aether-player')return 'existing';throw Error('storage denied');},setItem(){throw Error('storage denied');}};
 const store=createBrowserStore({storage,cryptoApi:{randomUUID:()=> 'unused'},locationLike:{search:''}});
 assert.equal(store.playerId,'existing');assert.equal(store.persistent,false);assert.deepEqual(store.settings,{});
});

test('router accepts only declared screens',()=>{
 const router=createRouter('unknown');assert.equal(router.current,'home');assert.equal(NAV_ITEMS.length,11);assert.equal(router.has('recruitment'),true);assert.equal(router.has('shop'),true);assert.equal(router.has('missions'),true);assert.equal(router.has('friends'),true);assert.deepEqual(NAV_ITEMS.slice(4,7).map(([route])=>route),['recruitment','shop','missions']);assert.equal(router.has('settings'),true);assert.equal(NAV_ITEMS.some(([route])=>route==='settings'||route==='guide'),false);assert.equal(router.has('summon'),false);
 assert.equal(router.go('battle'),true);assert.equal(router.current,'battle');
 assert.equal(router.go('admin'),false);assert.equal(router.current,'battle');
 const expected=[['home','Home'],['battle','Arena'],['collection','Pokedex'],['teams','Box'],['recruitment','Recruitment'],['shop','Shop'],['missions','Missions'],['friends','Friends'],['gym','Gym Challenge'],['training','Training'],['mail','Mailbox']];
 assert.deepEqual(NAV_ITEMS.map(([route,,label])=>[route,label]),expected);
 assert.equal(NAV_ITEMS.every(([,icon])=>icon.startsWith('/assets/icons/')&&icon.endsWith('.png')),true);
});

test('Recruitment UI projects config data and emits revision-safe server actions',()=>{
 const sent=[],view=new RecruitmentView({onChange:()=>{},sendAction:action=>sent.push(action),createActionId:kind=>`${kind}:1`,monotonicNow:()=>1000});view.startTicker=()=>{};
 const state={coins:2400,recruitmentTickets:1,recruitmentV2:{revision:4,cycleId:77,effectiveNow:100000,cycleEndsAt:200000,refresh:{costCoins:100,count:1,limit:3},activeTrial:null,trialOffer:null,offers:[{speciesId:'emberlyn',name:'Emberlyn',types:['Flame'],priceCoins:1200,priceTickets:1,abilityIds:['blazing-heart','flash-step'],sampleBuild:{moveIds:['flame-pulse','quick-claw','guard','tailwind']},ownership:'locked',monId:null,trialExpiresAt:null,trialUsedThisCycle:false}]}};
 const catalog={species:[{id:'emberlyn',legacyId:0,artId:0,name:'Emberlyn',types:['Flame'],rarity:'common',role:'fast attacker'}],abilities:[{id:'blazing-heart',name:'Blazing Heart'},{id:'flash-step',name:'Flash Step'}],moves:[{id:'flame-pulse',name:'Flame Pulse'},{id:'quick-claw',name:'Quick Claw'},{id:'guard',name:'Guard'},{id:'tailwind',name:'Tailwind'}]};
 const html=view.render(state,catalog,{art:id=>`<i>${id}</i>`});assert.match(html,/Recruitment/);assert.match(html,/Blazing Heart/);assert.match(html,/Flame Pulse/);assert.match(html,/Recruit · 1200/);assert.match(html,/Use ticket/);assert.doesNotMatch(html,/Common/);
 view.handleClick({dataset:{recruit:'trial',speciesId:'emberlyn'}},state);assert.deepEqual(sent[0],{type:'recruit.trial',actionId:'recruit.trial:1',expectedRevision:4,cycleId:77,speciesId:'emberlyn'});
 view.handleClick({dataset:{recruit:'refresh'}},state);assert.deepEqual(sent[1],{type:'recruit.refresh',actionId:'recruit.refresh:1',expectedRevision:4,cycleId:77});
 view.handleClick({dataset:{recruit:'permanent',speciesId:'emberlyn',payment:'ticket'}},state);assert.deepEqual(sent[2],{type:'recruit.permanent',actionId:'recruit.permanent:1',expectedRevision:4,cycleId:77,speciesId:'emberlyn',payment:'ticket'});
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

test('connection heartbeat drops a silent half-open socket instead of staying falsely connected',async()=>{
 class SilentSocket{
  static OPEN=1;constructor(){this.readyState=0;this.sent=[];this.closed=false;SilentSocket.instance=this;}send(value){this.sent.push(value);}close(){this.closed=true;this.readyState=3;}
 }
 const statuses=[];const connection=new AdventureConnection({url:'ws://local/ws/test',playerId:'p1',WebSocketImpl:SilentSocket,onStatus:value=>statuses.push(value),reconnect:false,pingMs:10,pongTimeoutMs:50});
 connection.start();const socket=SilentSocket.instance;socket.readyState=1;socket.onopen();
 const deadline=Date.now()+1000;
 while(!socket.closed&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(socket.sent.includes('__ping'),true);assert.equal(socket.closed,true);assert.equal(connection.connected,false);assert.deepEqual(statuses,[true,false]);
 connection.stop();
});
