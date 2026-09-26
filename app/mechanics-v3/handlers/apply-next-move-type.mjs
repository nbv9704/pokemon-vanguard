import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';

export const applyNextMoveTypeHandler={
 id:'apply-next-move-type',hooks:['onMove'],
 run({battle,payload,params={},runtime}){
  const next=clone(battle),{action,move,mechanics}=payload,events=[];
  const targets=(payload.hitTargetIds||[]).length?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  let applied=false;
  for(const ref of targets){const target=unitById(next,ref.actorId);if(!target||target.hp<=0)continue;if(runtime?.hasActed?.(target.actorId)===true||runtime?.willMove?.(target.actorId)===false){events.push({kind:'moveFailed',actorId:action.actorId,targetId:target.actorId,moveId:move.id,reason:'targetAlreadyActed'});continue;}target.volatiles??={};target.volatiles[params.stateId||'next-move-type']={id:params.stateId||'next-move-type',sourceId:move.id,moveType:params.type,endTurnTimer:1};events.push({kind:'volatileApplied',actorId:action.actorId,targetId:target.actorId,moveId:move.id,volatile:params.stateId||'next-move-type',moveType:params.type});applied=true;}
  if(!applied&&!events.some(event=>event.kind==='moveFailed'))events.push({kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noTarget'});
  return {battle:next,payload,events};
 }
};
