import {resolveDefogCleanup,resolveMortalSpinCleanup,resolveRapidSpinCleanup,resolveTidyUpCleanup} from '../field-cleanup.mjs';

export const cleanupBattlefieldEffectsHandler={
 id:'cleanup-battlefield-effects',hooks:['onMove'],
 run({battle,payload,params}){
  const common={actorId:payload.action.actorId,moveId:payload.move.id};
  let result;
  if(params.mode==='rapid-spin')result=resolveRapidSpinCleanup(battle,{...common,totalDamage:payload.totalDamage||0});
  else if(params.mode==='defog')result=resolveDefogCleanup(battle,{...common,targetIds:payload.hitTargetIds||payload.targetIds||[]});
  else if(params.mode==='mortal-spin')result=resolveMortalSpinCleanup(battle,{...common,totalDamage:payload.totalDamage||0});
  else if(params.mode==='tidy-up')result=resolveTidyUpCleanup(battle,common);
  else throw new Error(`Unsupported battlefield cleanup mode: ${params.mode}`);
  return {battle:result.battle,payload:{...payload,fieldCleanupApplied:result.applied},events:result.events};
 }
};
