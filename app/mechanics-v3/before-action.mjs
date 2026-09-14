import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {tryMajorStatusAction} from './major-status.mjs';
import {tryConfusionAction,tryFlinchAction} from './volatile-action.mjs';
import {tryVolatileMoveRestriction} from './move-restrictions.mjs';
import {abortTwoTurnMove} from './move-commitments.mjs';
import {resolveNegativeStageResetItems,resolvePpRestoreItems,resolveStatusCureItems} from './item-hooks.mjs';

function cancelledResult(next,events,action,move,reason){
 if(!move)return {cancelled:true,battle:next,events};
 const aborted=abortTwoTurnMove(next,{actorId:action.actorId,moveId:move.id,reason});return {cancelled:true,battle:aborted.battle,events:[...events,...aborted.events]};
}

export function tryBeforeMoveConditions(battle,action,runtime={},move=null){
 let next=clone(battle);const events=[];
 const ppRestore=resolvePpRestoreItems(next,{actorIds:[action.actorId],trigger:'before-action'});next=ppRestore.battle;events.push(...ppRestore.events);
 const itemCure=resolveStatusCureItems(next,{actorIds:[action.actorId],trigger:'before-action'});next=itemCure.battle;events.push(...itemCure.events);
 const stageReset=resolveNegativeStageResetItems(next,{actorIds:[action.actorId],trigger:'before-action'});next=stageReset.battle;events.push(...stageReset.events);
 const status=unitById(next,action.actorId)?.status?.id||unitById(next,action.actorId)?.status;
 if(status==='sleep'||status==='freeze'){
  const result=tryMajorStatusAction(next,action,runtime);next=result.battle;events.push(...result.events);
  if(result.cancelled)return cancelledResult(next,events,action,move,'majorStatus');
 }
 const flinch=tryFlinchAction(next,action);next=flinch.battle;events.push(...flinch.events);
 if(flinch.cancelled)return cancelledResult(next,events,action,move,'flinch');
 if(move){const restricted=tryVolatileMoveRestriction(next,action,move);next=restricted.battle;events.push(...restricted.events);if(restricted.cancelled)return cancelledResult(next,events,action,move,'moveRestriction');}
 const confusion=tryConfusionAction(next,action,runtime);next=confusion.battle;events.push(...confusion.events);
 if(confusion.cancelled)return cancelledResult(next,events,action,move,'confusion');
 const remainingStatus=unitById(next,action.actorId)?.status?.id||unitById(next,action.actorId)?.status;
 if(remainingStatus==='paralysis'){
  const result=tryMajorStatusAction(next,action,runtime);next=result.battle;events.push(...result.events);
  if(result.cancelled)return cancelledResult(next,events,action,move,'paralysis');
 }
 return {cancelled:false,battle:next,events};
}
