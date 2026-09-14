import {applyHazard} from '../hazards.mjs';

export const applyHazardHandler={
 id:'apply-hazard',hooks:['onMove'],
 run({battle,payload,params}){const result=applyHazard(battle,{actorId:payload.action.actorId,moveId:payload.move.id,hazard:params.hazard});return {battle:result.battle,payload:{...payload,hazardApplied:result.applied},events:result.events};}
};
