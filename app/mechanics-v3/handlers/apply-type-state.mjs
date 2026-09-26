import {clone,unitById} from '../../rules-v3/battle-state.mjs';

const rememberSwitchTypes=unit=>{unit.volatiles??={};if(!unit.volatiles['type-change-state'])unit.volatiles['type-change-state']={id:'type-change-state',originalTypes:[...(unit.types||[])],restoreOnSwitch:true};};

export const applyTypeStateHandler={
 id:'apply-type-state',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,typeStateApplied:false},events:[]};
  if(params.requireHit===true&&!(payload.connectedTargetIds||[]).length)return {battle:next,payload:{...payload,typeStateApplied:false},events:[]};
  if(params.requireHealing===true&&!(payload.healedTargetIds||[]).includes(actor.actorId))return {battle:next,payload:{...payload,typeStateApplied:false},events:[]};
  const before=[...(actor.types||[])],after=before.filter(type=>type!==params.removeType);
  if(before.length===after.length)return {battle:next,payload:{...payload,typeStateApplied:false},events:[]};
  actor.volatiles??={};
  if(params.duration==='switch'){rememberSwitchTypes(actor);actor.types=after;}
  else if(params.duration==='turn'){actor.types=after;actor.volatiles[params.stateId||'temporary-type-state']={id:params.stateId||'temporary-type-state',restoreTypes:before,restoreTypesOnEndTurn:true,endTurnTimer:1};}
  else throw new Error(`unsupported type state duration: ${params.duration}`);
  events.push({kind:'typesChanged',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,beforeTypes:before,afterTypes:[...after],temporary:params.duration==='turn'});
  return {battle:next,payload:{...payload,typeStateApplied:true},events};
 }
};
