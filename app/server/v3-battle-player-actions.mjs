// A PvE command is committed exactly once for a stable action ID, including
// after a storage write succeeds but its network acknowledgement is lost.
// Old clients without IDs remain supported but have no cross-restart dedupe.
import {createHash} from 'node:crypto';
import {applyV3BattleAction} from './v3-battle-actions.mjs';
import {prepareV3RecruitmentState} from './v3-recruitment-state.mjs';
import {recordMissionEvent} from './missions.mjs';
import {validateEconomyActionId,inspectActionReceipt,recordActionReceipt} from './v2-economy-ledger.mjs';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const isV3BattlePlayerAction=action=>typeof action?.type==='string'&&action.type.startsWith('battleV3.');
export function battlePlayerFingerprint(action){const {actionId:_ignored,...payload}=action;return `v3-battle:${createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')}`;}
export function applyV3BattlePlayerAction(state,action,catalog,{now=Date.now()}={}){
 if(!isV3BattlePlayerAction(action))return {ok:false,code:'UNKNOWN_V3_BATTLE_ACTION'};
 if(!state?.progressionV3)return {ok:false,code:'SCHEMA_V3_NOT_READY'};
 const base=structuredClone(state),hasId=action.actionId!==undefined;
 if(hasId&&!validateEconomyActionId(action.actionId))return {ok:false,code:'INVALID_BATTLE_ACTION_ID'};
 const fingerprint=hasId?battlePlayerFingerprint(action):null;
 if(hasId){const found=inspectActionReceipt(base,action.actionId,fingerprint);if(found.status==='conflict')return {ok:false,code:'ACTION_ID_REUSED'};if(found.status==='duplicate')return {ok:true,state:base,duplicate:true,receipt:found.receipt.result};}
 prepareV3RecruitmentState(base,catalog,now);
 const wasFinished=base.battleV3?.phase==='FINISHED',megaBefore=base.battleV3?.battle?.megaUsed?.A||0;
 const result=applyV3BattleAction(base,action,catalog);if(!result.ok)return result;
 const next=result.state,megaAfter=next.battleV3?.battle?.megaUsed?.A||0;
 if(megaAfter>megaBefore)recordMissionEvent(next,'megaEvolutions',megaAfter-megaBefore,now);
 if(!wasFinished&&next.battleV3?.phase==='FINISHED'&&!next.battleV3.training){
  recordMissionEvent(next,'battles',1,now);
  if(next.battleV3.battle?.result?.winner==='A')recordMissionEvent(next,'wins',1,now);
 }
 let receipt=null;
 if(hasId){next.revision=(next.revision||0)+1;receipt={type:action.type,committedRevision:next.revision};recordActionReceipt(next,{actionId:action.actionId,kind:action.type,fingerprint,receiptId:`v3-battle:${action.actionId}`,result:receipt});}
 return {ok:true,state:next,duplicate:false,receipt};
}
