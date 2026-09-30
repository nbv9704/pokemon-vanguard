import test from 'node:test';
import assert from 'node:assert/strict';
import {RankedService,ensureRankedState} from '../server/ranked-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

const makeState=()=>{
 const state={schemaVersion:3,owner:'B51',wallet:{coins:0,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)};
 ensureRankedState(state);return state;
};
const match=()=>({id:'ranked:b51',mode:'single',participants:{A:{accountId:'alpha',name:'Alpha'},B:{accountId:'bravo',name:'Bravo'}},settled:false,battle:null,forfeitWinner:'A'});

test('B51 Ranked settlement fails closed when atomic pair storage is unavailable',async()=>{
 const states=new Map([['alpha',makeState()],['bravo',makeState()]]),before=structuredClone([...states]),singleWrites=[];
 const service=new RankedService({catalog:v3Catalog,getState:id=>states.get(id),persist:async(...args)=>singleWrites.push(args)}),current=match();
 await assert.rejects(service.settle(current),error=>error.code==='RANKED_ATOMIC_STORAGE_REQUIRED');
 assert.deepEqual([...states],before);assert.deepEqual(singleWrites,[]);assert.equal(current.settled,false);assert.equal(current.settlementPromise,null);
});

test('B51 concurrent settlement attempts share one atomic commit and publish once',async()=>{
 const states=new Map([['alpha',makeState()],['bravo',makeState()]]);let commits=0,publishes=0;
 const service=new RankedService({catalog:v3Catalog,getState:id=>states.get(id),persistPair:async entries=>{commits++;assert.equal(entries.length,2);await new Promise(resolve=>setImmediate(resolve));},publishState:(id,state)=>{publishes++;states.set(id,state);}}),current=match();
 await Promise.all([service.settle(current),service.settle(current),service.settle(current)]);
 assert.equal(commits,1);assert.equal(publishes,2);assert.equal(current.settled,true);
 assert.equal(states.get('alpha').rankedV1.matches,1);assert.equal(states.get('bravo').rankedV1.matches,1);
 assert.equal(states.get('alpha').rankedSettlementReceiptsV1.length,1);assert.equal(states.get('bravo').rankedSettlementReceiptsV1.length,1);
});
