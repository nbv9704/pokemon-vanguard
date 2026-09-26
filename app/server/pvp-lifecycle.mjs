import {activeUnits,effectiveTargetMode,legalTargets,replacementRequirements} from '../rules-v3/index.mjs';
import {mustRechargeState,twoTurnMoveState} from '../mechanics-v3/index.mjs';
import {normalizeCommands} from './v3-battle-actions.mjs';
import {firstAiReplacements} from './v3-battle-view.mjs';

export const PVP_TIMERS=Object.freeze({
 decisionMs:45_000,
 previewMs:90_000,
 disconnectGraceMs:90_000,
 hardIdleMs:5*60_000,
 resultRetentionMs:10*60_000,
 friendlyWaitingRoomMs:15*60_000
});

const automaticTargets=new Set(['self','userSide','field','allAdjacentFoes','allAdjacent','foeSide']);
const other=side=>side==='A'?'B':'A';
const clone=value=>structuredClone(value);

export function markPvpActivity(holder,now){holder.updatedAt=now;holder.lastActivityAt=now;return holder;}
export function markParticipantDisconnected(participant,now){
 if(!participant||participant.connected===false&&participant.disconnectDeadlineAt)return participant;
 participant.connected=false;participant.disconnectedAt=now;participant.disconnectDeadlineAt=now+PVP_TIMERS.disconnectGraceMs;participant.disconnectExpired=false;return participant;
}
export function markParticipantConnected(participant,now){
 if(!participant)return participant;
 const late=Number.isFinite(participant.disconnectDeadlineAt)&&now>participant.disconnectDeadlineAt;
 participant.connected=true;
 if(late)participant.disconnectExpired=true;
 else{participant.disconnectExpired=false;participant.disconnectedAt=null;participant.disconnectDeadlineAt=null;}
 return participant;
}
export function participantDisconnectExpired(participant,now){return !!participant&&(participant.disconnectExpired===true||participant.connected===false&&Number.isFinite(participant.disconnectDeadlineAt)&&now>=participant.disconnectDeadlineAt);}

export function decisionDescriptor(holder){
 if(holder?.settled||holder?.finished)return null;
 if(!holder?.battle)return {kind:'preview',key:'PREVIEW',duration:PVP_TIMERS.previewMs};
 const phase=holder.battle.phase,revision=holder.battle.phaseRevision;
 if(phase==='COMMAND')return {kind:'command',key:`COMMAND:${revision}`,duration:PVP_TIMERS.decisionMs};
 if(phase==='REPLACE')return {kind:'replacement',key:`REPLACE:${revision}`,duration:PVP_TIMERS.decisionMs};
 return null;
}
export function syncPvpDecisionClock(holder,now){
 const descriptor=decisionDescriptor(holder);if(!descriptor){holder.decisionClock=null;return null;}
 if(holder.decisionClock?.key!==descriptor.key)holder.decisionClock={...descriptor,startedAt:now,deadlineAt:now+descriptor.duration};
 return holder.decisionClock;
}
function sideSubmitted(holder,side){
 const clock=holder.decisionClock;if(!clock)return false;
 if(clock.kind==='preview')return !!holder.participants?.[side]?.lockedBuildIds;
 const revision=holder.battle?.phaseRevision;
 if(clock.kind==='command')return !!holder.pending?.commands?.[revision]?.[side];
 if(clock.kind==='replacement'){const required=replacementRequirements(holder.battle,side).slots.length>0;return !required||!!holder.pending?.replacements?.[revision]?.[side];}
 return false;
}
export function pvpTimingView(holder,side,now){
 const decision=syncPvpDecisionClock(holder,now),foe=holder.participants?.[other(side)];
 return {serverNow:now,decision:decision?{kind:decision.kind,deadlineAt:decision.deadlineAt,remainingMs:Math.max(0,decision.deadlineAt-now),submitted:sideSubmitted(holder,side)}:null,opponent:{connected:foe?.connected!==false,reconnectDeadlineAt:foe?.connected===false?foe.disconnectDeadlineAt||null:null}};
}

function reservesFor(battle,side){const active=new Set(battle.sides[side].active);return battle.sides[side].roster.filter(unit=>unit.hp>0&&!active.has(unit.actorId));}
function unitCandidates(battle,catalog,side,unit){
 const recharge=mustRechargeState(unit),charge=twoTurnMoveState(unit);if(recharge)return [{kind:'recharge',actorId:unit.actorId}];if(charge)return [{kind:'move',actorId:unit.actorId,moveId:charge.moveId,...(charge.target?{target:clone(charge.target)}:{})}];
 const candidates=[],reserves=reservesFor(battle,side);
 for(const moveId of unit.buildSnapshot.moveIds){
  const move=catalog.movesById[moveId];if(!move||(unit.pp[moveId]||0)<=0)continue;
  const mode=effectiveTargetMode(battle,{actorId:unit.actorId,mechanics:move.mechanics}),targets=legalTargets(battle,{side,actorId:unit.actorId,targetMode:mode}),pivot=move.actionProfile?.requiresPivotTarget===true;
  const switchToId=pivot?reserves[0]?.actorId:null;if(pivot&&!switchToId)continue;
  if(automaticTargets.has(mode))candidates.push({kind:'move',actorId:unit.actorId,moveId,...(switchToId?{switchToId}:{})});
  else for(const target of targets)candidates.push({kind:'move',actorId:unit.actorId,moveId,target:{side:target.side,slot:target.slot},...(switchToId?{switchToId}:{})});
 }
 for(const reserve of reserves)candidates.push({kind:'switch',actorId:unit.actorId,toId:reserve.actorId});
 return candidates;
}
function duplicateBenchTarget(commands){const ids=commands.flatMap(command=>[command.kind==='switch'?command.toId:null,command.switchToId||null]).filter(Boolean);return new Set(ids).size!==ids.length;}
export function chooseTimeoutCommands(battle,catalog,side){
 const active=activeUnits(battle,side).map(({unit})=>unit),options=active.map(unit=>unitCandidates(battle,catalog,side,unit));if(options.some(list=>!list.length))return null;
 const current=[];function search(index){if(index===options.length){if(duplicateBenchTarget(current))return null;const raw=clone(current),valid=normalizeCommands(battle,side,raw,catalog);return valid.ok?raw:null;}for(const choice of options[index]){current.push(choice);const found=search(index+1);current.pop();if(found)return found;}return null;}
 return search(0);
}
export function chooseTimeoutReplacements(battle,side){return firstAiReplacements(battle,side);}
export function firstPreviewPicks(holder,side,pick){return holder.participants?.[side]?.teamBuildIds?.slice(0,pick)||[];}
