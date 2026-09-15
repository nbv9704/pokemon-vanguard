import {clone,unitById} from '../../rules-v3/battle-state.mjs';

const STATE='stored-stat-overrides';
function remember(unit,stats){
 unit.volatiles??={};const state=unit.volatiles[STATE]??={id:STATE,originalStats:{}};unit.volatiles[STATE]=state;
 for(const stat of stats)if(!Object.hasOwn(state.originalStats,stat))state.originalStats[stat]=unit.stats[stat];
}
function snapshot(unit,stats){return Object.fromEntries(stats.map(stat=>[stat,unit.stats[stat]]));}

export const modifyStoredStatsHandler={
 id:'modify-stored-stats',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),events=[];if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  const stats=params.stats||[];
  if(params.mode==='swap-self'){
   remember(actor,stats);const before=snapshot(actor,stats),[a,b]=stats;[actor.stats[a],actor.stats[b]]=[actor.stats[b],actor.stats[a]];
   if(params.toggleVolatile){actor.volatiles??={};if(actor.volatiles[params.toggleVolatile])delete actor.volatiles[params.toggleVolatile];else actor.volatiles[params.toggleVolatile]={id:params.toggleVolatile};}
   events.push({kind:'storedStatsChanged',actorId:actor.actorId,moveId:payload.move.id,mode:params.mode,stats:[...stats],before,after:snapshot(actor,stats)});return {battle:next,payload,events};
  }
  for(const targetId of payload.hitTargetIds||[]){
   const target=unitById(next,targetId);if(!target||target.hp<=0)continue;remember(actor,stats);remember(target,stats);const actorBefore=snapshot(actor,stats),targetBefore=snapshot(target,stats);
   if(params.mode==='swap-target')for(const stat of stats)[actor.stats[stat],target.stats[stat]]=[target.stats[stat],actor.stats[stat]];
   else if(params.mode==='average-target')for(const stat of stats){const value=Math.floor((actor.stats[stat]+target.stats[stat])/2);actor.stats[stat]=value;target.stats[stat]=value;}
   events.push({kind:'storedStatsChanged',actorId:actor.actorId,targetId:target.actorId,moveId:payload.move.id,mode:params.mode,stats:[...stats],actorBefore,targetBefore,actorAfter:snapshot(actor,stats),targetAfter:snapshot(target,stats)});
  }
  return {battle:next,payload,events};
 }
};
