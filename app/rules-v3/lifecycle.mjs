import {activeUnits,clone,livingCount,reserveUnits,unitById} from './battle-state.mjs';
import {commitEvents} from './events.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;

export function applyHpGroup(battle,changes,source){
 const next=clone(battle),events=[],seen=new Set();
 for(const change of changes){
  if(seen.has(change.actorId))throw new Error(`duplicate HP change for ${change.actorId}`);seen.add(change.actorId);
  const unit=unitById(next,change.actorId);if(!unit||unit.hp<=0)continue;
  if(!Number.isInteger(change.delta))throw new Error('HP delta must be an integer');
  const limit=maxHp(unit);if(!Number.isInteger(limit)||limit<1)throw new Error(`invalid max HP for ${unit.actorId}`);
  const before=unit.hp,after=Math.max(0,Math.min(limit,before+change.delta));unit.hp=after;
  if(after===before)continue;
  events.push({kind:after<before?'damage':'heal',targetId:unit.actorId,hpBefore:before,hpAfter:after,amount:Math.abs(after-before),source});
  if(after===0)events.push({kind:'fainted',targetId:unit.actorId,source});
 }
 return {battle:next,events};
}

export function checkBattleResult(battle){
 if(battle.result)return {battle,events:[]};
 const a=livingCount(battle,'A'),b=livingCount(battle,'B');
 if(a&&b)return {battle,events:[]};
 const next=clone(battle),winner=a?'A':b?'B':null,reason=winner?'all-fainted':'draw-ko';
 next.phase='FINISHED';next.phaseRevision=(next.phaseRevision||0)+1;
 next.result={winner,reason,turn:next.turn,receiptId:`${next.id}:result`};
 return {battle:next,events:[{kind:'battleEnded',winner,reason,receiptId:next.result.receiptId}]};
}

export function replacementRequirements(battle,side){
 const reserves=reserveUnits(battle,side),empty=activeUnits(battle,side,{includeFainted:true}).filter(entry=>entry.unit.hp<=0);
 const missing=(battle.sides[side].active||[]).map((actorId,slot)=>({actorId,slot})).filter(entry=>!entry.actorId);
 const slots=[...empty.map(entry=>entry.slot),...missing.map(entry=>entry.slot)].sort((a,b)=>a-b);
 return {slots,count:Math.min(slots.length,reserves.length),reserveIds:reserves.map(unit=>unit.actorId)};
}

export function validateReplacements(battle,side,choices){
 if(battle.phase!=='REPLACE')return {ok:false,code:'WRONG_PHASE'};
 const required=replacementRequirements(battle,side),slots=new Set(),ids=new Set();
 if(!Array.isArray(choices)||choices.length!==required.count)return {ok:false,code:'INVALID_REPLACEMENT_COUNT'};
 for(const choice of choices||[])if(!required.slots.includes(choice.slot)||!required.reserveIds.includes(choice.actorId)||slots.has(choice.slot)||ids.has(choice.actorId))return {ok:false,code:'INVALID_REPLACEMENT'};else{slots.add(choice.slot);ids.add(choice.actorId);}
 return {ok:true,choices:clone(choices)};
}

export function applySwitch(battle,side,actorId,toId){
 const slot=battle.sides?.[side]?.active?.indexOf(actorId),reserve=reserveUnits(battle,side).find(unit=>unit.actorId===toId);
 if(slot<0||!reserve)return {ok:false,code:'INVALID_SWITCH'};
 const next=clone(battle),outgoing=unitById(next,actorId);
 if(outgoing.status?.id==='bad-poison')outgoing.status.toxicCounter=0;
 outgoing.stages={atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0};outgoing.volatiles={};next.sides[side].active[slot]=toId;
 return {ok:true,battle:next,events:[{kind:'switchOut',actorId,side,slot},{kind:'switchIn',actorId:toId,side,slot}]};
}

export function applyReplacements(battle,choicesBySide){
 let next=clone(battle);const events=[];
 for(const side of ['A','B']){
  const valid=validateReplacements(next,side,choicesBySide[side]||[]);if(!valid.ok)return valid;
  for(const choice of valid.choices.sort((a,b)=>a.slot-b.slot)){next.sides[side].active[choice.slot]=choice.actorId;events.push({kind:'switchIn',actorId:choice.actorId,side,slot:choice.slot,replacement:true});}
 }
 next.phase='ENTRY';next.phaseRevision=(next.phaseRevision||0)+1;next.turn++;
 const committed=commitEvents(next,events);return {ok:true,...committed};
}

export function completeEntry(battle,events=[]){
 if(battle.phase!=='ENTRY')return {ok:false,code:'WRONG_PHASE'};
 const next=clone(battle);next.phase='COMMAND';next.phaseRevision=(next.phaseRevision||0)+1;
 return {ok:true,...commitEvents(next,events)};
}

export function resolveEndTurn(battle,groups){
 if(battle.phase!=='END_TURN')return {ok:false,code:'WRONG_PHASE'};
 let next=clone(battle);const events=[],groupIds=new Set();
 for(const group of groups||[]){
  if(!group?.id||groupIds.has(group.id)||!Array.isArray(group.changes))throw new Error('end-turn groups require unique ids and change arrays');groupIds.add(group.id);
  const applied=applyHpGroup(next,group.changes,group.id);next=applied.battle;events.push(...applied.events);
 }
 for(const side of ['A','B'])for(const entry of activeUnits(next,side,{includeFainted:true}))if(entry.unit.volatiles?.redirection)delete entry.unit.volatiles.redirection;
 events.push({kind:'turnEnded',turn:next.turn});
 const result=checkBattleResult(next);next=result.battle;events.push(...result.events);
 if(next.phase!=='FINISHED'){
  const needsReplacement=['A','B'].some(side=>replacementRequirements(next,side).count>0);
  next.phase=needsReplacement?'REPLACE':'COMMAND';next.phaseRevision=(next.phaseRevision||0)+1;
  if(!needsReplacement)next.turn++;
 }
 return {ok:true,...commitEvents(next,events)};
}
