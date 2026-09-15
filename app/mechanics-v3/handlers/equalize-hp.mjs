import {clone,unitById} from '../../rules-v3/battle-state.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;

export const equalizeHpHandler={
 id:'equalize-hp',hooks:['onMove'],
 run({battle,payload}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),events=[],targetIds=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,equalizedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  for(const targetId of payload.hitTargetIds||[]){
   const target=unitById(next,targetId);if(!target||target.hp<=0||target.actorId===actor.actorId)continue;
   const average=Math.max(1,Math.floor((actor.hp+target.hp)/2)),actorBefore=actor.hp,targetBefore=target.hp;
   actor.hp=Math.min(maxHp(actor),average);target.hp=Math.min(maxHp(target),average);targetIds.push(target.actorId);
   events.push({kind:'hpEqualized',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,average,actorHpBefore:actorBefore,actorHpAfter:actor.hp,targetHpBefore:targetBefore,targetHpAfter:target.hp});
  }
  if(!targetIds.length)events.push({kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'});
  return {battle:next,payload:{...payload,equalizedTargetIds:targetIds},events};
 }
};
