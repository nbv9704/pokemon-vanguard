import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {applyDamageHit} from '../damage-hit.mjs';

export const directDamageHandler={
 id:'deal-direct-damage',hooks:['onMove'],
 run({battle,payload,runtime}){
  if(typeof runtime.nextRandom!=='function')throw new Error('deal-direct-damage requires seeded nextRandom');
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;
  for(const targetRef of targets){
   const defender=unitById(next,targetRef.actorId);if(!defender||defender.hp<=0)continue;
   if(!payload.accuracyResolved&&move.accuracy!==null&&move.accuracy<100&&runtime.nextRandom()>=move.accuracy/100){events.push({kind:'moveMissed',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id});continue;}
   const result=applyDamageHit(next,{actorId:actor.actorId,targetId:defender.actorId,move,spread:mechanics.targetMode==='allAdjacentFoes'&&(payload.resolvedTargetIds?.length||targets.length)>1},runtime);
   next=result.battle;totalDamage+=result.amount;events.push(...result.events);
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId)},events};
 }
};
