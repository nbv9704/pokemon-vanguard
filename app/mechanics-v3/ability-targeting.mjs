import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {resolveTargets} from './targets.mjs';

const reflectableHandlers=new Set(['apply-major-status','apply-volatile-status','apply-stat-stages','apply-type-change','apply-hazard','schedule-delayed-effect','modify-active-ability','apply-persistent-effect']);
const abilityEffect=(unit,kind)=>(unit?.passiveEffects||[]).find(effect=>effect?.sourceKind==='ability'&&effect.kind===kind)||null;
export const sideOfActor=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

export function opponentAbilitiesIgnoredFor(battle,actorId,targetId,mechanics){
 if(mechanics?.opponentAbilitiesIgnored!==true)return false;
 const actorSide=sideOfActor(battle,actorId),targetSide=sideOfActor(battle,targetId);
 return Boolean(actorSide&&targetSide&&actorSide!==targetSide);
}

export function statusMoveReflectable(move,mechanics){
 if(move?.category!=='status'||mechanics?.statusMoveReflected===true)return false;
 if(['self','userSide','field','allAdjacent'].includes(mechanics?.targetMode))return false;
 return (mechanics?.handlers||[]).some(handler=>reflectableHandlers.has(handler?.id)&&!(handler.id==='apply-stat-stages'&&handler.params?.target==='self')&&!(handler.id==='modify-active-ability'&&handler.params?.reflectable!==true)&&!(handler.id==='apply-type-change'&&handler.params?.reflectable===false));
}

export function statusMoveReflectionForTarget(battle,{actorId,targetId,move,mechanics}){
 if(!statusMoveReflectable(move,mechanics)||mechanics?.targetMode!=='allAdjacentFoes')return null;
 if(opponentAbilitiesIgnoredFor(battle,actorId,targetId,mechanics))return null;
 const actorSide=sideOfActor(battle,actorId),targetSide=sideOfActor(battle,targetId),target=unitById(battle,targetId);
 if(!target||target.hp<=0||!actorSide||!targetSide||actorSide===targetSide)return null;
 const effect=abilityEffect(target,'status-move-reflect');
 return effect?{unit:target,effect,side:targetSide}:null;
}

function holderForTarget(battle,action,move,mechanics){
 const targets=resolveTargets(battle,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
 const target=targets[0]&&unitById(battle,targets[0].actorId);if(!target||target.hp<=0)return null;
 const actorSide=sideOfActor(battle,action.actorId),targetSide=sideOfActor(battle,target.actorId);if(!actorSide||actorSide===targetSide)return null;
 const effect=abilityEffect(target,'status-move-reflect');return effect?{unit:target,effect,side:targetSide}:null;
}

function targetRefForActor(battle,actorId){
 const side=sideOfActor(battle,actorId);if(!side)return null;const slot=(battle.sides?.[side]?.active||[]).indexOf(actorId);return slot>=0?{side,slot}:null;
}

export function resolveStatusMoveReflection(battle,{action,move,mechanics}){
 const next=clone(battle);
 if(!statusMoveReflectable(move,mechanics)||mechanics?.opponentAbilitiesIgnored===true||mechanics?.targetMode==='allAdjacentFoes')return {battle:next,reflected:false,action,mechanics,events:[]};
 let holder=holderForTarget(next,action,move,mechanics);
 if(!holder&&mechanics?.targetMode==='foeSide'){
  const actorSide=sideOfActor(next,action.actorId),foe=actorSide==='A'?'B':actorSide==='B'?'A':null;
  if(foe)for(const {unit,side} of activeUnits(next,foe)){const effect=abilityEffect(unit,'status-move-reflect');if(effect){holder={unit,effect,side};break;}}
 }
 if(!holder)return {battle:next,reflected:false,action,mechanics,events:[]};
 const originalTarget=targetRefForActor(next,action.actorId);if(!originalTarget&&mechanics?.targetMode!=='foeSide')return {battle:next,reflected:false,action,mechanics,events:[]};
 const reflectedAction={...action,side:holder.side,actorId:holder.unit.actorId,reflectedFromActorId:action.actorId,reflectedFromSide:action.side,...(mechanics.targetMode==='foeSide'?{target:undefined}:{target:originalTarget})};
 const reflectedMechanics={...mechanics,statusMoveReflected:true,opponentAbilitiesIgnored:false};
 return {battle:next,reflected:true,action:reflectedAction,mechanics:reflectedMechanics,events:[
  {kind:'abilityTriggered',sourceId:holder.unit.actorId,abilityId:holder.effect.sourceId,effectId:holder.effect.kind,targetId:action.actorId,moveId:move.id},
  {kind:'moveReflected',actorId:action.actorId,targetId:holder.unit.actorId,reflectedById:holder.unit.actorId,moveId:move.id,abilityId:holder.effect.sourceId}
 ]};
}
