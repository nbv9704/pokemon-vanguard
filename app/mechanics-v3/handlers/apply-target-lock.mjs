import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyTargetLockHandler={
 id:'apply-target-lock',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),targetId=(payload.hitTargetIds||[])[0];if(!actor||actor.hp<=0||!targetId)return {battle:next,payload,events:[]};
  actor.volatiles??={};actor.volatiles['target-lock']={id:'target-lock',targetActorId:targetId,endTurnTimer:params.endTurnTimer??2,alwaysHitsTarget:true,bypassSemiInvulnerability:true,consumeOnDamagingMove:true};
  return {battle:next,payload,events:[{kind:'targetLocked',actorId:actor.actorId,targetId,moveId:payload.move.id}]};
 }
};
