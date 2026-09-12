import {clone,unitById} from '../rules-v3/battle-state.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];

export function validateVolatileMoveChoice(battle,action,move){
 const unit=unitById(battle,action.actorId),volatiles=unit?.volatiles||{};
 const encore=volatiles.encore,encoreHasPp=Number.isInteger(unit?.pp?.[encore?.moveId])&&unit.pp[encore.moveId]>0;
 if(encore&&encoreHasPp&&encore.moveId!==move.id)return {ok:false,code:'ENCORED_MOVE_REQUIRED',volatile:'encore',requiredMoveId:encore.moveId};
 if(volatiles.disable?.moveId===move.id)return {ok:false,code:'MOVE_DISABLED',volatile:'disable',disabledMoveId:move.id};
 if(volatiles.taunt&&move.category==='status')return {ok:false,code:'TAUNTED_STATUS_MOVE',volatile:'taunt'};
 return {ok:true};
}

export function tryVolatileMoveRestriction(battle,action,move){
 const next=clone(battle),result=validateVolatileMoveChoice(next,action,move);
 if(result.ok)return {cancelled:false,battle:next,events:[]};
 return {cancelled:true,battle:next,events:[{kind:'actionPrevented',actorId:action.actorId,moveId:move.id,status:result.volatile,reason:result.code}]};
}

export function createMoveChoiceValidator({moves}){
 return (battle,action)=>{
  if(action.kind!=='move')return {ok:true};
  const move=byId(moves,action.moveId);
  if(!move)return {ok:false,code:'UNKNOWN_MOVE'};
  return validateVolatileMoveChoice(battle,action,move);
 };
}
