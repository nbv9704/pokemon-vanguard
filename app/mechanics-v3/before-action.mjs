import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {tryMajorStatusAction} from './major-status.mjs';
import {tryConfusionAction,tryFlinchAction} from './volatile-action.mjs';
import {tryVolatileMoveRestriction} from './move-restrictions.mjs';

export function tryBeforeMoveConditions(battle,action,runtime={},move=null){
 let next=clone(battle);const events=[];
 const status=unitById(next,action.actorId)?.status?.id||unitById(next,action.actorId)?.status;
 if(status==='sleep'||status==='freeze'){
  const result=tryMajorStatusAction(next,action,runtime);next=result.battle;events.push(...result.events);
  if(result.cancelled)return {cancelled:true,battle:next,events};
 }
 const flinch=tryFlinchAction(next,action);next=flinch.battle;events.push(...flinch.events);
 if(flinch.cancelled)return {cancelled:true,battle:next,events};
 if(move){const restricted=tryVolatileMoveRestriction(next,action,move);next=restricted.battle;events.push(...restricted.events);if(restricted.cancelled)return {cancelled:true,battle:next,events};}
 const confusion=tryConfusionAction(next,action,runtime);next=confusion.battle;events.push(...confusion.events);
 if(confusion.cancelled)return {cancelled:true,battle:next,events};
 const remainingStatus=unitById(next,action.actorId)?.status?.id||unitById(next,action.actorId)?.status;
 if(remainingStatus==='paralysis'){
  const result=tryMajorStatusAction(next,action,runtime);next=result.battle;events.push(...result.events);
  if(result.cancelled)return {cancelled:true,battle:next,events};
 }
 return {cancelled:false,battle:next,events};
}
