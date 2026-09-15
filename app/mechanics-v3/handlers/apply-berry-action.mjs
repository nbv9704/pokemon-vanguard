import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {consumeHeldBerry,recycleConsumedItem} from '../item-hooks.mjs';

export const applyBerryActionHandler={
 id:'apply-berry-action',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const events=[],actorId=payload.action.actorId;
  if(params.mode==='recycle'){
   const result=recycleConsumedItem(next,{actorId,reason:`move:${payload.move.id}`});next=result.battle;events.push(...result.events);if(!result.recycled)events.push({kind:'moveFailed',actorId,moveId:payload.move.id,reason:'nothingToRecycle'});return {battle:next,payload:{...payload,berryActionApplied:result.recycled},events};
  }
  if(params.mode==='eat-self'){
   const result=consumeHeldBerry(next,{holderId:actorId,consumerId:actorId,reason:`move:${payload.move.id}:eat-self`,ignoreBerrySuppression:true});next=result.battle;events.push(...result.events);return {battle:next,payload:{...payload,berryActionApplied:result.consumed},events};
  }
  if(params.mode==='eat-target'){
   for(const targetId of payload.damagedTargetIds||[]){const result=consumeHeldBerry(next,{holderId:targetId,consumerId:actorId,reason:`move:${payload.move.id}:eat-target`,ignoreBerrySuppression:true});next=result.battle;events.push(...result.events);}return {battle:next,payload,events};
  }
  if(params.mode==='teatime'){
   for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){const current=unitById(next,unit.actorId);if(!current||current.hp<=0)continue;const result=consumeHeldBerry(next,{holderId:current.actorId,consumerId:current.actorId,reason:`move:${payload.move.id}:teatime`,ignoreBerrySuppression:true});next=result.battle;events.push(...result.events);}return {battle:next,payload,events};
  }
  throw new Error(`unsupported berry action: ${params.mode}`);
 }
};
