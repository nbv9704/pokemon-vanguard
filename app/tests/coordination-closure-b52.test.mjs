import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountCoordinator} from '../server/account-coordinator.mjs';
import {AdminService} from '../server/admin-service.mjs';
import {SocialService,ensureSocialState,friendCodeFor} from '../server/social-v1.mjs';
import {TrainingPvpService} from '../server/training-pvp-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const session=name=>({provider:'discord',name});
const state=(owner,coins=100)=>({schemaVersion:3,revision:1,owner,wallet:{coins,crystals:0,recruitmentTickets:0},coins,gems:0,recruitmentTickets:0,progressionV3:createV3BetaProgression(v3Catalog)});
const team=value=>value.progressionV3.teams.find(entry=>entry.teamId===value.progressionV3.activeTeamId);

test('B52 Social pair mutation and Admin mutation share one account reservation without lost state',async()=>{
 const coordinator=new AccountCoordinator(),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]),saved=new Map();for(const [id,value] of live){ensureSocialState(value);saved.set(id,structuredClone(value));}
 let entered,release;const started=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const persistPair=async entries=>{entered();await gate;for(const {userId,state:value} of entries)saved.set(userId,structuredClone(value));};
 const social=new SocialService({getState:id=>live.get(id),loadState:async id=>structuredClone(saved.get(id)),persistPair,setLiveState:(id,value)=>live.set(id,structuredClone(value)),withAccounts:(ids,work)=>coordinator.withAccounts(ids,work)});
 const storage={load:async id=>structuredClone(saved.get(id)),profile:async id=>({displayName:live.get(id)?.owner||id}),save:async(id,value)=>saved.set(id,structuredClone(value))};
 const admin=new AdminService({storage,catalog:v3Catalog,getLiveState:id=>live.get(id),setLiveState:(id,value)=>live.set(id,structuredClone(value)),withAccountLock:(id,work)=>coordinator.withAccounts([id],work),withAccountsLock:(ids,work)=>coordinator.withAccounts(ids,work)});
 const request=social.action(A,session('Alpha'),{type:'socialV1.friend.request',friendCode:friendCodeFor(B),actionId:'b52:friend'});await started;
 let adminFinished=false;const grant=admin.handlePlayerAction(B,{type:'economy.set',actionId:'b52:admin',coins:777,crystals:0},{accountId:'admin'}).then(result=>{adminFinished=true;return result;});
 await Promise.resolve();assert.equal(adminFinished,false);release();assert.equal((await request).ok,true);assert.equal((await grant).status,200);
 assert.equal(saved.get(B).wallet.coins,777);assert.equal(saved.get(B).socialV1.incomingRequests.length,1);assert.equal(saved.get(A).socialV1.outgoingRequests.length,1);
});

test('B52 Friendly command and lifecycle timeout cannot resolve the same phase concurrently',async()=>{
 let now=1_000_000;const coordinator=new AccountCoordinator(),states=new Map([[A,state('Alpha')],[B,state('Bravo')]]),service=new TrainingPvpService({catalog:v3Catalog,clock:{now:()=>now},getState:id=>states.get(id),isFriend:()=>true,withAccounts:(ids,work)=>coordinator.withAccounts(ids,work)});
 await service.register(A,session('Alpha'));await service.register(B,session('Bravo'));
 await service.action(A,session('Alpha'),{type:'trainingPvpV1.room.create',mode:'single',teamId:team(states.get(A)).teamId});const code=service.viewFor(A).room.code;
 await service.action(B,session('Bravo'),{type:'trainingPvpV1.room.join',code,teamId:team(states.get(B)).teamId});
 await service.action(A,session('Alpha'),{type:'trainingPvpV1.preview.lock',buildIds:team(states.get(A)).buildIds.slice(0,3)});await service.action(B,session('Bravo'),{type:'trainingPvpV1.preview.lock',buildIds:team(states.get(B)).buildIds.slice(0,3)});
 const room=service.roomFor(A),revision=room.battle.phaseRevision,view=service.viewFor(A),actor=view.battleV3.snapshot.own.find(entry=>entry.activeSlot===0);
 let unblock,entered;const blocked=new Promise(resolve=>{entered=resolve;}),blocker=coordinator.withAccounts([A,B],()=>{entered();return new Promise(resolve=>{unblock=resolve;});});await blocked;
 const command=service.action(A,session('Alpha'),{type:'trainingPvpV1.commands',phaseRevision:revision,commands:[{kind:'move',actorId:actor.actorId,moveId:'protect'}],actionId:'b52:command'});
 now=room.decisionClock.deadlineAt;const lifecycle=service.tick();unblock();await blocker;assert.equal((await command).ok,true);await lifecycle;
 assert.equal(room.lastAutoAction.kind,'command');assert.equal(room.battle.turn,2);assert.ok(room.battle.phaseRevision>revision);
});

test('B52 Admin battle stop reserves the complete live match once and calls only unlocked mutation',async()=>{
 const coordinator=new AccountCoordinator(),live=new Map([[A,state('Alpha')],[B,state('Bravo')]]),saved=new Map([...live].map(([id,value])=>[id,structuredClone(value)]));
 const match={accounts:[A,B],stopped:false};let reserved=[];
 const liveOperations={accountIdsForPlayer:()=>match.accounts,statusForPlayer:()=>match.stopped?null:{kind:'ranked-match'},stopForPlayer:async()=>{assert.deepEqual(new Set(coordinator.active),new Set(match.accounts));match.stopped=true;return {ok:true,kind:'ranked-match',accounts:match.accounts};}};
 const storage={load:async id=>structuredClone(saved.get(id)),profile:async id=>({displayName:live.get(id).owner}),save:async(id,value)=>saved.set(id,structuredClone(value))};
 const admin=new AdminService({storage,catalog:v3Catalog,getLiveState:id=>live.get(id),setLiveState:(id,value)=>live.set(id,structuredClone(value)),withAccountLock:(id,work)=>coordinator.withAccounts([id],work),withAccountsLock:(ids,work)=>{reserved=[...ids];return coordinator.withAccounts(ids,work);},liveOperations});
 const result=await admin.handlePlayerAction(A,{type:'battle.stop',reason:'B52'},{accountId:'admin'});
 assert.equal(result.status,200);assert.equal(match.stopped,true);assert.deepEqual(new Set(reserved),new Set([A,B]));assert.deepEqual(result.body.stopped,['ranked-match']);
});
