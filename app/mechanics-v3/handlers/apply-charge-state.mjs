import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyChargeStateHandler={
 id:'apply-charge-state',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,chargeApplied:false},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  actor.volatiles??={};const existed=Boolean(actor.volatiles.charge);actor.volatiles.charge={id:'charge',sourceId:move.id,damageMultiplierByType:{electric:params.multiplier??2},consumeOnMoveTypes:['electric'],excludeMoveIds:['charge']};
  return {battle:next,payload:{...payload,chargeApplied:true},events:[{kind:existed?'volatileRefreshed':'volatileApplied',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,volatile:'charge'}]};
 }
};
