import {clone,unitById} from '../rules-v3/battle-state.mjs';

const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
const historyFor=(battle,turn=battle.turn)=>battle.turnHistory?.turn===turn?battle.turnHistory:null;

export function targetDamagedThisTurn(battle,actorId){return Boolean(historyFor(battle)?.damaged?.[actorId]);}
export function targetDamagedUserThisTurn(battle,sourceId,userId){return Boolean(historyFor(battle)?.damageBySource?.[sourceId]?.[userId]);}
export function lastDamageReceivedThisTurn(battle,actorId,category='any'){const history=historyFor(battle);return category==='any'?history?.lastDamageReceived?.[actorId]||null:history?.lastDamageReceivedByCategory?.[actorId]?.[category]||null;}
export function statsRaisedThisTurn(battle,actorId){return Boolean(historyFor(battle)?.statsRaised?.[actorId]);}
export function statsLoweredThisTurn(battle,actorId){return Boolean(historyFor(battle)?.statsLowered?.[actorId]);}
export function allyFaintedPreviousTurn(battle,actorId){const side=sideOf(battle,actorId);return Boolean(side&&battle.sides?.[side]?.lastFaintTurn===battle.turn-1);}
export function previousMoveFailed(battle,actorId){const unit=unitById(battle,actorId);return unit?.lastMoveOutcome?.turn===battle.turn-1&&unit.lastMoveOutcome.result===false;}

export function recordMoveOutcome(battle,actorId,moveId,result,{turn=battle.turn}={}){
 const next=clone(battle),unit=unitById(next,actorId);if(unit)unit.lastMoveOutcome={moveId,turn,result};return next;
}

export function moveOutcomeFromEvents(move,actorId,events=[]){
 const relevant=events.filter(event=>event?.moveId===move.id||event?.actorId===actorId||event?.sourceId===actorId);
 if(relevant.some(event=>event?.kind==='moveBlocked'&&['protect','wide-guard','quick-guard'].includes(event.reason)))return true;
 if(relevant.some(event=>event?.kind==='damage'&&event.moveId===move.id&&event.amount>0))return true;
 if(relevant.some(event=>['substituteDamaged','disguiseBroken','statusApplied','volatileApplied','statStageChanged','healed','heal','protectionApplied','sideProtectionApplied'].includes(event?.kind)&&(!event.moveId||event.moveId===move.id)))return true;
 if(relevant.some(event=>['moveFailed','moveMissed','actionPrevented','protectionFailed','positionSwapFailed','pivotFailed'].includes(event?.kind)))return false;
 if(relevant.some(event=>event?.kind==='moveBlocked'))return false;
 return move.category==='status';
}

export function recordTurnEvents(battle,events=[],{turn=battle.turn}={}){
 const next=clone(battle),history=next.turnHistory?.turn===turn?next.turnHistory:{turn,damaged:{},damageBySource:{},statsRaised:{},statsLowered:{},lastDamageReceived:{},lastDamageReceivedByCategory:{}};history.lastDamageReceived??={};history.lastDamageReceivedByCategory??={};next.turnHistory=history;
 for(const event of events){
  if(event?.kind==='damage'&&event.amount>0&&event.targetId){
   history.damaged[event.targetId]=(history.damaged[event.targetId]||0)+event.amount;
   if(event.actorId){history.damageBySource[event.actorId]??={};history.damageBySource[event.actorId][event.targetId]=(history.damageBySource[event.actorId][event.targetId]||0)+event.amount;}
   if(event.actorId&&event.actorId!==event.targetId&&event.moveId){const record={sourceId:event.actorId,sourceSide:event.sourceSide??sideOf(next,event.actorId),sourceSlot:Number.isInteger(event.sourceSlot)?event.sourceSlot:null,amount:event.amount,category:event.category||null,moveId:event.moveId,turn};history.lastDamageReceived[event.targetId]=record;if(event.category==='physical'||event.category==='special'){history.lastDamageReceivedByCategory[event.targetId]??={};history.lastDamageReceivedByCategory[event.targetId][event.category]=record;}}
  }
  if(event?.kind==='statStageChanged'&&event.targetId&&event.appliedDelta>0)history.statsRaised[event.targetId]=true;
  if(event?.kind==='statStageChanged'&&event.targetId&&event.appliedDelta<0)history.statsLowered[event.targetId]=true;
  if(event?.kind==='fainted'&&event.targetId){const side=sideOf(next,event.targetId);if(side)next.sides[side].lastFaintTurn=turn;}
 }
 return next;
}
