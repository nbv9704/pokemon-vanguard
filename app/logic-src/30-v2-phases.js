const V2_PHASES=['CREATED','PREVIEW','ENTRY','COMMAND','RESOLVE','END_TURN','REPLACE','FINISHED'];
const V2_PHASE_NEXT={CREATED:['PREVIEW'],PREVIEW:['ENTRY'],ENTRY:['COMMAND','REPLACE','FINISHED'],COMMAND:['RESOLVE'],RESOLVE:['END_TURN','FINISHED'],END_TURN:['COMMAND','REPLACE','FINISHED'],REPLACE:['ENTRY'],FINISHED:[]};
function V2_transition(battle,next){
 if(!V2_PHASE_NEXT[battle.phase]?.includes(next))return {ok:false,code:'WRONG_PHASE'};
 return {ok:true,battle:{...battle,phase:next,phaseRevision:(battle.phaseRevision||0)+1}};
}
function V2_monById(battle,id){for(const side of ['A','B']){const mon=battle.sides[side].roster.find(entry=>entry.battleMonId===id);if(mon)return mon;}return null;}
function V2_activeEntries(battle,side){return battle.sides[side].active.map((id,slot)=>({mon:id?V2_monById(battle,id):null,slot})).filter(entry=>entry.mon&&entry.mon.hp>0);}
function V2_reserves(battle,side){const active=new Set(battle.sides[side].active.filter(Boolean));return battle.sides[side].roster.filter(mon=>mon.hp>0&&!active.has(mon.battleMonId));}
function V2_resolveTargets(battle,side,actorId,move,target){
 const foe=side==='A'?'B':'A',actor=V2_monById(battle,actorId),at=(targetSide,slot)=>{const id=battle.sides[targetSide].active[slot];const mon=id?V2_monById(battle,id):null;return mon?.hp>0?{side:targetSide,slot,battleMonId:id}:null;};
 if(move.targetMode==='self')return [{side,slot:battle.sides[side].active.indexOf(actorId),battleMonId:actorId}];
 if(move.targetMode==='ownSide'||move.targetMode==='field')return [];
 if(move.targetMode==='allFoes')return V2_activeEntries(battle,foe).map(entry=>({side:foe,slot:entry.slot,battleMonId:entry.mon.battleMonId}));
 if(move.targetMode==='ally'){const found=target&&target.side===side?at(side,target.slot):null;return found&&found.battleMonId!==actorId?[found]:[];}
 if(move.targetMode==='foe'){
  const redirects=V2_activeEntries(battle,foe).filter(entry=>entry.mon.volatiles.redirect).sort((a,b)=>(b.mon.volatiles.redirectOrder||0)-(a.mon.volatiles.redirectOrder||0));
  if(redirects[0])return [{side:foe,slot:redirects[0].slot,battleMonId:redirects[0].mon.battleMonId}];
  let found=target&&target.side===foe?at(foe,target.slot):null;
  if(!found){const first=V2_activeEntries(battle,foe)[0];found=first?{side:foe,slot:first.slot,battleMonId:first.mon.battleMonId}:null;}
  return found?[found]:[];
 }
 return actor?[]:[];
}
function V2_validateCommands(battle,side,commands,moves){
 if(battle.phase!=='COMMAND')return {ok:false,code:'WRONG_PHASE'};
 if(battle.pending?.[side])return {ok:false,code:'ALREADY_SUBMITTED'};
 const active=V2_activeEntries(battle,side),actors=new Set(active.map(entry=>entry.mon.battleMonId));
 if(!Array.isArray(commands)||commands.length!==actors.size)return {ok:false,code:'INVALID_COMMAND_COUNT'};
 const seen=new Set(),switches=new Set(),normalized=[];
 for(const command of commands){
  if(!command||!actors.has(command.actorId)||seen.has(command.actorId))return {ok:false,code:'INVALID_ACTOR'};seen.add(command.actorId);
  const mon=V2_monById(battle,command.actorId);
  if(command.kind==='switch'){
   if(!V2_reserves(battle,side).some(entry=>entry.battleMonId===command.toId)||switches.has(command.toId))return {ok:false,code:'INVALID_SWITCH'};
   switches.add(command.toId);normalized.push({...command});continue;
  }
  if(command.kind!=='move')return {ok:false,code:'INVALID_COMMAND'};
  const allEmpty=V2_allMovesEmpty(mon,mon.buildSnapshot.moveIds),struggle=command.moveId==='struggle';
  if(struggle&&!allEmpty)return {ok:false,code:'INVALID_MOVE'};
  if(!struggle&&(!mon.buildSnapshot.moveIds.includes(command.moveId)||!moves[command.moveId]))return {ok:false,code:'INVALID_MOVE'};
  if(!struggle&&(mon.pp[command.moveId]||0)<=0)return {ok:false,code:'NO_PP'};
  const move=struggle?V2_STRUGGLE:moves[command.moveId],targets=V2_resolveTargets(battle,side,command.actorId,move,command.target);
  if(['foe','ally'].includes(move.targetMode)&&targets.length===0)return {ok:false,code:'INVALID_TARGET'};
  normalized.push({...command,target:targets[0]?{side:targets[0].side,slot:targets[0].slot}:command.target});
 }
 return {ok:true,commands:normalized};
}
function V2_buildQueue(battle,commandSets,moves){
 let rngState=battle.rngState>>>0;
 const entries=[];
 for(const side of ['A','B'])for(const command of commandSets[side]||[]){
  const mon=V2_monById(battle,command.actorId);if(!mon)continue;
  const roll=V2_nextRandom(rngState);rngState=roll.state;
  const move=command.kind==='move'?(command.moveId==='struggle'?V2_STRUGGLE:moves[command.moveId]):null;
  entries.push({side,command,actorId:command.actorId,switchRank:command.kind==='switch'?1:0,priority:move?.priority||0,speed:typeof V2_effectiveStat==='function'?V2_effectiveStat(mon,'spe',battle,side):mon.stats.spe,tieKey:roll.value});
 }
 entries.sort((a,b)=>b.switchRank-a.switchRank||b.priority-a.priority||b.speed-a.speed||b.tieKey-a.tieKey||a.actorId.localeCompare(b.actorId));
 return {queue:entries,rngState};
}
function V2_submitCommands(battle,side,commands,moves){
 const valid=V2_validateCommands(battle,side,commands,moves);if(!valid.ok)return valid;
 const next=JSON.parse(JSON.stringify(battle));next.pending=next.pending||{};next.pending[side]=valid.commands;
 if(!next.pending.A||!next.pending.B)return {ok:true,battle:next,ready:false};
 const built=V2_buildQueue(next,next.pending,moves);next.queue=built.queue;next.rngState=built.rngState;next.pending={};next.phase='RESOLVE';next.phaseRevision=(next.phaseRevision||0)+1;return {ok:true,battle:next,ready:true};
}
function V2_applySwitch(battle,side,actorId,toId){
 const slot=battle.sides[side].active.indexOf(actorId),reserve=V2_reserves(battle,side).find(mon=>mon.battleMonId===toId);
 if(slot<0||!reserve)return {ok:false,code:'INVALID_SWITCH'};
 const next=JSON.parse(JSON.stringify(battle)),out=V2_monById(next,actorId);out.stages={atk:0,def:0,spa:0,spd:0,spe:0};out.volatiles={};next.sides[side].active[slot]=toId;
 return {ok:true,battle:next,events:[{kind:'switchOut',actorId},{kind:'switchIn',actorId:toId,side,slot}]};
}
