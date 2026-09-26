import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';

export const prepareRoundChainHandler={
 id:'prepare-round-chain',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload,events};
  const allyIds=activeUnits(next,action.side).map(entry=>entry.actorId).filter(id=>id!==actor.actorId);
  const chained=allyIds.some(id=>{const ally=unitById(next,id);return ally?.lastMoveOutcome?.turn===next.turn&&ally.lastMoveOutcome.moveId===move.id;});
  const nextMove=chained?{...move,power:move.power*2}:move;
  for(const allyId of allyIds){const pending=runtime?.pendingActionFor?.(allyId);if(pending?.kind==='move'&&pending.moveId===move.id&&runtime?.reorderPendingAction?.(allyId,'front')){events.push({kind:'moveOrderChanged',actorId:allyId,moveId:move.id,reason:'round-chain',position:'front'});break;}}
  if(chained)events.push({kind:'movePowerChanged',actorId:actor.actorId,moveId:move.id,fromPower:move.power,toPower:nextMove.power,reason:'round-chain'});
  return {battle:next,payload:{...payload,move:nextMove},events};
 }
};
