import test from 'node:test';
import assert from 'node:assert/strict';
import {CompletedBattleResults} from '../public/js/completed-battle-results.js';

const finishedState=()=>({
 rankedV1:{status:'finished',match:{id:'ranked-old'},battleV3:{id:'ranked-old',phase:'FINISHED'}},
 trainingPvpV1:{status:'idle'},
 battleV3:{id:'v3-old',phase:'FINISHED'}
});

test('completed results present on initial hydration are suppressed and cleaned in service priority order',()=>{
 const sent=[],guard=new CompletedBattleResults({sendAction:action=>(sent.push(action),true),createActionId:kind=>`${kind}:test`}),state=finishedState();
 guard.accept(state,{reentry:true});
 assert.equal(guard.isRankedActive(state),false);assert.equal(guard.isPveVisible(state),false);
 assert.deepEqual(sent,[{type:'rankedV1.dismiss',actionId:'ranked-dismiss:test'}]);
 const afterRank={...state,rankedV1:{status:'idle'}};guard.accept(afterRank);
 assert.deepEqual(sent.at(-1),{type:'battleV3.dismiss'});
 const cleaned={...afterRank,battleV3:null};guard.accept(cleaned);assert.equal(guard.cleanupInFlight,null);
});

test('a result reached live is visible until exit/dismiss, which also suppresses older completed modes behind it',()=>{
 const sent=[],guard=new CompletedBattleResults({sendAction:action=>(sent.push(action),true),createActionId:kind=>`${kind}:live`}),state=finishedState();
 guard.accept(state,{reentry:false});assert.equal(guard.isRankedActive(state),true);assert.equal(guard.isPveVisible(state),true);assert.equal(sent.length,0);
 assert.equal(guard.dismiss('ranked',state),true);assert.equal(guard.isRankedActive(state),false);assert.equal(guard.isPveVisible(state),false);assert.equal(sent[0].type,'rankedV1.dismiss');
});

test('leaving a finished friendly result hides it immediately and schedules its server dismissal',()=>{
 const sent=[],guard=new CompletedBattleResults({sendAction:action=>(sent.push(action),true),createActionId:kind=>`${kind}:friendly`}),state={trainingPvpV1:{status:'finished',room:{code:'ABC123'},battleV3:{id:'training-1',phase:'FINISHED'}}};
 assert.equal(guard.isTrainingPvpActive(state),true);assert.equal(guard.dismissFinished(state),true);assert.equal(guard.isTrainingPvpActive(state),false);assert.deepEqual(sent,[{type:'trainingPvpV1.dismiss',actionId:'training-pvp-dismiss:friendly'}]);
});


test('a recovered Ranked settlement stays visible on initial hydration until the trainer acknowledges it',()=>{
 const sent=[],guard=new CompletedBattleResults({sendAction:action=>(sent.push(action),true),createActionId:kind=>`${kind}:recovered`});
 const state={rankedV1:{status:'finished',recovered:true,match:{id:'ranked-after-restart'},battleV3:null},trainingPvpV1:{status:'idle'},battleV3:null};
 guard.accept(state,{reentry:true});assert.equal(guard.isRankedActive(state),true);assert.deepEqual(sent,[]);
 assert.equal(guard.dismiss('ranked',state),true);assert.equal(guard.isRankedActive(state),false);assert.deepEqual(sent,[{type:'rankedV1.dismiss',actionId:'ranked-dismiss:recovered'}]);
});
