import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveOpponentStatGainCopyAbilities} from '../ability-stage-response.mjs';

export const maximizeStatStageHandler={
 id:'maximize-stat-stage',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const actor=unitById(next,payload.action.actorId),stat=params.stat,value=params.value??6;
  if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};actor.stages??={};const before=Number.isInteger(actor.stages[stat])?actor.stages[stat]:0;if(before===value)return {battle:next,payload,events:[]};actor.stages[stat]=value;const change={kind:'statStageChanged',actorId:actor.actorId,targetId:actor.actorId,moveId:payload.move.id,stat,before,after:value,requestedDelta:value-before,appliedDelta:value-before,reason:'setStage'},events=[change];
  const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:actor.actorId,changes:[change],trigger:'primary'});next=copied.battle;events.push(...copied.events);return {battle:next,payload:{...payload,maximizedStat:stat},events};
 }
};
