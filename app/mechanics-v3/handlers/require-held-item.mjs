import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {heldItemId,revealHeldItem} from '../item-hooks.mjs';

export const requireHeldItemHandler={
 id:'require-held-item',hooks:['onTryMove'],
 run({battle,payload,params={}}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move}),target=targets[0]&&unitById(next,targets[0].actorId),itemId=heldItemId(target);
  if(!target||target.hp<=0||!itemId||(params.requireBerry===true&&!itemId.endsWith('-berry')))return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:actor.actorId,...(target?{targetId:target.actorId}:{}),moveId:move.id,reason:params.requireBerry===true?'heldBerryRequirement':'heldItemRequirement'}]};
  const events=[];if(params.reveal===true){const revealed=revealHeldItem(next,{actorId:target.actorId,itemId,reason:`move:${move.id}`,force:true});next=revealed.battle;events.push(...revealed.events);}
  return {battle:next,payload:{...payload,requiredHeldItemTargetId:target.actorId,requiredHeldItemId:itemId},events};
 }
};
