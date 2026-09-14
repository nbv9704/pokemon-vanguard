import {clone} from '../../rules-v3/battle-state.mjs';
import {applySecondaryEffects} from '../secondary-effects.mjs';

export const applySecondaryEffectsHandler={
 id:'apply-secondary-effects',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),effects=payload.mechanics?.secondaryEffects||[];
  if(!effects.length||payload.mechanics?.secondaryEffectsSuppressed)return {battle:next,payload,events:[]};
  const targetIds=[...new Set(payload.damagedTargetIds||[])];if(!targetIds.length)return {battle:next,payload,events:[]};
  const result=applySecondaryEffects(next,{actorId:payload.action.actorId,targetIds,moveId:payload.move.id,effects},runtime);
  return {battle:result.battle,payload:{...payload,secondaryEffectTargetIds:targetIds},events:result.events};
 }
};
