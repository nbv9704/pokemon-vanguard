import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {applyDamageHit} from '../damage-hit.mjs';

export function selectHitCount(hits,nextRandom){
 if(Number.isInteger(hits))return hits;
 if(!Array.isArray(hits)||hits[0]!==2||hits[1]!==5)throw new Error('unsupported multi-hit range');
 const roll=nextRandom();return roll<.35?2:roll<.70?3:roll<.85?4:5;
}

export const multiHitDamageHandler={
 id:'deal-multi-hit-damage',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  if(typeof runtime.nextRandom!=='function')throw new Error('deal-multi-hit-damage requires seeded nextRandom');
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;const hitCounts={},damagedTargetIds=[];
  for(const target of targets){
   const plannedHits=selectHitCount(params.hits,runtime.nextRandom),targetId=target.actorId;let actualHits=0;
   for(let hit=1;hit<=plannedHits;hit++){
    const defender=unitById(next,targetId);if(!defender||defender.hp<=0)break;
    const result=applyDamageHit(next,{actorId:actor.actorId,targetId,move,mechanics,hit},runtime);next=result.battle;totalDamage+=result.amount;if(result.amount>0)damagedTargetIds.push(targetId);events.push(...result.events);actualHits++;
    if(result.amount===0)break;
   }
   hitCounts[targetId]=actualHits;events.push({kind:'hitCount',actorId:actor.actorId,targetId,moveId:move.id,plannedHits,hitCount:actualHits});
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId),hitCounts,damagedTargetIds:[...new Set(damagedTargetIds)]},events};
 }
};
