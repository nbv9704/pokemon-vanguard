// Receipt-aware application of Schema-3 management actions. The caller persists
// the returned state before publishing it; no mutation of the live state here.
import {createHash} from 'node:crypto';
import {applyV3ProgressionAction} from './v3-progression.mjs';
import {checkoutV3Training} from './v3-training-checkout.mjs';
import {reconcileV3BattleAfterTeamSave} from './v3-battle-session.mjs';
import {recordMissionEvent} from './missions.mjs';
import {ensureEconomyState,inspectActionReceipt,recordActionReceipt,validateEconomyActionId} from './v2-economy-ledger.mjs';

const TYPES=new Set(['buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply']);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const isV3PlayerAction=action=>TYPES.has(action?.type);
export function v3PlayerActionFingerprint(action){const {actionId:_id,...payload}=action;return `v3-player:${createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')}`;}
export function applyV3PlayerAction(state,action,catalog,{now=Date.now()}={}){
 if(!isV3PlayerAction(action))return {ok:false,code:'UNKNOWN_V3_PLAYER_ACTION'};
 if(!state?.progressionV3)return {ok:false,code:'SCHEMA_V3_NOT_READY'};
 const base=structuredClone(state),hasId=action.actionId!==undefined;
 if(hasId&&!validateEconomyActionId(action.actionId))return {ok:false,code:'INVALID_PLAYER_ACTION_ID'};
 const fingerprint=hasId?v3PlayerActionFingerprint(action):null;
 if(hasId){const found=inspectActionReceipt(base,action.actionId,fingerprint);if(found.status==='conflict')return {ok:false,code:'ACTION_ID_REUSED'};if(found.status==='duplicate')return {ok:true,state:base,duplicate:true,receipt:found.receipt.result};}
 const result=applyV3ProgressionAction(base.progressionV3,action,catalog);if(!result.ok)return result;
 let next={...base,progressionV3:result.progression,revision:(base.revision||0)+1};
 if(action.type==='buildV3.save'){
  const current=base.progressionV3.builds.find(build=>build.buildId===action.build?.buildId),payment=checkoutV3Training(next,current,result.build,action);
  if(!payment.ok)return payment;
 }
 if(['teamV3.save','replicaV3.apply'].includes(action.type)){
  next=reconcileV3BattleAfterTeamSave(next,result.team.teamId);
  recordMissionEvent(next,'teamSaves',1,now);
  if(action.type==='replicaV3.apply')next.notice='Replica Team applied successfully.';
 }
 if(action.type==='teamV3.activate'&&next.battleV3?.phase==='PREVIEW')next.battleV3=null;
 let receipt=null;
 if(hasId){
  ensureEconomyState(next);
  receipt={type:action.type,progressionRevision:next.progressionV3.revision,revision:next.revision};
  recordActionReceipt(next,{actionId:action.actionId,kind:action.type,fingerprint,receiptId:`v3-player:${action.type}:${action.actionId}`,result:receipt});
 }
 return {ok:true,state:next,duplicate:false,receipt};
}
