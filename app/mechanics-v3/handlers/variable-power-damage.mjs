import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {applyDamageHit} from '../damage-hit.mjs';
import {variableMovePower} from '../variable-power.mjs';

export const variablePowerDamageHandler={
 id:'deal-variable-power-damage',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  if(typeof runtime.nextRandom!=='function')throw new Error('deal-variable-power-damage requires seeded nextRandom');
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;
  for(const targetRef of targets){const target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;const power=variableMovePower(params.formula,{battle:next,actor:unitById(next,actor.actorId),target,basePower:params.basePower??move.power});const result=applyDamageHit(next,{actorId:actor.actorId,targetId:target.actorId,move:{...move,power},spread:mechanics.targetMode==='allAdjacentFoes'&&(payload.resolvedTargetIds?.length||targets.length)>1},runtime);next=result.battle;totalDamage+=result.amount;events.push({kind:'powerResolved',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,formula:params.formula,power},...result.events);}
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId)},events};
 }
};
