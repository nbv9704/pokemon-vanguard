import {clone,unitById} from '../rules-v3/battle-state.mjs';

const sameTarget=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

export function twoTurnMoveState(unit){return unit?.volatiles?.['two-turn-move']||null;}
export function mustRechargeState(unit){return unit?.volatiles?.['must-recharge']||null;}

export function validateMoveCommitmentChoice(battle,action){
 const unit=unitById(battle,action.actorId);if(!unit)return {ok:true};
 const recharge=mustRechargeState(unit);if(recharge){
  if(action.kind!=='recharge')return {ok:false,code:'MUST_RECHARGE',moveId:recharge.moveId};
  return {ok:true};
 }
 const charge=twoTurnMoveState(unit);if(charge){
  if(action.kind!=='move'||action.moveId!==charge.moveId)return {ok:false,code:'TWO_TURN_MOVE_REQUIRED',requiredMoveId:charge.moveId};
  if(!sameTarget(action.target,charge.target))return {ok:false,code:'TWO_TURN_TARGET_LOCKED',requiredMoveId:charge.moveId,target:clone(charge.target)};
 }
 if(action.kind==='recharge')return {ok:false,code:'RECHARGE_NOT_REQUIRED'};
 return {ok:true};
}

export function abortTwoTurnMove(battle,{actorId,moveId,reason}){
 const next=clone(battle),unit=unitById(next,actorId),state=twoTurnMoveState(unit);
 if(!state||state.moveId!==moveId)return {battle:next,events:[]};
 delete unit.volatiles['two-turn-move'];
 return {battle:next,events:[{kind:'twoTurnMoveAborted',actorId,moveId,reason}]};
}

export function resolveRechargeAction(battle,action){
 const next=clone(battle),unit=unitById(next,action.actorId),state=mustRechargeState(unit);
 if(!unit||unit.hp<=0)return {battle:next,events:[{kind:'actionCancelled',actorId:action.actorId,reason:'actorUnavailable',speed:action.speed,priority:action.priority??0}]};
 if(!state)return {battle:next,events:[{kind:'rechargeFailed',actorId:action.actorId,reason:'notRequired'}]};
 delete unit.volatiles['must-recharge'];
 return {battle:next,events:[{kind:'rechargeTurn',actorId:action.actorId,moveId:state.moveId,speed:action.speed,priority:action.priority??0}]};
}
