import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const prepareFormDependentMoveHandler={
 id:'prepare-form-dependent-move',hooks:['onTryMove'],
 run({battle,payload,params}){
  const next=clone(battle),unit=unitById(next,payload.action.actorId),type=params?.typeBySpecies?.[unit?.speciesId];
  if(!unit||unit.hp<=0||!type)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'wrongForm'}]};
  return {battle:next,payload,events:[]};
 }
};
