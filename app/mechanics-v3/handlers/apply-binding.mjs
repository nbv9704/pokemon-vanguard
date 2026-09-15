import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyBindingHandler={
 id:'apply-binding',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  let next=clone(battle);const {action,move}=payload,events=[],appliedTargetIds=[];
  const targets=(params.requireDamage===false?(payload.hitTargetIds||[]):(payload.damagedTargetIds||[]));
  for(const targetId of targets){
   const source=unitById(next,action.actorId),target=unitById(next,targetId);if(!source||source.hp<=0||!target||target.hp<=0)continue;
   target.volatiles??={};
   if(target.volatiles.bound){events.push({kind:'volatileFailed',actorId:source.actorId,targetId:target.actorId,moveId:move.id,volatile:'bound',reason:'alreadyVolatile'});continue;}
   if(typeof runtime?.nextRandom!=='function')throw new Error('apply-binding requires seeded nextRandom');
   const minTurns=params.minTurns??4,maxTurns=params.maxTurns??5,turns=minTurns+Math.floor(runtime.nextRandom()*(maxTurns-minTurns+1));
   target.volatiles.bound={id:'bound',sourceId:move.id,sourceActorId:source.actorId,endTurnTimer:turns,residualNumerator:params.residualNumerator??1,residualDenominator:params.residualDenominator??8,trapsSwitch:params.trapsSwitch!==false};
   appliedTargetIds.push(target.actorId);events.push({kind:'volatileApplied',actorId:source.actorId,targetId:target.actorId,moveId:move.id,volatile:'bound',turns});
  }
  return {battle:next,payload:{...payload,boundTargetIds:[...new Set(appliedTargetIds)]},events};
 }
};
