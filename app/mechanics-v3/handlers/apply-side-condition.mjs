import {applySideCondition} from '../side-conditions.mjs';

export const applySideConditionHandler={
 id:'apply-side-condition',hooks:['onMove'],
 run({battle,payload,params}){const result=applySideCondition(battle,{actorId:payload.action.actorId,moveId:payload.move.id,condition:params.condition,defaultTurns:params.turns});return {battle:result.battle,payload:{...payload,sideConditionApplied:result.applied},events:result.events};}
};
