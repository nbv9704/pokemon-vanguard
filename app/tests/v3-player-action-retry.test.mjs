import test from 'node:test';
import assert from 'node:assert/strict';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyV3PlayerAction,v3PlayerActionFingerprint} from '../server/v3-player-actions.mjs';

const state=()=>({owner:'synthetic',revision:1,schemaVersion:3,wallet:{coins:2000,crystals:0,recruitmentTickets:0},ticketBagV1:{version:1,trainingTickets:2,shopTickets:0,rankTickets:0,rankProtectionArmed:false},progressionV3:createV3BetaProgression(v3Catalog)});

test('V3 Training paid by ticket: same ID retries after reconnect without a second debit or revision increment',()=>{
 const initial=state(),base=initial.progressionV3.builds[0],updated={...structuredClone(base),natureId:base.natureId==='adamant'?'modest':'adamant'},action={type:'buildV3.save',expectedRevision:base.revision,build:updated,payment:'ticket',actionId:'training:lossy-ack'};
 const first=applyV3PlayerAction(initial,action,v3Catalog,{now:1000});assert.equal(first.ok,true,first.code);assert.equal(first.state.ticketBagV1.trainingTickets,1);assert.equal(initial.ticketBagV1.trainingTickets,2);
 // A new process loaded the committed save; stale expectedRevision must not run validation first.
 const saved=structuredClone(first.state),again=applyV3PlayerAction(saved,action,v3Catalog,{now:2000});assert.equal(again.ok,true);assert.equal(again.duplicate,true);assert.deepEqual(again.state,saved);assert.equal(saved.economyLedger.filter(x=>x.kind==='buildV3.training').length,1);
 const altered=applyV3PlayerAction(saved,{...action,payment:'coins'},v3Catalog);assert.deepEqual({ok:altered.ok,code:altered.code},{ok:false,code:'ACTION_ID_REUSED'});
});

test('V3 team autosave and activation are receipt-aware, including legacy actions without IDs',()=>{
 const initial=state(),team=initial.progressionV3.teams[0],action={type:'teamV3.save',expectedRevision:team.revision,team:{...structuredClone(team),name:'Updated on loss of ACK'},actionId:'team:autosave'};
 const first=applyV3PlayerAction(initial,action,v3Catalog,{now:1000});assert.equal(first.ok,true,first.code);assert.equal(first.state.progressionV3.teams[0].name,'Updated on loss of ACK');assert.equal(first.state.actionReceipts.length,1);
 const retry=applyV3PlayerAction(first.state,action,v3Catalog,{now:3000});assert.equal(retry.duplicate,true);assert.deepEqual(retry.state,first.state);
 const conflict=applyV3PlayerAction(first.state,{...action,team:{...action.team,name:'Different name'}},v3Catalog);assert.equal(conflict.code,'ACTION_ID_REUSED');
 const other=initial.progressionV3.teams[1];const activation={type:'teamV3.activate',teamId:other.teamId,actionId:'team:activate'};
 const activated=applyV3PlayerAction(first.state,activation,v3Catalog);assert.equal(activated.ok,true);assert.equal(activated.state.progressionV3.activeTeamId,other.teamId);assert.equal(applyV3PlayerAction(activated.state,activation,v3Catalog).duplicate,true);
 const legacy=applyV3PlayerAction(initial,{...action,actionId:undefined},v3Catalog);assert.equal(legacy.ok,true,legacy.code);
});

test('V3 receipts are canonical and disjoint from shop ID space; invalid IDs never mutate input',()=>{
 const action={type:'teamV3.activate',teamId:'team-1',actionId:'same'};
 assert.equal(v3PlayerActionFingerprint(action),v3PlayerActionFingerprint({actionId:'same',teamId:'team-1',type:'teamV3.activate'}));
 const initial=state();initial.actionReceipts=[{actionId:'collision',fingerprint:'legacy-shop',result:{}}];
 assert.equal(applyV3PlayerAction(initial,{...action,actionId:'collision'},v3Catalog).code,'ACTION_ID_REUSED');
 assert.equal(applyV3PlayerAction(initial,{...action,actionId:'wrong space'},v3Catalog).code,'INVALID_PLAYER_ACTION_ID');
 assert.equal(initial.revision,1);assert.equal(initial.actionReceipts.length,1);
});
