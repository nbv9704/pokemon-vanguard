import {activeUnits,otherSide} from './battle-state.mjs';

const redirectState=unit=>unit.volatiles?.redirection;

export function selectRedirection(battle,{side,targetMode,selected}){
 if(!selected||selected.side!==otherSide(side)||!['adjacentFoe','anyAdjacent'].includes(targetMode))return null;
 const candidates=activeUnits(battle,selected.side).filter(entry=>redirectState(entry.unit)?.active).sort((left,right)=>{
  const order=(redirectState(right.unit).order??0)-(redirectState(left.unit).order??0);
  return order||left.slot-right.slot||left.actorId.localeCompare(right.actorId);
 });
 const winner=candidates[0];
 return winner?{side:winner.side,slot:winner.slot,actorId:winner.actorId}:null;
}
