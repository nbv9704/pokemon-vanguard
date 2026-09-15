import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {breakProtection} from '../protection.mjs';

export const breakProtectionHandler={
 id:'break-protection',hooks:['onMove'],
 run({battle,payload}){
  const next=clone(battle),{action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload,events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=resolveTargets(next,{side:action.side,actorId:actor.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move}),result=breakProtection(next,{targetRefs:targets,actorId:actor.actorId,moveId:move.id});
  return {battle:result.battle,payload:{...payload,protectionBrokenTargetIds:targets.map(target=>target.actorId)},events:result.events};
 }
};
