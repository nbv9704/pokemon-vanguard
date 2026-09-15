import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {heldItemId,removeHeldItem,swapHeldItems,transferHeldItem} from '../item-hooks.mjs';
import {opponentAbilitiesIgnoredFor} from '../ability-targeting.mjs';

export const applyHeldItemActionHandler={
 id:'apply-held-item-action',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move,mechanics}=payload,events=[],affected=[];
  const targetIds=params.requireDamage===false?(payload.hitTargetIds||[]):(payload.damagedTargetIds||[]);
  for(const targetId of targetIds){
   const actor=unitById(next,action.actorId),target=unitById(next,targetId);if(!actor||actor.hp<=0||!target||target.hp<=0)continue;
   const ignoreRemovalImmunity=opponentAbilitiesIgnoredFor(next,actor.actorId,target.actorId,mechanics);
   if(params.mode==='steal'){
    if(!heldItemId(target)||heldItemId(actor))continue;const moved=transferHeldItem(next,{fromId:target.actorId,toId:actor.actorId,reason:`move:${move.id}:steal`,ignoreRemovalImmunity});next=moved.battle;events.push(...moved.events);if(moved.transferred)affected.push(target.actorId);
   }else if(params.mode==='remove'){
    if(!heldItemId(target))continue;const removed=removeHeldItem(next,{actorId:target.actorId,reason:`move:${move.id}:remove`,sourceId:actor.actorId,ignoreRemovalImmunity});next=removed.battle;events.push(...removed.events);if(removed.removed)affected.push(target.actorId);
   }else if(params.mode==='swap'){
    const swapped=swapHeldItems(next,{sourceId:actor.actorId,targetId:target.actorId,reason:`move:${move.id}:swap`,ignoreTargetRemovalImmunity:ignoreRemovalImmunity});next=swapped.battle;events.push(...swapped.events);if(swapped.swapped)affected.push(target.actorId);
   }else throw new Error(`unsupported held item action: ${params.mode}`);
  }
  return {battle:next,payload:{...payload,itemActionTargetIds:[...new Set(affected)]},events};
 }
};
