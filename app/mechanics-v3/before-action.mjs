import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {tryMajorStatusAction} from './major-status.mjs';
import {tryVolatileAction} from './volatile-action.mjs';

export function tryBeforeMoveConditions(battle,action,runtime={}){
 let next=clone(battle);const events=[];
 const status=unitById(next,action.actorId)?.status?.id||unitById(next,action.actorId)?.status;
 if(status==='sleep'||status==='freeze'){
  const result=tryMajorStatusAction(next,action,runtime);next=result.battle;events.push(...result.events);
  if(result.cancelled)return {cancelled:true,battle:next,events};
 }
 const volatile=tryVolatileAction(next,action,runtime);next=volatile.battle;events.push(...volatile.events);
 if(volatile.cancelled)return {cancelled:true,battle:next,events};
 const remainingStatus=unitById(next,action.actorId)?.status?.id||unitById(next,action.actorId)?.status;
 if(remainingStatus==='paralysis'){
  const result=tryMajorStatusAction(next,action,runtime);next=result.battle;events.push(...result.events);
  if(result.cancelled)return {cancelled:true,battle:next,events};
 }
 return {cancelled:false,battle:next,events};
}
