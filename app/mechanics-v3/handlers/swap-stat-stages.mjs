import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const swapStatStagesHandler={
 id:'swap-stat-stages',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),events=[],swappedTargetIds=[];
  if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  for(const targetId of payload.hitTargetIds||[]){
   const target=unitById(next,targetId);if(!target||target.hp<=0)continue;
   const actorBefore={},targetBefore={};
   for(const stat of params.stats){actorBefore[stat]=actor.stages?.[stat]||0;targetBefore[stat]=target.stages?.[stat]||0;}
   for(const stat of params.stats){actor.stages[stat]=targetBefore[stat];target.stages[stat]=actorBefore[stat];}
   swappedTargetIds.push(target.actorId);events.push({kind:'statStagesSwapped',actorId:actor.actorId,targetId:target.actorId,moveId:payload.move.id,stats:[...params.stats],actorBefore,targetBefore,actorAfter:Object.fromEntries(params.stats.map(stat=>[stat,actor.stages[stat]])),targetAfter:Object.fromEntries(params.stats.map(stat=>[stat,target.stages[stat]]))});
  }
  return {battle:next,payload:{...payload,swappedTargetIds},events};
 }
};
