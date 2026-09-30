import test from 'node:test';
import assert from 'node:assert/strict';
import {PvpPendingActions,createPvpRetryController} from '../public/js/pvp-pending-actions.js';
import {parseServerEnvelope} from '../public/js/net.js';
import {createPlayerActionDispatcher} from '../server/player-action-dispatch.mjs';
import {TrainingPvpService} from '../server/training-pvp-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

class MemoryStorage{constructor(){this.data=new Map();}getItem(key){return this.data.get(key)??null;}setItem(key,value){this.data.set(key,value);}removeItem(key){this.data.delete(key);}}
const state=()=>({schemaVersion:3,revision:42,wallet:{coins:0,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const activeTeam=value=>value.progressionV3.teams.find(team=>team.teamId===value.progressionV3.activeTeamId);

test('PvP outbox survives unrelated state, reload and explicit same-ID retry',()=>{
 const storage=new MemoryStorage(),sent=[],action={type:'rankedV1.commands',actionId:'ranked:turn-7',phaseRevision:7,commands:[{kind:'move',actorId:'a',moveId:'protect'}]};
 const first=new PvpPendingActions({storage,scope:'account'}),controller=createPvpRetryController({outbox:first,sendAction:value=>(sent.push(value),true),isBusy:()=>false,isReady:()=>true});
 assert.equal(controller.send(action),true);assert.deepEqual(first.pending,action);
 // A state/presence frame has no path to acknowledge this operation.
 const restored=new PvpPendingActions({storage,scope:'account'});assert.deepEqual(restored.pending,action);
 const retry=createPvpRetryController({outbox:restored,sendAction:value=>(sent.push(value),true),isBusy:()=>false,isReady:()=>true});assert.equal(retry.retry(),true);
 assert.deepEqual(sent,[action,action]);assert.equal(restored.acknowledge('other-id',action.type),false);assert.equal(restored.acknowledge(action.actionId,'trainingPvpV1.commands'),false);assert.deepEqual(restored.pending,action);assert.equal(restored.acknowledge(action.actionId,action.type),true);assert.equal(restored.pending,null);
});

test('two Friendly clients retrying one operation get one mutation and a duplicate receipt',async()=>{
 const account='11111111-1111-4111-8111-111111111111',value=state(),service=new TrainingPvpService({catalog:v3Catalog,getState:id=>id===account?value:null});
 const team=activeTeam(value),action={type:'trainingPvpV1.room.create',mode:'single',teamId:team.teamId,actionId:'device-shared:create'};
 const first=await service.action(account,{provider:'discord',name:'Alpha'},action),second=await service.action(account,{provider:'discord',name:'Alpha'},structuredClone(action));
 assert.equal(first.ok,true);assert.equal(second.ok,true);assert.equal(second.duplicate,true);assert.equal(service.rooms.size,1);
 const conflict=await service.action(account,{provider:'discord',name:'Alpha'},{...action,mode:'double'});assert.deepEqual(conflict,{ok:false,code:'TRAINING_PVP_ACTION_ID_CONFLICT'});
});

test('PvP dispatcher ACKs the exact operation and distinguishes durable from session scope',async()=>{
 const frames=[],failures=[],room={state:{revision:42}},base={accounts:{withAccounts:async(_ids,work)=>work()},storage:{},migrationBackups:0,v2Catalog:{},v3Catalog:{},clock:{now:()=>0},persist:async()=>{},broadcast:()=>{},send:(_ws,frame)=>frames.push(frame)};
 const ranked={busy:()=>false,action:async()=>({ok:true,duplicate:false,authoritativeRevision:11})},trainingPvp={busy:()=>false,accountIdsForAction:id=>[id],actionUnlocked:async()=>({ok:true,duplicate:true,authoritativeRevision:12})},social={};
 const dispatch=createPlayerActionDispatcher({...base,ranked,trainingPvp,social});
 await dispatch({ws:{},name:'a',room,player:'a',session:{provider:'discord'},message:{action:{type:'rankedV1.commands',actionId:'ranked:11'}},fail:error=>failures.push(error)});
 await dispatch({ws:{},name:'a',room,player:'a',session:{provider:'discord'},message:{action:{type:'trainingPvpV1.commands',actionId:'friendly:12'}},fail:error=>failures.push(error)});
 await dispatch({ws:{},name:'a',room,player:'a',session:{provider:'discord'},message:{action:{type:'rankedV1.surrender',actionId:'ranked:end'}},fail:error=>failures.push(error)});
 assert.deepEqual(failures,[]);assert.deepEqual(frames.map(frame=>[frame.actionId,frame.commitStatus,frame.authoritativeRevision,frame.committedRevision]),[['ranked:11','session',11,undefined],['friendly:12','session',12,undefined],['ranked:end','committed',11,42]]);
 for(const frame of frames)assert.deepEqual(parseServerEnvelope(frame),frame);
 assert.equal(parseServerEnvelope({...frames[0],commitStatus:'saved-ish'}),null);
});
