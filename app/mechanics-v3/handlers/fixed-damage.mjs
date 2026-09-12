import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {typeEffectiveness} from '../../rules-v3/type-chart.mjs';

export const fixedDamageHandler={
 id:'deal-fixed-damage',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;
  for(const targetRef of targets){const target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;const effectiveness=typeEffectiveness(move.type,target.types),hpBefore=target.hp,requested=params.formula==='user-level'?(next.level||50):Math.max(1,Math.floor(target.hp/params.denominator)),amount=effectiveness===0?0:Math.min(hpBefore,requested);target.hp-=amount;totalDamage+=amount;events.push({kind:'damage',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,hpBefore,hpAfter:target.hp,amount,effectiveness,breakdown:{fixed:true,formula:params.formula,requested}});if(target.hp===0)events.push({kind:'fainted',targetId:target.actorId,source:move.id});}
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId)},events};
 }
};
