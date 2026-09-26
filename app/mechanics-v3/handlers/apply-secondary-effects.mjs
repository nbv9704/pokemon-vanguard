import {clone} from '../../rules-v3/battle-state.mjs';
import {applySecondaryEffects} from '../secondary-effects.mjs';

export const applySecondaryEffectsHandler={
 id:'apply-secondary-effects',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),effects=payload.mechanics?.secondaryEffects||[];
  if(!effects.length||payload.mechanics?.secondaryEffectsSuppressed)return {battle:next,payload,events:[]};
  const targetIds=[...new Set(payload.damagedTargetIds||[])],hasSelfEffect=effects.some(effect=>effect.target==='self'),hitSucceeded=(payload.totalDamage||0)>0;if(!targetIds.length&&!(hasSelfEffect&&hitSucceeded))return {battle:next,payload,events:[]};
  let result=applySecondaryEffects(next,{actorId:payload.action.actorId,targetIds,moveId:payload.move.id,effects,mechanics:payload.mechanics,hitSucceeded},runtime),battleAfter=result.battle,events=[...result.events];const secondTargets=[...new Set(payload.parentalBondSecondHitTargetIds||[])];if(secondTargets.length){const second=applySecondaryEffects(battleAfter,{actorId:payload.action.actorId,targetIds:secondTargets,moveId:payload.move.id,effects,mechanics:payload.mechanics,hitSucceeded:true},runtime);battleAfter=second.battle;events.push(...second.events.map(event=>({...event,parentalBondSecondHit:true})));}
  return {battle:battleAfter,payload:{...payload,secondaryEffectTargetIds:targetIds},events};
 }
};
