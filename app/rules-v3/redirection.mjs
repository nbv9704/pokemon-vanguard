import {activeUnits,otherSide,unitById} from './battle-state.mjs';

const redirectState=unit=>unit.volatiles?.redirection;
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');

export function selectRedirection(battle,{side,actorId,targetMode,selected,move=null,typeRedirectionOrder=null}){
 if(!selected||!['adjacentFoe','anyAdjacent'].includes(targetMode))return null;
 const attacker=actorId?unitById(battle,actorId):null,attackerAbilities=abilityEffects(attacker);
 if(attackerAbilities.some(effect=>effect.kind==='redirection-bypass'))return null;
 if(selected.side===otherSide(side)){
  const candidates=activeUnits(battle,selected.side).filter(entry=>{const state=redirectState(entry.unit),immune=state?.kind==='rage-powder'&&((attacker?.types||[]).includes('grass')||attackerAbilities.some(effect=>effect.kind==='redirection-immunity'&&(effect.kinds||[]).includes(state.kind)));return state?.active&&!immune;}).sort((left,right)=>{
   const order=(redirectState(right.unit).order??0)-(redirectState(left.unit).order??0);
   return order||left.slot-right.slot||left.actorId.localeCompare(right.actorId);
  });
  const winner=candidates[0];if(winner)return {side:winner.side,slot:winner.slot,actorId:winner.actorId};
 }
 if(!move?.type)return null;
 const typeWinner=['A','B'].flatMap(candidateSide=>activeUnits(battle,candidateSide)).filter(entry=>entry.actorId!==actorId&&abilityEffects(entry.unit).some(effect=>effect.kind==='type-redirection'&&(effect.types||[]).includes(move.type))).sort((left,right)=>{
  const ordered=typeof typeRedirectionOrder==='function'?typeRedirectionOrder(left,right):0;
  return ordered||left.side.localeCompare(right.side)||left.slot-right.slot||left.actorId.localeCompare(right.actorId);
 })[0];
 return typeWinner?{side:typeWinner.side,slot:typeWinner.slot,actorId:typeWinner.actorId}:null;
}
