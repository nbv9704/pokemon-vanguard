import {clone} from '../../rules-v3/battle-state.mjs';
import {applySecondaryEffects} from '../secondary-effects.mjs';

export const applySecondaryEffectsHandler={
 id:'apply-secondary-effects',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),effects=payload.mechanics?.secondaryEffects||[];
  if(!effects.length||payload.mechanics?.secondaryEffectsSuppressed)return {battle:next,payload,events:[]};
  const targetIds=[...new Set(payload.damagedTargetIds||[])],hasSelfEffect=effects.some(effect=>effect.target==='self'),hitSucceeded=(payload.totalDamage||0)>0;if(!targetIds.length&&!(hasSelfEffect&&hitSucceeded))return {battle:next,payload,events:[]};
  const result=applySecondaryEffects(next,{actorId:payload.action.actorId,targetIds,moveId:payload.move.id,effects,mechanics:payload.mechanics,hitSucceeded},runtime);
  return {battle:result.battle,payload:{...payload,secondaryEffectTargetIds:targetIds},events:result.events};
 }
};
