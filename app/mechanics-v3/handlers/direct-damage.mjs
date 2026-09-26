import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {applyDamageHit} from '../damage-hit.mjs';
import {abilityParentalBond} from '../ability-hooks.mjs';

export const directDamageHandler={
 id:'deal-direct-damage',hooks:['onMove'],
 run({battle,payload,params={},runtime}){
  if(typeof runtime.nextRandom!=='function')throw new Error('deal-direct-damage requires seeded nextRandom');
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const resolvedTargets=payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  const targetSide=actorId=>['A','B'].find(side=>next.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
  const targets=resolvedTargets.filter(ref=>params.targetRelation==='foe'?targetSide(ref.actorId)!==action.side:params.targetRelation==='ally'?targetSide(ref.actorId)===action.side:true);
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;const damagedTargetIds=[],connectedTargetIds=[],parentalBondSecondHitTargetIds=[];
  for(const targetRef of targets){
   const defender=unitById(next,targetRef.actorId);if(!defender||defender.hp<=0)continue;
   if(!payload.accuracyResolved&&move.accuracy!==null&&move.accuracy<100&&runtime.nextRandom()>=move.accuracy/100){events.push({kind:'moveMissed',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id});continue;}
   const bond=targets.length===1?abilityParentalBond(actor):null,first=applyDamageHit(next,{actorId:actor.actorId,targetId:defender.actorId,move,mechanics,spread:['allAdjacentFoes','allAdjacent'].includes(mechanics.targetMode)&&(payload.resolvedTargetIds?.length||targets.length)>1,moveItemMultiplier:payload.itemMoveMultiplier??1,moveItemId:payload.itemMoveItemId??null,hit:bond?1:null},runtime);
   next=first.battle;totalDamage+=first.amount;if(first.amount>0&&!first.substituteAbsorbed)damagedTargetIds.push(defender.actorId);if(first.amount>0||first.substituteAbsorbed||first.disguiseShielded)connectedTargetIds.push(defender.actorId);events.push(...first.events);
   if(bond&&first.amount>0&&unitById(next,actor.actorId)?.hp>0&&unitById(next,defender.actorId)?.hp>0){events.push({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:bond.sourceId,effectId:bond.kind,targetId:defender.actorId});const second=applyDamageHit(next,{actorId:actor.actorId,targetId:defender.actorId,move,mechanics,spread:false,moveItemMultiplier:payload.itemMoveMultiplier??1,moveItemId:payload.itemMoveItemId??null,hit:2,damageMultiplier:bond.secondHitMultiplier},runtime);next=second.battle;totalDamage+=second.amount;if(second.amount>0&&!second.substituteAbsorbed)damagedTargetIds.push(defender.actorId);if(second.amount>0||second.substituteAbsorbed||second.disguiseShielded)connectedTargetIds.push(defender.actorId);if(second.amount>0)parentalBondSecondHitTargetIds.push(defender.actorId);events.push(...second.events);}
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId),damagedTargetIds:[...new Set(damagedTargetIds)],connectedTargetIds:[...new Set(connectedTargetIds)],parentalBondSecondHitTargetIds:[...new Set(parentalBondSecondHitTargetIds)]},events};
 }
};
