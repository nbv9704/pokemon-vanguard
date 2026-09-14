const clone=value=>structuredClone(value);
const label=value=>String(value??'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());

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
 const itemHolder=findMon(next,event.sourceId);
 if(event.kind==='itemRevealed'&&itemHolder)itemHolder.revealedItemId=event.itemId;
 if(event.kind==='itemConsumed'&&itemHolder){itemHolder.revealedItemId=event.itemId;itemHolder.itemConsumed=true;}
 if(event.kind==='switchOut'&&target)target.activeSlot=-1;
 if(event.kind==='switchIn'&&target)target.activeSlot=event.slot;
 if(event.kind==='megaEvolved'&&target){target.speciesId=event.toSpeciesId;target.name=event.name;target.spriteKey=event.spriteKey;target.types=[...event.types];target.hp=event.hpAfter;target.maxHp=event.maxHpAfter;target.megaEvolved=true;}
 if(event.kind==='positionsSwapped'){
  const actor=findMon(next,event.actorId),ally=findMon(next,event.allyId);
  if(actor)actor.activeSlot=event.toSlot;if(ally)ally.activeSlot=event.fromSlot;
 }
 next.field=next.field||{};next.sideConditions=next.sideConditions||{own:{},opponent:{}};
 if(event.kind==='weatherStarted')next.field.weather={id:event.weather,remaining:event.remaining};
 if(event.kind==='weatherEnded')next.field.weather=null;
 if(event.kind==='terrainStarted')next.field.terrain={id:event.terrain,remaining:event.remaining};
 if(event.kind==='terrainEnded')next.field.terrain=null;
 if(event.kind==='roomStarted'){next.field.rooms??={};next.field.rooms[event.room]={id:event.room,remaining:event.remaining};}
 if(event.kind==='roomEnded'){if(next.field.rooms)delete next.field.rooms[event.room];}
 if(event.kind==='trickRoomStarted'){next.field.rooms??={};next.field.rooms['trick-room']={id:'trick-room',remaining:event.remaining};}
 if(event.kind==='trickRoomEnded'){if(next.field.rooms)delete next.field.rooms['trick-room'];}
 if(event.kind==='sideConditionApplied'){const side=event.side==='A'?'own':'opponent';next.sideConditions[side][event.condition]={id:event.condition,remaining:event.remaining};}
 if(event.kind==='sideConditionEnded'){const side=event.side==='A'?'own':'opponent';delete next.sideConditions[side][event.condition];}
 if(event.kind==='hazardApplied'){const side=event.side==='A'?'own':'opponent';next.sideConditions[side][event.hazard]={id:event.hazard,layers:event.layers};}
 if(event.kind==='hazardRemoved'){const side=event.side==='A'?'own':'opponent';delete next.sideConditions[side][event.hazard];}
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
  if(event.kind==='rechargeTurn'){flush();groups.push({kind:'recharge',actorId:event.actorId,events:[event]});continue;}
  if(event.kind==='switchOut'&&!current){current={kind:'switch',actorId:event.actorId,events:[event]};continue;}
  if(!current)current={kind:'system',events:[]};current.events.push(event);
  if(current.kind==='switch'&&event.kind==='switchIn')flush();
 }
 flush();return groups;
}

export function visualTargetIds(events=[],actorId){
 const useful=new Set(['damage','moveMissed','moveBlocked','statusApplied','statStageChanged','volatileApplied','protectionApplied','sideProtectionApplied','heal','delayedEffectScheduled']);
 const raw=events.filter(event=>useful.has(event.kind)&&event.targetId&&!(event.kind==='damage'&&event.targetId===actorId&&['recoil','protection'].includes(event.source))).map(event=>event.targetId);
 const nonHeal=events.filter(event=>event.kind!=='heal').some(event=>event.targetId&&raw.includes(event.targetId));
 return [...new Set(raw.filter(id=>!nonHeal||id!==actorId))];
}

export function battleEventText(event,snapshot,catalog){
 const actor=nameOf(snapshot,event.actorId),target=nameOf(snapshot,event.targetId),move=event.moveId&&moveName(catalog,event.moveId);
 switch(event.kind){
   case 'turnStarted':return `Turn ${event.turn} began.`;
   case 'moveStarted':return `${actor} used ${move}!${Number.isFinite(event.speed)?` (Speed ${event.speed}${event.priority?`, priority ${event.priority}`:''})`:''}`;
   case 'abilityTriggered':{
    const source=nameOf(snapshot,event.sourceId),ability=label(event.abilityId);
    if(event.effectId==='secondary-effect-power-boost')return `${source}'s ${ability} boosted ${move}${event.suppressedSecondaries?` and suppressed ${event.suppressedSecondaries} secondary effect${event.suppressedSecondaries===1?'':'s'}`:''}.`;
    if(event.effectId==='move-type-by-tag')return `${source}'s ${ability} changed ${move} from ${label(event.fromType)} to ${label(event.toType)}.`;
    if(event.effectId==='move-tag-immunity')return `${source}'s ${ability} blocked the attack.`;
    return `${source}'s ${ability} activated.`;
   }
   case 'megaEvolved':return `${actor} Mega Evolved into ${event.name}! Its Ability became ${label(event.abilityId)}.`;
   case 'megaFailed':return `${actor} could not Mega Evolve: ${label(event.reason)}.`;
   case 'ppSpent':return `${move}: ${event.ppAfter}/${event.ppBefore} PP remaining.`;
   case 'ppSpendSkipped':return `${move} continued without spending additional PP.`;
   case 'twoTurnMovePrepared':return event.semiInvulnerable==='underground'?`${actor} burrowed underground with ${move}.`:event.semiInvulnerable==='underwater'?`${actor} dove underwater with ${move}.`:event.semiInvulnerable==='airborne'?`${actor} flew out of reach with ${move}.`:event.semiInvulnerable==='vanished'?`${actor} vanished with ${move}.`:`${actor} began charging ${move}.`;
   case 'twoTurnMoveReleased':return event.semiInvulnerable?`${actor} returned to strike with ${move}.`:`${actor} released the charged ${move}.`;
   case 'twoTurnChargeSkipped':return `${actor} used ${move} immediately under harsh sunlight.`;
   case 'twoTurnMoveAborted':return `${actor}'s ${move} commitment was interrupted by ${event.reason==='hitBySmackDown'?moveName(catalog,event.sourceMoveId):label(event.reason)}.`;
   case 'movePowerModified':return `${move}'s power became ${event.power} because of ${label(event.reason)}.`;
   case 'rechargeRequired':return `${actor} must recharge after ${move}.`;
   case 'rechargeTurn':return `${actor} recharged after ${moveName(catalog,event.moveId)}.`;
   case 'rechargeFailed':return `${actor} could not recharge: ${label(event.reason)}.`;
   case 'damage':
    if(event.reason==='post-move-recoil'&&event.itemId)return `${target} lost ${hpChange(event)} to ${label(event.itemId)} recoil.`;
    if(event.reason==='contact-retaliation'&&event.itemId)return `${target} lost ${hpChange(event)} from ${actor}'s ${label(event.itemId)}.`;
    return `${target} lost ${hpChange(event)}.${effectiveness(event.effectiveness)}`;
   case 'heal':return event.reason==='damage-recovery'&&event.itemId?`${target} recovered ${hpChange(event)} with ${label(event.itemId)}.`:`${target} recovered ${hpChange(event)}.`;
   case 'itemRevealed':return `${nameOf(snapshot,event.sourceId)} revealed ${label(event.itemId)}.`;
   case 'itemActivated':return `${nameOf(snapshot,event.sourceId)}'s ${label(event.itemId)} activated.`;
   case 'itemConsumed':return `${nameOf(snapshot,event.sourceId)} consumed ${label(event.itemId)}.`;
   case 'fainted':return `${target} fainted.`;
   case 'moveMissed':return event.reason==='semiInvulnerable'?`${actor}'s ${move} could not reach ${target} while it was ${label(event.semiInvulnerable)}.`:`${actor}'s ${move} missed ${target}.`;
   case 'moveBlocked':return event.reason==='abilityImmune'?`${target}'s ${label(event.abilityId)} blocked ${move}.`:`${target} blocked ${move}.`;
   case 'moveFailed':return `${move||actor} failed: ${label(event.reason)}.`;
   case 'actionCancelled':return `${actor} could not act because it is no longer available.${Number.isFinite(event.speed)?` (Speed ${event.speed})`:''}`;
   case 'actionPrevented':return `${actor} could not move due to ${label(event.status||event.reason)}.`;
   case 'statusApplied':return `${target} was afflicted with ${label(event.status)}.`;
   case 'statusFailed':return `${target} resisted ${label(event.status)}: ${label(event.reason)}.`;
   case 'statusCured':return `${actor} recovered from ${label(event.status)}.`;
   case 'statStageChanged':return `${target}'s ${String(event.stat).toUpperCase()} ${event.appliedDelta>0?'rose':event.appliedDelta<0?'fell':'could not change'}.`;
   case 'volatileApplied':return `${target} gained ${label(event.volatile)}.`;
   case 'volatileActivated':return `${actor} was affected by ${label(event.volatile)}.`;
   case 'volatileFailed':return `${target} resisted ${label(event.volatile)}: ${label(event.reason)}.`;
   case 'delayedEffectScheduled':return event.effect==='yawn'?`${target} grew drowsy from ${move||'Yawn'}.`:event.effect==='perish-song'?`${target} received a perish count of ${event.count}.`:`${label(event.effect)} was scheduled on ${target}.`;
   case 'delayedEffectTick':return event.effect==='yawn'?`${target} grew drowsier.`:event.effect==='perish-song'?`${target}'s perish count fell to ${event.count}.`:`${label(event.effect)} has ${event.remaining} turns remaining on ${target}.`;
   case 'delayedEffectResolved':return event.effect==='yawn'?`Yawn resolved on ${target}.`:event.effect==='perish-song'?`${target}'s perish count reached 0.`:`${label(event.effect)} resolved on ${target}.`;
   case 'delayedEffectFailed':return `${move||label(event.effect)} failed on ${target}: ${label(event.reason)}.`;
   case 'volatileEnded':return `${actor}'s ${label(event.volatile)} ended.`;
   case 'protectionApplied':return `${actor} protected itself.`;
   case 'protectionFailed':return `${actor}'s protection failed.`;
   case 'protectionBroken':return `${move} broke through ${target}'s protection.`;
   case 'sideProtectionApplied':return `${actor} protected its side with ${label(event.guard)}.`;
   case 'redirectionApplied':return `${actor} began redirecting attacks.`;
   case 'switchOut':return `${actor} returned.`;
   case 'switchIn':return Number.isInteger(event.slot)?`${actor} entered slot ${event.slot+1}.`:`${actor} entered the battle.`;
   case 'forcedSwitch':return `${target} was forced out.`;
   case 'forceSwitchFailed':return `${move} could not force ${target} out: ${label(event.reason)}.`;
   case 'pivotFailed':return `${actor} could not switch out after ${move}: ${label(event.reason)}.`;
   case 'positionsSwapped':return `${actor} swapped positions with ${nameOf(snapshot,event.allyId)}.`;
   case 'positionSwapFailed':return `${actor} could not swap positions: ${label(event.reason)}.`;
   case 'powerResolved':return `${move} resolved at ${event.power} power.`;
   case 'hitCount':return `${move} hit ${event.hitCount} times.`;
   case 'weatherStarted':return `${label(event.weather)} weather began${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`;
   case 'weatherEnded':return `${label(event.weather)} weather ended.`;
   case 'terrainStarted':return `${label(event.terrain)} terrain appeared${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`;
   case 'terrainEnded':return `${label(event.terrain)} terrain disappeared.`;
   case 'roomStarted':return event.room==='trick-room'?`Trick Room twisted the move order${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`:event.room==='wonder-room'?`Wonder Room swapped Defense and Sp. Def${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`:event.room==='magic-room'?`Magic Room suppressed held-item effects${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`:`${label(event.room)} began${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`;
   case 'roomEnded':return `${label(event.room)} ended${event.reason==='recast'?' after being used again':''}.`;
   case 'trickRoomStarted':return `Trick Room twisted the move order${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`;
   case 'trickRoomEnded':return 'Trick Room returned to normal.';
   case 'sideConditionApplied':return `${event.side==='A'?'Your':'The opposing'} side gained ${label(event.condition)}${Number.isInteger(event.remaining)?` for ${event.remaining} turns`:''}.`;
   case 'sideConditionEnded':return `${label(event.condition)} ended on ${event.side==='A'?'your':'the opposing'} side.`;
   case 'hazardApplied':return `${label(event.hazard)} was set on ${event.side==='A'?'your':'the opposing'} side${event.maxLayers>1?` (layer ${event.layers}/${event.maxLayers})`:''}.`;
   case 'hazardTriggered':return event.hazard==='toxic-spikes'?`${label(event.hazard)} triggered on ${target}${event.status?`, inflicting ${label(event.status)}`:''}.`:`${target} was hurt by ${label(event.hazard)} for ${event.amount} HP${event.hazard==='stealth-rock'?effectiveness(event.effectiveness):'.'}`;
   case 'hazardRemoved':return event.reason==='poison-type-absorption'?`${target} absorbed ${label(event.hazard)} from ${event.side==='A'?'your':'the opposing'} side.`:`${label(event.hazard)} was cleared from ${event.side==='A'?'your':'the opposing'} side${move?` by ${move}`:''}.`;
   case 'entryReplacementRequired':return 'Entry effects caused a faint; another replacement is required.';
   case 'turnSuspended':return 'The turn paused for an entry replacement.';
   case 'entryCompleted':return event.resume?'The replacement entered; the interrupted turn will continue.':'All replacements entered the battle.';
   case 'turnResumed':return 'The interrupted turn resumed.';
   case 'endTurnStarted':return 'End-of-turn effects resolved.';
   case 'turnEnded':return `Turn ${event.turn} ended.`;
   case 'battleEnded':return event.winner?`${event.winner==='A'?'Your team':'The opposing team'} won the battle.`:'The battle ended in a draw.';
   default:return `${label(event.kind)}.`;
 }
}

export function battleLog(events=[],snapshot,catalog){
 let turn=events.find(event=>event.kind==='turnStarted'&&event.turn)?.turn||1;
 return events.map(event=>{if(event.kind==='turnStarted'&&event.turn)turn=event.turn;const entry={id:event.id||`${turn}:${event.kind}`,turn,text:battleEventText(event,snapshot,catalog),kind:event.kind};if(event.kind==='turnEnded'&&event.turn)turn=event.turn+1;return entry;});
}

export function createTurnFrames(initialSnapshot,events,{reduced=false}={}){
 let snapshot=clone(initialSnapshot),visible=events.filter(event=>event.kind==='turnStarted'),action=0;const groups=groupTurnEvents(events),total=groups.filter(group=>['move','switch','cancelled','recharge'].includes(group.kind)).length,frames=[];
 for(const group of groups){
  if(['move','switch','cancelled','recharge'].includes(group.kind))action++;
  if(group.kind==='move'){
   const [started,...effects]=group.events,context={actorId:group.actorId,moveId:group.moveId,targetIds:visualTargetIds(effects,group.actorId)};visible=[...visible,started];frames.push({snapshot:clone(snapshot),events:[started],visibleEvents:[...visible],stage:'cast',...context,action,total,duration:reduced?0:1050});
   for(const event of effects)snapshot=applyBattleEvent(snapshot,event);visible.push(...effects);frames.push({snapshot:clone(snapshot),events:effects,visibleEvents:[...visible],stage:'impact',...context,action,total,duration:reduced?0:420});
  }else{
   for(const event of group.events)snapshot=applyBattleEvent(snapshot,event);visible.push(...group.events);frames.push({snapshot:clone(snapshot),events:group.events,visibleEvents:[...visible],stage:group.kind,action,total,duration:reduced?0:group.kind==='mega'?1000:500});
  }
 }
 return frames;
}
