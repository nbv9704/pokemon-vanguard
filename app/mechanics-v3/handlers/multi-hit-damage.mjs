import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {applyDamageHit} from '../damage-hit.mjs';
import {abilityMaximizesMultiHit} from '../ability-hooks.mjs';
import {repeatHitAccuracyChance} from './check-accuracy.mjs';

export function selectHitCount(hits,nextRandom,{maximize=false}={}){
 if(Number.isInteger(hits))return hits;
 if(!Array.isArray(hits)||hits[0]!==2||hits[1]!==5)throw new Error('unsupported multi-hit range');
 if(maximize)return hits[1];
 const roll=nextRandom();return roll<.35?2:roll<.70?3:roll<.85?4:5;
}

export const multiHitDamageHandler={
 id:'deal-multi-hit-damage',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  if(typeof runtime.nextRandom!=='function')throw new Error('deal-multi-hit-damage requires seeded nextRandom');
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],hitCounts:{},damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;const hitCounts={},damagedTargetIds=[];
  for(const target of targets){
   const dynamicPowers=Array.isArray(payload.partyHitPowers)?payload.partyHitPowers:null,smartSplitCount=params.smartSplit===true?(payload.smartSplitTargetIds||[]).length:0,plannedHits=dynamicPowers?dynamicPowers.length:smartSplitCount>1?1:selectHitCount(params.hits,runtime.nextRandom,{maximize:abilityMaximizesMultiHit(unitById(next,actor.actorId))}),targetId=target.actorId;let actualHits=0;
   for(let hit=1;hit<=plannedHits;hit++){
    const liveActor=unitById(next,actor.actorId);if(!liveActor||liveActor.hp<=0)break;
    const defender=unitById(next,targetId);if(!defender||defender.hp<=0)break;
    if(params.perHitAccuracy===true&&hit>1){const chance=repeatHitAccuracyChance(next,{actor:liveActor,target:defender,move,mechanics,runtime});if(chance!==null&&chance<100){if(typeof runtime.nextRandom!=='function')throw new Error('per-hit accuracy requires seeded nextRandom');if(runtime.nextRandom()>=chance/100){events.push({kind:'moveMissed',actorId:liveActor.actorId,targetId:defender.actorId,moveId:move.id,effectiveAccuracy:chance,hit});break;}}}
    const hitPower=dynamicPowers?dynamicPowers[hit-1]:Array.isArray(params.powerByHit)?params.powerByHit[hit-1]:Number.isFinite(params.powerStep)?move.power+(hit-1)*params.powerStep:move.power,hitMove=hitPower===move.power?move:{...move,power:hitPower};
    const result=applyDamageHit(next,{actorId:actor.actorId,targetId,move:hitMove,mechanics,hit,moveItemMultiplier:payload.itemMoveMultiplier??1,moveItemId:payload.itemMoveItemId??null},runtime);next=result.battle;totalDamage+=result.amount;if(result.amount>0&&!result.substituteAbsorbed)damagedTargetIds.push(targetId);events.push(...result.events);actualHits++;
    if(result.amount===0&&!result.disguiseShielded)break;
   }
   hitCounts[targetId]=actualHits;events.push({kind:'hitCount',actorId:actor.actorId,targetId,moveId:move.id,plannedHits,hitCount:actualHits});
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId),hitCounts,damagedTargetIds:[...new Set(damagedTargetIds)]},events};
 }
};
