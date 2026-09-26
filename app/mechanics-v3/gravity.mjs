import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';

export const GRAVITY_BLOCKED_MOVE_IDS=new Set(['bounce','fly','flying-press','high-jump-kick','jump-kick','magnet-rise','sky-drop','splash','telekinesis']);

export function gravityActive(battle){return Number.isInteger(battle?.field?.gravity?.remaining)&&battle.field.gravity.remaining>0;}
export function gravityBlocksMove(moveId){return GRAVITY_BLOCKED_MOVE_IDS.has(moveId);}
export function gravityAccuracyMultiplier(battle){return gravityActive(battle)?6840/4096:1;}

export function applyGravity(battle,{actorId,moveId,turns=5}={}){
 const next=clone(battle),events=[];next.field??={};
 if(gravityActive(next))return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'gravityAlreadyActive'}]};
 next.field.gravity={id:'gravity',remaining:turns,sourceActorId:actorId,sourceMoveId:moveId};
 events.push({kind:'fieldConditionStarted',condition:'gravity',actorId,moveId,remaining:turns});
 for(const side of ['A','B'])for(const {unit:entry} of activeUnits(next,side,{includeFainted:true})){
  const unit=unitById(next,entry.actorId);if(!unit)continue;unit.volatiles??={};let grounded=false;
  for(const volatile of ['magnet-rise','telekinesis'])if(unit.volatiles[volatile]){delete unit.volatiles[volatile];events.push({kind:'volatileEnded',actorId:unit.actorId,volatile,reason:'gravity'});grounded=true;}
  const charge=unit.volatiles['two-turn-move'];if(charge?.semiInvulnerable==='airborne'){
   delete unit.volatiles['two-turn-move'];events.push({kind:'twoTurnMoveAborted',actorId:unit.actorId,moveId:charge.moveId,reason:'gravity'});grounded=true;
  }
  if(grounded)events.push({kind:'gravityGrounded',actorId:unit.actorId});
 }
 return {battle:next,applied:true,events};
}
