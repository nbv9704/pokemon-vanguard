import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {lastDamageReceivedThisTurn} from '../turn-history.mjs';

const targetRef=(battle,record)=>{
 if(record?.sourceSide&&Number.isInteger(record.sourceSlot)){const actorId=battle.sides?.[record.sourceSide]?.active?.[record.sourceSlot],unit=actorId?unitById(battle,actorId):null;if(unit?.hp>0)return {side:record.sourceSide,slot:record.sourceSlot};}
 for(const side of ['A','B']){const slot=battle.sides?.[side]?.active?.indexOf(record?.sourceId)??-1;if(slot>=0&&unitById(battle,record.sourceId)?.hp>0)return {side,slot};}
 return null;
};

export const prepareRetaliationHandler={
 id:'prepare-retaliation',hooks:['onTryMove'],
 run({battle,payload,params}){
  const next=clone(battle),record=lastDamageReceivedThisTurn(next,payload.action.actorId,params.category||'any'),target=targetRef(next,record);
  if(!record||!target)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'noRetaliationDamage'}]};
  const numerator=params.numerator??1,denominator=params.denominator??1,preparedFixedDamage=Math.max(1,Math.floor(record.amount*numerator/denominator));
  return {battle:next,payload:{...payload,action:{...payload.action,target},preparedFixedDamage},events:[{kind:'retaliationPrepared',actorId:payload.action.actorId,targetId:next.sides[target.side].active[target.slot],moveId:payload.move.id,sourceMoveId:record.moveId,damageTaken:record.amount,preparedFixedDamage}]};
 }
};

export const requireUserUnhitHandler={
 id:'require-user-unhit',hooks:['onTryMove'],
 run({battle,payload}){
  const next=clone(battle),record=lastDamageReceivedThisTurn(next,payload.action.actorId,'any');
  if(!record)return {battle:next,payload,events:[]};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'lostFocus',sourceId:record.sourceId,sourceMoveId:record.moveId}]};
 }
};
