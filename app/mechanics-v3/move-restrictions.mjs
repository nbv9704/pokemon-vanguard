import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {validateSwitchingChoice} from './switching.mjs';
import {validateMoveCommitmentChoice} from './move-commitments.mjs';
import {validateChoiceItemMove} from './item-hooks.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

export function validateVolatileSwitchChoice(battle,action){
 if(action.kind!=='switch')return {ok:true};
 const unit=unitById(battle,action.actorId);if(!unit)return {ok:true};
 const fairy=battle.field?.fairyLock;if(fairy&&battle.turn>=fairy.activeTurn)return {ok:false,code:'FAIRY_LOCK_SWITCH_BLOCKED',condition:'fairy-lock',sourceActorId:fairy.sourceActorId,sourceMoveId:fairy.sourceMoveId};
 if(unit.volatiles?.ingrain)return {ok:false,code:'INGRAIN_SWITCH_BLOCKED',volatile:'ingrain',sourceMoveId:unit.volatiles.ingrain.sourceId};
 for(const [volatile,state] of [['bound',unit.volatiles?.bound],['trapped',unit.volatiles?.trapped]]){
  if(!state?.trapsSwitch||unit?.types?.includes('ghost'))continue;
  const source=unitById(battle,state.sourceActorId),sourceSide=sideOf(battle,state.sourceActorId),sourceActive=source&&source.hp>0&&sourceSide&&(battle.sides?.[sourceSide]?.active||[]).includes(source.actorId);
  if(sourceActive)return {ok:false,code:volatile==='bound'?'BOUND_SWITCH_BLOCKED':'TRAPPED_SWITCH_BLOCKED',volatile,sourceActorId:source.actorId,sourceMoveId:state.sourceId};
 }
 return {ok:true};
}


export function validateVolatileMoveChoice(battle,action,move,mechanics=null){
 const unit=unitById(battle,action.actorId),volatiles=unit?.volatiles||{};
 const encore=volatiles.encore,encoreHasPp=Number.isInteger(unit?.pp?.[encore?.moveId])&&unit.pp[encore.moveId]>0;
 if(volatiles.rampage?.moveId&&volatiles.rampage.moveId!==move.id)return {ok:false,code:'RAMPAGE_MOVE_REQUIRED',volatile:'rampage',requiredMoveId:volatiles.rampage.moveId};
 if(encore&&encoreHasPp&&encore.moveId!==move.id)return {ok:false,code:'ENCORED_MOVE_REQUIRED',volatile:'encore',requiredMoveId:encore.moveId};
 if(volatiles.disable?.moveId===move.id)return {ok:false,code:'MOVE_DISABLED',volatile:'disable',disabledMoveId:move.id};
 if(volatiles.taunt&&move.category==='status')return {ok:false,code:'TAUNTED_STATUS_MOVE',volatile:'taunt'};
 if(volatiles.torment&&unit?.lastMoveId===move.id)return {ok:false,code:'TORMENT_SAME_MOVE_BLOCKED',volatile:'torment',blockedMoveId:move.id};
 for(const [volatile,state] of Object.entries(volatiles)){const blocked=state?.blockedMoveTags;if(!Array.isArray(blocked)||!blocked.length)continue;const tag=(mechanics?.tags||[]).find(value=>blocked.includes(value));if(tag)return {ok:false,code:'MOVE_TAG_BLOCKED',volatile,blockedTag:tag};}
 return {ok:true};
}

export function tryVolatileMoveRestriction(battle,action,move,mechanics=null){
 const next=clone(battle),result=validateVolatileMoveChoice(next,action,move,mechanics);
 if(result.ok)return {cancelled:false,battle:next,events:[]};
 return {cancelled:true,battle:next,events:[{kind:'actionPrevented',actorId:action.actorId,moveId:move.id,status:result.volatile,reason:result.code}]};
}

export function createMoveChoiceValidator({moves,manifests={}}){
 return (battle,action)=>{
  const commitment=validateMoveCommitmentChoice(battle,action);if(!commitment.ok)return commitment;
  const switchLock=validateVolatileSwitchChoice(battle,action);if(!switchLock.ok)return switchLock;
  if(action.kind!=='move')return {ok:true};
  const move=byId(moves,action.moveId);
  if(!move)return {ok:false,code:'UNKNOWN_MOVE'};
  const volatile=validateVolatileMoveChoice(battle,action,move,manifests?.[action.moveId]);if(!volatile.ok)return volatile;
  const choice=validateChoiceItemMove(battle,action,move);if(!choice.ok)return choice;
  return validateSwitchingChoice(battle,action,manifests?.[action.moveId]);
 };
}
