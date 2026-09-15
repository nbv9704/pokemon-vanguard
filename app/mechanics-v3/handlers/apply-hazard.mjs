import {applyHazard} from '../hazards.mjs';

export const applyHazardHandler={
 id:'apply-hazard',hooks:['onMove'],
 run({battle,payload,params}){
  if(params.requireDamage&&!(payload.totalDamage>0))return {battle,payload,events:[]};
  if(params.suppressibleSecondary&&payload.mechanics?.secondaryEffectsSuppressed)return {battle,payload,events:[]};
  const result=applyHazard(battle,{actorId:payload.action.actorId,moveId:payload.move.id,hazard:params.hazard});return {battle:result.battle,payload:{...payload,hazardApplied:result.applied},events:result.events};
 }
};
