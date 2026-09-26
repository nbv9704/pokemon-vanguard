import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';
import {healingWithHeldItems} from '../item-hooks.mjs';

export const applyPreparedStatHealHandler={
 id:'apply-prepared-stat-heal',hooks:['onMove'],
 run({battle,payload,params={}}){
  let next=clone(battle);const events=[],healedTargetIds=[];
  for(const application of payload.targetStatHealApplications||[]){const source=unitById(next,application.sourceId);if(!source||source.hp<=0)continue;const amount=healingWithHeldItems(application.amount,source,next,{source:params.source||payload.move.id}),applied=applyHpGroup(next,[{actorId:source.actorId,delta:amount}],`move:${payload.move.id}`);next=applied.battle;events.push(...applied.events.map(event=>({...event,actorId:application.sourceId,moveId:payload.move.id,targetStatSourceId:application.targetId})));if(applied.events.some(event=>event.kind==='heal'))healedTargetIds.push(source.actorId);}
  return {battle:next,payload:{...payload,healedTargetIds:[...new Set([...(payload.healedTargetIds||[]),...healedTargetIds])]},events};
 }
};
