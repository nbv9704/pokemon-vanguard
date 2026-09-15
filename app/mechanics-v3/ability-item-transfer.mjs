import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {effectiveBattleSpeed} from './speed.mjs';
import {heldItemId,transferHeldItem} from './item-hooks.mjs';

const abilityEffect=(unit,kind)=>(unit?.passiveEffects||[]).find(effect=>effect?.sourceKind==='ability'&&effect.kind===kind)||null;
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

function orderedDamagedTargets(battle,actorId,damagedTargetIds){
 const actorSide=sideOf(battle,actorId);
 return [...new Set(damagedTargetIds||[])].map(id=>unitById(battle,id)).filter(Boolean).sort((left,right)=>{
  const speed=effectiveBattleSpeed(battle,right)-effectiveBattleSpeed(battle,left);if(speed)return speed;
  const leftOpponent=sideOf(battle,left.actorId)!==actorSide,rightOpponent=sideOf(battle,right.actorId)!==actorSide;if(leftOpponent!==rightOpponent)return leftOpponent?-1:1;
  return left.actorId.localeCompare(right.actorId);
 });
}

export function resolvePostMoveItemTransferAbilities(battle,{actorId,move,mechanics,damagedTargetIds=[]}={}){
 let next=clone(battle);const events=[];if(!actorId||!move||move.category==='status'||!damagedTargetIds.length)return {battle:next,events};
 let actor=unitById(next,actorId);if(!actor)return {battle:next,events};
 const targets=orderedDamagedTargets(next,actorId,damagedTargetIds);
 if(mechanics?.contact===true&&mechanics?.secondaryEffectsSuppressed!==true&&heldItemId(actor)){
  for(const targetRef of targets){
   const target=unitById(next,targetRef.actorId);actor=unitById(next,actorId);if(!target||target.hp<=0||!actor||!heldItemId(actor)||heldItemId(target))continue;const effect=abilityEffect(target,'item-steal-on-contact');if(!effect)continue;
   const moved=transferHeldItem(next,{fromId:actorId,toId:target.actorId,reason:'item-steal-on-contact',sourceAbilityId:effect.sourceId,sourceAbilityHolderId:target.actorId});next=moved.battle;events.push(...moved.events);if(moved.transferred)return {battle:next,events};
  }
 }
 actor=unitById(next,actorId);const magician=actor?.hp>0&&!heldItemId(actor)?abilityEffect(actor,'item-steal-on-hit'):null;
 if(!magician)return {battle:next,events};
 for(const targetRef of targets){
  const target=unitById(next,targetRef.actorId);actor=unitById(next,actorId);if(!target||!heldItemId(target)||!actor||heldItemId(actor))continue;
  const moved=transferHeldItem(next,{fromId:target.actorId,toId:actorId,reason:'item-steal-on-hit',sourceAbilityId:magician.sourceId,sourceAbilityHolderId:actorId});next=moved.battle;events.push(...moved.events);if(moved.transferred)break;
 }
 return {battle:next,events};
}
