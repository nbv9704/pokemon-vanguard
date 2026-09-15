import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {abilityStageChange} from '../ability-stage-change.mjs';
import {resolveHpThresholdItems} from '../item-hooks.mjs';

const clamp=value=>Math.max(-6,Math.min(6,value));

export const payHpCostHandler={
 id:'pay-hp-cost',hooks:['onTryMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const stageLimit=params.requireStageBelow;
  if(stageLimit){const before=Number.isInteger(actor.stages?.[stageLimit.stat])?actor.stages[stageLimit.stat]:0;if(before>=stageLimit.value)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'stageAlreadyMaximized',stat:stageLimit.stat,value:before}]};}
  const boosts=params.requirePotentialStageChange;
  if(boosts){
   const canChange=Object.entries(boosts).some(([stat,delta])=>{const requested=abilityStageChange(actor,delta).requestedDelta,before=Number.isInteger(actor.stages?.[stat])?actor.stages[stat]:0;return clamp(before+requested)!==before;});
   if(!canChange)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noPotentialStageChange'}]};
  }
  const maxHp=actor.maxHp??actor.stats?.hp,amount=Math.max(1,Math.floor(maxHp*params.numerator/params.denominator));
  if(actor.hp<=amount)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'insufficientHpForCost',requiredHp:amount+1}]};
  const hpBefore=actor.hp;actor.hp-=amount;const events=[{kind:'damage',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,source:'hp-cost',hpBefore,hpAfter:actor.hp,amount}];
  const threshold=resolveHpThresholdItems(next,{actorIds:[actor.actorId],trigger:`hp-cost:${move.id}`});next=threshold.battle;events.push(...threshold.events);
  return {battle:next,payload:{...payload,hpCost:amount},events};
 }
};
