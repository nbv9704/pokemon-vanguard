import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyFairyLockHandler={
 id:'apply-fairy-lock',hooks:['onMove'],
 run({battle,payload}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  next.field??={};next.field.fairyLock={id:'fairy-lock',remaining:2,activeTurn:next.turn+1,sourceActorId:actor.actorId,sourceMoveId:payload.move.id};
  return {battle:next,payload:{...payload,fairyLockApplied:true},events:[{kind:'fieldConditionStarted',actorId:actor.actorId,moveId:payload.move.id,condition:'fairy-lock',activeTurn:next.turn+1,remaining:2}]};
 }
};
