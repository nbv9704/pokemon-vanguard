import {applyV2BattleAction} from './v2-battle-actions.mjs';
import {prepareDurableAccountAction,recordDurableAccountAction} from './durable-account-action.mjs';

export const isV2BattlePlayerAction=action=>typeof action?.type==='string'&&action.type.startsWith('battleV2.');

export function applyV2BattlePlayerAction(state,action,catalog,{serverNow}={}){
 if(!isV2BattlePlayerAction(action))return {ok:false,code:'UNKNOWN_V2_BATTLE_ACTION'};
 const prepared=prepareDurableAccountAction(state,action,'v2-battle',{optional:true});if(!prepared.ok)return prepared;if(prepared.duplicate)return {ok:true,state:prepared.base,duplicate:true,receipt:prepared.receipt};
 const result=applyV2BattleAction(prepared.base,action,catalog,{serverNow});if(!result.ok||prepared.legacy)return result;
 const battle=result.state.battleV2,receipt=recordDurableAccountAction(result.state,action,'v2-battle',prepared.fingerprint,{battleId:battle?.id||null,phase:battle?.phase||null,phaseRevision:battle?.battle?.phaseRevision??null,turn:battle?.battle?.turn??null});
 return {...result,duplicate:false,receipt};
}
