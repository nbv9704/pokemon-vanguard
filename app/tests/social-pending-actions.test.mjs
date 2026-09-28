import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SocialPendingActions} from '../public/js/social-pending-actions.js';
import {createSocialRetryController} from '../public/js/social-retry-controller.js';
import {AdventureConnection} from '../public/js/net.js';
import {SocialView} from '../public/js/social-view.js';

const storage=()=>{const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const chat={type:'socialV1.chat.send',accountId:'friend-1',text:'Hi there',actionId:'chat:session-1'};

test('Social pending envelope survives reload only for same account and clears exclusively on matching ACK',()=>{
 const backing=storage(),first=new SocialPendingActions({storage:backing,scope:'trainer-A'});
 assert.equal(first.begin(chat),true);assert.equal(first.begin({...chat,actionId:'another'}),false);
 const reloaded=new SocialPendingActions({storage:backing,scope:'trainer-A'});
 assert.deepEqual(reloaded.pending,chat);
 assert.equal(new SocialPendingActions({storage:backing,scope:'trainer-B'}).pending,null);
 assert.equal(reloaded.acknowledge('unrelated'),false);assert.equal(reloaded.reject('unrelated','ERROR'),false);
 assert.equal(reloaded.reject(chat.actionId,'CHAT_RATE_LIMITED'),true);assert.equal(reloaded.lastError,'CHAT_RATE_LIMITED');
 const sent=[];assert.equal(reloaded.retry(action=>(sent.push(action),true)),true);assert.deepEqual(sent,[chat]);assert.equal(reloaded.acknowledge(chat.actionId),true);
 assert.equal(new SocialPendingActions({storage:backing,scope:'trainer-A'}).pending,null);
});

test('Social retry controller requires explicit retry, refuses new action and retains draft on failed send',()=>{
 const outbox=new SocialPendingActions({storage:storage(),scope:'scope'}),frames=[],alerts=[];
 let connected=false,busy=false;
 const ctrl=createSocialRetryController({outbox,sendAction:action=>(frames.push(structuredClone(action)),connected),isBusy:()=>busy,isConnected:()=>connected,notify:text=>alerts.push(text)});
 assert.equal(ctrl.send(chat),false);assert.deepEqual(outbox.pending,chat);assert.equal(frames.length,1);assert.equal(ctrl.retry(),false);
 connected=true;assert.equal(ctrl.send({...chat,actionId:'new-chat'}),false);assert.equal(ctrl.retry(),true);assert.deepEqual(frames[1],chat);
 busy=true;assert.equal(ctrl.retry(),false);outbox.discard();assert.equal(outbox.pending,null);
 const blocked={getItem(){throw Error('disabled')},setItem(){throw Error('disabled')},removeItem(){throw Error('disabled')}};
 assert.equal(new SocialPendingActions({storage:blocked,scope:'scope'}).persistent,false);
 assert.ok(alerts.length>=2);
});

test('Social UI shows honest uncertain state; failed send retains chat and friend code',async()=>{
 let pending=chat;const sent=[];
 const view=new SocialView({send:action=>(sent.push(action),false),actionId:()=> 'id:1',pendingAction:()=>pending,pendingError:()=>null,canRetry:()=>false});
 view.chatText='Unsent message';view.friendCode='PV-EXAMPLE';
 const html=view.render({socialV1:{friends:[{accountId:'friend-1',name:'Friend',online:true}],conversations:{}}});
 assert.match(html,/Unconfirmed chat message/);assert.match(html,/pending-retry/);assert.match(html,/disabled/);
 await view.handleClick({dataset:{social:'chat-send',accountId:'friend-1'}},{});assert.equal(view.chatText,'Unsent message');
 await view.handleClick({dataset:{social:'friend-request'}},{});assert.equal(view.friendCode,'PV-EXAMPLE');assert.equal(sent.length,2);
});

test('Network protocol passes action ACK separately from state and retains error correlation',()=>{
 class Socket{static OPEN=1;constructor(){this.readyState=1;Socket.instance=this;}send(){}close(){}}
 const acks=[],errors=[],states=[],net=new AdventureConnection({url:'ws://test',playerId:'test',WebSocketImpl:Socket,reconnect:false,onActionAck:frame=>acks.push(frame),onError:(error,frame)=>errors.push([error,frame.actionId]),onState:view=>states.push(view)});
 net.start();const ws=Socket.instance;ws.onopen();ws.onmessage({data:JSON.stringify({type:'action-ack',actionId:chat.actionId,actionType:chat.type,duplicate:true})});ws.onmessage({data:JSON.stringify({type:'error',error:'SOCIAL_ACTION_ID_CONFLICT',actionId:chat.actionId})});ws.onmessage({data:JSON.stringify({type:'state',view:{coins:123}})});
 assert.equal(acks.length,1);assert.equal(acks[0].duplicate,true);assert.deepEqual(errors,[['SOCIAL_ACTION_ID_CONFLICT',chat.actionId]]);assert.deepEqual(states,[{coins:123}]);net.stop();
});

test('WebSocket social branch emits correlated ACK only after the service action returns successfully',async()=>{
 const root=await readFile(new URL('../local-server.mjs',import.meta.url),'utf8'),controller=await readFile(new URL('../server/websocket-controller.mjs',import.meta.url),'utf8'),code=await readFile(new URL('../server/player-action-dispatch.mjs',import.meta.url),'utf8');
 assert.match(root,/createWebsocketController/);assert.match(controller,/createPlayerActionDispatcher/);
 assert.match(code,/const result=await social\.action/);assert.match(code,/type:'action-ack',actionId/);assert.match(code,/validSocialActionId\(actionId\)/);
});
