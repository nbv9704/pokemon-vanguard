import {clone} from '../../rules-v3/battle-state.mjs';

const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

export const breakSideScreensHandler={
 id:'break-side-screens',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,targetIds=[...new Set(payload.hitTargetIds||[])],events=[],broken=[];
  for(const targetId of targetIds){const side=sideOf(next,targetId);if(!side)continue;for(const condition of params.conditions){if(!next.sides?.[side]?.conditions?.[condition])continue;delete next.sides[side].conditions[condition];const key=`${side}:${condition}`;if(broken.includes(key))continue;broken.push(key);events.push({kind:'sideConditionEnded',side,condition,reason:'brokenByMove',actorId:action.actorId,targetId,moveId:move.id});}}
  return {battle:next,payload:{...payload,brokenSideConditions:broken},events};
 }
};
