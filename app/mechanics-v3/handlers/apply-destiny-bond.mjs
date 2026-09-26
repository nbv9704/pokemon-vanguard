import {clone,unitById} from '../../rules-v3/battle-state.mjs';

const fail=(battle,payload,reason)=>({battle:clone(battle),payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason}]});

export const requireDestinyBondReadyHandler={
 id:'require-destiny-bond-ready',hooks:['onTryMove'],
 run({battle,payload}){const actor=unitById(battle,payload.action.actorId);if(actor?.lastMoveOutcome?.moveId===payload.move.id&&actor.lastMoveOutcome.result===true)return fail(battle,payload,'consecutiveUseBlocked');return {battle:clone(battle),payload,events:[]};}
};

export const applyDestinyBondHandler={
 id:'apply-destiny-bond',hooks:['onMove'],
 run({battle,payload}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,destinyBondApplied:false},events:[]};
  actor.volatiles??={};actor.volatiles['destiny-bond']={id:'destiny-bond',sourceId:payload.move.id,armedTurn:next.turn};
  return {battle:next,payload:{...payload,destinyBondApplied:true},events:[{kind:'volatileApplied',actorId:actor.actorId,targetId:actor.actorId,moveId:payload.move.id,volatile:'destiny-bond'}]};
 }
};
