import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {BATTLE_STAGES} from '../manifest-contract.mjs';

export const copyStatStagesHandler={
 id:'copy-stat-stages',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),targetId=(payload.hitTargetIds||[])[0],target=unitById(next,targetId),events=[];
  if(!actor||actor.hp<=0||!target||target.hp<=0)return {battle:next,payload,events:[]};
  const stats=params.stats||BATTLE_STAGES,before={};actor.stages??={};target.stages??={};
  for(const stat of stats){before[stat]=actor.stages[stat]||0;actor.stages[stat]=target.stages[stat]||0;}
  events.push({kind:'statStagesCopied',actorId:actor.actorId,targetId:target.actorId,moveId:payload.move.id,stats:[...stats],before,after:Object.fromEntries(stats.map(stat=>[stat,actor.stages[stat]]))});
  for(const volatile of params.copyVolatiles||[]){
   const had=actor.volatiles?.[volatile];if(had){delete actor.volatiles[volatile];events.push({kind:'volatileEnded',actorId:actor.actorId,volatile,reason:'copy-replace',moveId:payload.move.id});}
   const state=target.volatiles?.[volatile];if(state){actor.volatiles??={};actor.volatiles[volatile]=structuredClone(state);events.push({kind:'volatileCopied',actorId:actor.actorId,targetId:target.actorId,volatile,moveId:payload.move.id});}
  }
  return {battle:next,payload:{...payload,copiedTargetId:target.actorId},events};
 }
};
