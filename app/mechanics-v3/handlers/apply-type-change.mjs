import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {CANONICAL_TYPES} from '../../rules-v3/type-chart.mjs';

const sameTypes=(left,right)=>left.length===right.length&&left.every((type,index)=>type===right[index]);

export const applyTypeChangeHandler={
 id:'apply-type-change',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move}=payload,events=[],changedTargetIds=[];
  const applications=[...(payload.hitTargetIds||[]).map(targetId=>({sourceId:action.actorId,targetId,reflected:false})),...(payload.reflectedStatusHits||[]).map(hit=>({sourceId:hit.sourceId,targetId:hit.targetId,reflected:true}))];
  for(const application of applications){
   const source=unitById(next,application.sourceId),target=unitById(next,application.targetId);if(!source||source.hp<=0||!target||target.hp<=0)continue;
   if((params.blockedTargetTypes||[]).some(type=>(target.types||[]).includes(type))){events.push({kind:'typeChangeFailed',actorId:source.actorId,targetId:target.actorId,moveId:move.id,reason:'typeImmune',blockedTargetTypes:[...params.blockedTargetTypes],reflected:application.reflected});continue;}
   const mode=params.mode||'replace-fixed';let changedUnit=target,after;
   if(mode==='replace-fixed')after=[...params.types];
   else if(mode==='add-fixed')after=[...new Set([...(target.types||[]),...params.types])];
   else if(mode==='copy-target-to-user'){changedUnit=source;after=[...(target.types||[])];}
   else throw new Error(`unsupported type change mode: ${mode}`);
   const before=[...(changedUnit.types||[])];if(!after.length||after.some(type=>!CANONICAL_TYPES.includes(type)))throw new Error(`unsupported type change for ${move.id}`);
   if(sameTypes(before,after)){events.push({kind:'typeChangeFailed',actorId:source.actorId,targetId:changedUnit.actorId,moveId:move.id,reason:'noChange',reflected:application.reflected});continue;}
   changedUnit.volatiles??={};if(!changedUnit.volatiles['type-change-state'])changedUnit.volatiles['type-change-state']={id:'type-change-state',originalTypes:before,restoreOnSwitch:true};changedUnit.types=after;changedTargetIds.push(changedUnit.actorId);events.push({kind:'typesChanged',actorId:source.actorId,targetId:changedUnit.actorId,moveId:move.id,beforeTypes:before,afterTypes:[...after],reflected:application.reflected,...(mode==='copy-target-to-user'?{copiedFromId:target.actorId}:{})});
  }
  return {battle:next,payload:{...payload,typeChangedTargetIds:[...new Set(changedTargetIds)]},events};
 }
};
