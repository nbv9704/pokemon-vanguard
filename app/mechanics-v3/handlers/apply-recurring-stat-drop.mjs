import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyRecurringStatDropHandler={
 id:'apply-recurring-stat-drop',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),events=[],targets=params.requireDamage===false?(payload.hitTargetIds||[]):(payload.damagedTargetIds||[]),volatile=params.volatile||payload.move.id;
  for(const targetId of targets){const target=unitById(next,targetId),source=unitById(next,payload.action.actorId);if(!target||target.hp<=0||!source||source.hp<=0)continue;target.volatiles??={};if(target.volatiles[volatile]){events.push({kind:'volatileFailed',actorId:source.actorId,targetId,moveId:payload.move.id,volatile,reason:'alreadyVolatile'});continue;}target.volatiles[volatile]={id:volatile,sourceId:payload.move.id,sourceActorId:source.actorId,endTurnTimer:params.turns??3,recurringStatDrop:{stat:params.stat,delta:params.delta??-1}};events.push({kind:'volatileApplied',actorId:source.actorId,targetId,moveId:payload.move.id,volatile,turns:params.turns??3});}
  return {battle:next,payload,events};
 }
};
