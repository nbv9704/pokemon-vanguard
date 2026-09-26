import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyDamageHit} from '../damage-hit.mjs';
import {applyMajorStatus} from '../major-status.mjs';
import {applyVolatileStatus} from '../volatile-state.mjs';
import {heldItemId,consumeHeldItemForFling,applyThrownBerryEffects} from '../item-hooks.mjs';
import {flingItemMetadata} from '../foundation-data.mjs';

export const prepareFlingHandler={
 id:'prepare-fling',hooks:['onTryMove'],
 run({battle,payload}){
  const actor=unitById(battle,payload.action.actorId),itemId=heldItemId(actor),meta=itemId?flingItemMetadata(itemId):null;
  if(!actor||actor.hp<=0||!itemId||meta?.usable!==true)return {battle:clone(battle),payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:!itemId?'noHeldItem':'itemCannotBeFlung',...(itemId?{itemId}:{})}]};
  const consumed=consumeHeldItemForFling(battle,{actorId:actor.actorId,itemId});
  if(!consumed.consumed)return {battle:consumed.battle,payload:{...payload,cancelled:true,recordLastMove:true},events:[...consumed.events,{kind:'moveFailed',actorId:actor.actorId,moveId:payload.move.id,reason:'itemCannotBeFlung',itemId}]};
  return {battle:consumed.battle,payload:{...payload,flingItemId:itemId,flingItemMetadata:meta,flingItemEffects:consumed.effects||[]},events:consumed.events};
 }
};

function clearMentalHerb(target,moveId,itemId){const events=[];for(const volatile of ['infatuation','taunt','encore','torment','disable','heal-block'])if(target.volatiles?.[volatile]){delete target.volatiles[volatile];events.push({kind:'volatileEnded',actorId:target.actorId,targetId:target.actorId,volatile,reason:'fling',moveId,itemId});}return events;}
function clearNegativeStages(target,moveId,itemId){const events=[];target.stages??={};for(const stat of ['atk','def','spa','spd','spe','accuracy','evasion']){const before=target.stages[stat]||0;if(before<0){target.stages[stat]=0;events.push({kind:'statStageChanged',actorId:target.actorId,targetId:target.actorId,moveId,itemId,stat,before,after:0,requestedDelta:-before,appliedDelta:-before,reason:'fling-white-herb'});}}return events;}

export const flingDamageHandler={
 id:'deal-fling-damage',hooks:['onMove'],
 run({battle,payload,runtime}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];const power=payload.flingItemMetadata?.basePower;
  if(!actor||actor.hp<=0||!Number.isInteger(power))return {battle:next,payload:{...payload,totalDamage:0,damagedTargetIds:[]},events:[]};
  const targets=(payload.hitTargetIds||[]).map(actorId=>({actorId}));let totalDamage=0;const damagedTargetIds=[];
  for(const ref of targets){const target=unitById(next,ref.actorId);if(!target||target.hp<=0)continue;const result=applyDamageHit(next,{actorId:actor.actorId,targetId:target.actorId,move:{...move,power},mechanics,spread:false,moveItemMultiplier:payload.itemMoveMultiplier??1,moveItemId:payload.itemMoveItemId??null},runtime);next=result.battle;totalDamage+=result.amount;events.push({kind:'powerResolved',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,formula:'fling-item',power,itemId:payload.flingItemId},...result.events);
   if(result.amount<=0||result.substituteAbsorbed)continue;damagedTargetIds.push(target.actorId);const live=unitById(next,target.actorId);if(!live||live.hp<=0)continue;const effect=payload.flingItemMetadata?.effect,itemId=payload.flingItemId;
   if(effect==='berry'){const applied=applyThrownBerryEffects(next,{sourceId:actor.actorId,targetId:live.actorId,itemId,effects:payload.flingItemEffects});next=applied.battle;events.push(...applied.events);}
   else if(effect==='flinch'){const applied=applyVolatileStatus(next,{actorId:actor.actorId,targetId:live.actorId,moveId:move.id,volatile:'flinch'},runtime);next=applied.battle;events.push(...applied.events);}
   else if(effect==='paralysis'||effect==='poison'){const applied=applyMajorStatus(next,{actorId:actor.actorId,targetId:live.actorId,moveId:move.id,status:effect==='paralysis'?'paralysis':'poison'},runtime);next=applied.battle;events.push(...applied.events);}
   else if(effect==='mental-herb')events.push(...clearMentalHerb(live,move.id,itemId));
   else if(effect==='white-herb')events.push(...clearNegativeStages(live,move.id,itemId));
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(x=>x.actorId),damagedTargetIds:[...new Set(damagedTargetIds)]},events};
 }
};
