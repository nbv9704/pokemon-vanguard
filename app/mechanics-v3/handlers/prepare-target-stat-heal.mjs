import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {stagedStat} from '../../rules-v3/stats.mjs';

export const prepareTargetStatHealHandler={
 id:'prepare-target-stat-heal',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),stat=params.stat;if(!['atk','def','spa','spd','spe'].includes(stat))throw new Error('prepare-target-stat-heal requires a stored stat');
  const applications=[];let hitTargetIds=[...(payload.hitTargetIds||[])],reflectedStatusHits=[...(payload.reflectedStatusHits||[])];
  const raw=[...hitTargetIds.map(targetId=>({sourceId:payload.action.actorId,targetId,reflected:false})),...reflectedStatusHits.map(hit=>({sourceId:hit.sourceId,targetId:hit.targetId,reflected:true}))];
  const blocked=new Set();
  for(const application of raw){const target=unitById(next,application.targetId),source=unitById(next,application.sourceId);if(!target||target.hp<=0||!source||source.hp<=0)continue;
   if(params.failAtStageFloor===true&&(target.stages?.[stat]??0)<=-6){blocked.add(`${application.sourceId}:${application.targetId}:${application.reflected}`);continue;}
   const base=target.stats?.[stat];if(!Number.isInteger(base)||base<1)continue;applications.push({...application,amount:stagedStat(base,target.stages?.[stat]||0)});
  }
  if(blocked.size){hitTargetIds=hitTargetIds.filter(targetId=>!blocked.has(`${payload.action.actorId}:${targetId}:false`));reflectedStatusHits=reflectedStatusHits.filter(hit=>!blocked.has(`${hit.sourceId}:${hit.targetId}:true`));}
  const events=blocked.size?[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'targetStatFloor',stat}]:[];
  return {battle:next,payload:{...payload,hitTargetIds,reflectedStatusHits,targetStatHealApplications:applications},events};
 }
};
