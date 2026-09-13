const clone=value=>structuredClone(value);
const label=value=>String(value??'').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());

function findMon(snapshot,actorId){return [...(snapshot.own||[]),...(snapshot.opponent||[])].find(mon=>mon.actorId===actorId);}
function nameOf(snapshot,actorId){return findMon(snapshot,actorId)?.name||actorId||'The battlefield';}
function moveName(catalog,moveId){return catalog.moves.find(move=>move.id===moveId)?.name||label(moveId);}
function hpChange(event){
 if(Number.isFinite(event.amount))return `${event.amount} HP`;
 if(Number.isFinite(event.hpBeforePercent)&&Number.isFinite(event.hpAfterPercent))return `${Math.abs(event.hpAfterPercent-event.hpBeforePercent)}% HP`;
 return 'HP';
}
function effectiveness(value){if(value===0)return ' It had no effect.';if(value>1)return ' It was super effective!';if(value>0&&value<1)return ' It was not very effective.';return '';}

export function applyBattleEvent(snapshot,event){
 const next=clone(snapshot),target=findMon(next,event.targetId||event.actorId);
 if(event.kind==='damage'||event.kind==='heal'){
  if(target&&Number.isFinite(event.hpAfter))target.hp=event.hpAfter;
  if(target&&Number.isFinite(event.hpAfterPercent))target.hpPercent=event.hpAfterPercent;
 }
 if(event.kind==='statusApplied'&&target)target.status=event.status;
 if(event.kind==='statusCured'&&target)target.status=null;
 if(event.kind==='switchOut'&&target)target.activeSlot=-1;
 if(event.kind==='switchIn'&&target)target.activeSlot=event.slot;
 if(event.kind==='megaEvolved'&&target){target.speciesId=event.toSpeciesId;target.name=event.name;target.spriteKey=event.spriteKey;target.types=[...event.types];target.hp=event.hpAfter;target.maxHp=event.maxHpAfter;target.megaEvolved=true;}
 if(event.kind==='positionsSwapped'){
  const actor=findMon(next,event.actorId),ally=findMon(next,event.allyId);
  if(actor)actor.activeSlot=event.toSlot;if(ally)ally.activeSlot=event.fromSlot;
 }
 return next;
}

export function groupTurnEvents(events=[]){
 const groups=[];let current=null;
 const flush=()=>{if(current?.events.length)groups.push(current);current=null;};
 for(const event of events){
  if(event.kind==='turnStarted')continue;
  if(event.kind==='moveStarted'){flush();current={kind:'move',actorId:event.actorId,moveId:event.moveId,events:[event]};continue;}
  if(event.kind==='megaEvolved'){flush();groups.push({kind:'mega',actorId:event.actorId,events:[event]});continue;}
  if(event.kind==='endTurnStarted'){flush();current={kind:'endTurn',events:[event]};continue;}
  if(event.kind==='actionCancelled'){flush();groups.push({kind:'cancelled',actorId:event.actorId,events:[event]});continue;}
  if(event.kind==='switchOut'&&!current){current={kind:'switch',actorId:event.actorId,events:[event]};continue;}
  if(!current)current={kind:'system',events:[]};current.events.push(event);
  if(current.kind==='switch'&&event.kind==='switchIn')flush();
 }
 flush();return groups;
}

export function battleEventText(event,snapshot,catalog){
 const actor=nameOf(snapshot,event.actorId),target=nameOf(snapshot,event.targetId),move=event.moveId&&moveName(catalog,event.moveId);
 switch(event.kind){
   case 'turnStarted':return `Turn ${event.turn} began.`;
   case 'moveStarted':return `${actor} used ${move}!${Number.isFinite(event.speed)?` (Speed ${event.speed}${event.priority?`, priority ${event.priority}`:''})`:''}`;
   case 'megaEvolved':return `${actor} Mega Evolved into ${event.name}! Its Ability became ${label(event.abilityId)}.`;
   case 'megaFailed':return `${actor} could not Mega Evolve: ${label(event.reason)}.`;
   case 'ppSpent':return `${move}: ${event.ppAfter}/${event.ppBefore} PP remaining.`;
   case 'damage':return `${target} lost ${hpChange(event)}.${effectiveness(event.effectiveness)}`;
   case 'heal':return `${target} recovered ${hpChange(event)}.`;
   case 'fainted':return `${target} fainted.`;
   case 'moveMissed':return `${actor}'s ${move} missed ${target}.`;
   case 'moveBlocked':return `${target} blocked ${move}.`;
   case 'moveFailed':return `${move||actor} failed: ${label(event.reason)}.`;
   case 'actionCancelled':return `${actor} could not act because it is no longer available.${Number.isFinite(event.speed)?` (Speed ${event.speed})`:''}`;
   case 'actionPrevented':return `${actor} could not move due to ${label(event.status||event.reason)}.`;
   case 'statusApplied':return `${target} was afflicted with ${label(event.status)}.`;
   case 'statusCured':return `${actor} recovered from ${label(event.status)}.`;
   case 'statStageChanged':return `${target}'s ${String(event.stat).toUpperCase()} ${event.appliedDelta>0?'rose':event.appliedDelta<0?'fell':'could not change'}.`;
   case 'volatileApplied':return `${target} gained ${label(event.volatile)}.`;
   case 'volatileEnded':return `${actor}'s ${label(event.volatile)} ended.`;
   case 'protectionApplied':return `${actor} protected itself.`;
   case 'protectionFailed':return `${actor}'s protection failed.`;
   case 'sideProtectionApplied':return `${actor} protected its side with ${label(event.guard)}.`;
   case 'redirectionApplied':return `${actor} began redirecting attacks.`;
   case 'switchOut':return `${actor} returned.`;
   case 'switchIn':return Number.isInteger(event.slot)?`${actor} entered slot ${event.slot+1}.`:`${actor} entered the battle.`;
   case 'forcedSwitch':return `${target} was forced out.`;
   case 'positionsSwapped':return `${actor} swapped positions with ${nameOf(snapshot,event.allyId)}.`;
   case 'powerResolved':return `${move} resolved at ${event.power} power.`;
   case 'hitCount':return `${move} hit ${event.hitCount} times.`;
   case 'endTurnStarted':return 'End-of-turn effects resolved.';
   case 'turnEnded':return `Turn ${event.turn} ended.`;
   case 'battleEnded':return event.winner?`${event.winner==='A'?'Your team':'The opposing team'} won the battle.`:'The battle ended in a draw.';
   default:return `${label(event.kind)}.`;
 }
}

export function battleLog(events=[],snapshot,catalog){
 let turn=snapshot.turn||1;
 return events.map(event=>{if(event.kind==='turnStarted'&&event.turn)turn=event.turn;const entry={id:event.id||`${turn}:${event.kind}`,turn,text:battleEventText(event,snapshot,catalog),kind:event.kind};if(event.kind==='turnEnded'&&event.turn)turn=event.turn+1;return entry;});
}

export function createTurnFrames(initialSnapshot,events,{reduced=false}={}){
 let snapshot=clone(initialSnapshot),visible=events.filter(event=>event.kind==='turnStarted'),action=0;const groups=groupTurnEvents(events),total=groups.filter(group=>['move','switch','cancelled'].includes(group.kind)).length,frames=[];
 for(const group of groups){
  if(['move','switch','cancelled'].includes(group.kind))action++;
  if(group.kind==='move'){
   const [started,...effects]=group.events,context={actorId:group.actorId,moveId:group.moveId};visible=[...visible,started];frames.push({snapshot:clone(snapshot),events:[started],visibleEvents:[...visible],stage:'cast',...context,action,total,duration:reduced?0:1050});
   for(const event of effects)snapshot=applyBattleEvent(snapshot,event);visible.push(...effects);frames.push({snapshot:clone(snapshot),events:effects,visibleEvents:[...visible],stage:'impact',...context,action,total,duration:reduced?0:420});
  }else{
   for(const event of group.events)snapshot=applyBattleEvent(snapshot,event);visible.push(...group.events);frames.push({snapshot:clone(snapshot),events:group.events,visibleEvents:[...visible],stage:group.kind,action,total,duration:reduced?0:group.kind==='mega'?1000:500});
  }
 }
 return frames;
}
