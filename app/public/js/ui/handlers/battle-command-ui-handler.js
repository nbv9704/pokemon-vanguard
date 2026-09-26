const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const automaticTargets=new Set(['self','userSide','field','allAdjacentFoes','allAdjacent','foeSide']);
const commandModes={COMMAND:'BATTLE_COMMAND',MOVE:'BATTLE_MOVE_SELECT',TARGET:'BATTLE_TARGET_SELECT',PARTY:'BATTLE_PARTY',REVIEW:'BATTLE_REVIEW'};
const typeColors={normal:'#a8a878',fire:'#f08030',water:'#6890f0',electric:'#f8d030',grass:'#78c850',ice:'#98d8d8',fighting:'#c03028',poison:'#a040a0',ground:'#e0c068',flying:'#a890f0',psychic:'#f85888',bug:'#a8b820',rock:'#b8a038',ghost:'#705898',dragon:'#7038f8',dark:'#705848',steel:'#b8b8d0',fairy:'#ee99ac'};
const activeOwn=snapshot=>(snapshot?.own||[]).filter(mon=>mon.activeSlot>=0&&mon.hp>0).sort((a,b)=>a.activeSlot-b.activeSlot);
const reserves=snapshot=>(snapshot?.own||[]).filter(mon=>mon.activeSlot<0&&mon.hp>0);
const choiceLockMove=(snapshot,mon)=>snapshot.field?.rooms?.['magic-room']?null:mon.volatiles?.['choice-lock']?.moveId||null;
const moveTargetMode=(move,mon)=>move?.actionProfile?.dynamicTargetMode==='ghost-or-self'?(mon?.types||[]).includes('ghost')?'anyAdjacent':'self':move?.actionProfile?.targetMode;
const moveById=(catalog,id)=>catalog?.moves?.find(entry=>entry.id===id);
const percent=mon=>Math.max(0,Math.min(100,mon?.maxHp?mon.hp/mon.maxHp*100:mon?.hpPercent??0));

function targetCandidates(snapshot,mon,move){
 const mode=moveTargetMode(move,mon),allies=activeOwn(snapshot),foes=(snapshot?.opponent||[]).filter(entry=>entry.activeSlot>=0&&entry.hpPercent>0).sort((a,b)=>a.activeSlot-b.activeSlot);
 const own=allies.map(entry=>({side:'A',slot:entry.activeSlot,actorId:entry.actorId,name:entry.name,kind:'ally'}));
 const enemy=foes.map(entry=>({side:'B',slot:entry.activeSlot,actorId:entry.actorId,name:entry.name,kind:'foe'}));
 if(mode==='adjacentAlly')return own.filter(entry=>entry.actorId!==mon.actorId);
 if(mode==='adjacentAllyOrSelf')return own;
 if(mode==='adjacentFoe')return enemy;
 if(mode==='anyAdjacent')return [...own.filter(entry=>entry.actorId!==mon.actorId),...enemy];
 return [];
}

function usableMoves(snapshot,mon,catalog){
 const locked=choiceLockMove(snapshot,mon);
 return (mon.buildSnapshot?.moveIds||[]).map(id=>moveById(catalog,id)).filter(Boolean).map(move=>{
  const targets=targetCandidates(snapshot,mon,move),hasTarget=automaticTargets.has(moveTargetMode(move,mon))||targets.length>0;
  return {move,disabled:(mon.pp?.[move.id]||0)<=0||!!locked&&move.id!==locked||!hasTarget};
 });
}

function megaInfo(snapshot,mon,catalog){
 const relation=catalog?.megaRelations?.find(entry=>entry.baseSpeciesId===(mon.baseSpeciesId||mon.speciesId)&&entry.itemId===mon.buildSnapshot?.itemId);
 if(!relation)return null;
 const form=catalog?.megaForms?.find(entry=>entry.id===relation.megaSpeciesId),available=!mon.megaEvolved&&(snapshot.megaUsed?.A||0)<(snapshot.megaLimit||0);
 return {relation,form,available};
}

function reserveChoices(screen,snapshot,actorId){
 const used=new Set(Object.values(screen.commands||{}).filter(command=>command?.actorId!==actorId).flatMap(command=>[command?.kind==='switch'?command.toId:null,command?.switchToId||null]).filter(Boolean));
 return reserves(snapshot).map(mon=>({mon,disabled:used.has(mon.actorId)}));
}

function forcedCommand(mon){
 const recharge=mon.volatiles?.['must-recharge'],charge=mon.volatiles?.['two-turn-move'];
 if(recharge)return {kind:'recharge',actorId:mon.actorId};
 if(charge)return {kind:'move',actorId:mon.actorId,moveId:charge.moveId,...(charge.target?{target:charge.target}:{})};
 return null;
}

function commandSummary(command,snapshot,catalog){
 if(!command)return 'No action selected';
 if(command.kind==='recharge')return 'Recharge';
 if(command.kind==='switch')return `Switch → ${esc((snapshot.own||[]).find(mon=>mon.actorId===command.toId)?.name||command.toId)}`;
 if(command.kind==='move'){
  const move=moveById(catalog,command.moveId),target=command.target&&(command.target.side==='A'?snapshot.own:snapshot.opponent)?.find(mon=>mon.activeSlot===command.target.slot);
  return `${command.mega?'Mega · ':''}${esc(move?.name||command.moveId)}${target?` → ${esc(target.name)}`:''}${command.switchToId?` · pivot → ${esc((snapshot.own||[]).find(mon=>mon.actorId===command.switchToId)?.name||command.switchToId)}`:''}`;
 }
 return esc(command.kind);
}

export class BattleCommandUiHandler{
 constructor({onChange=()=>{}}={}){this.onChange=onChange;this.phaseRevision=null;this.actorIndex=0;this.mode='COMMAND';this.draft=null;this.partyReason=null;this.partyReturnMode='COMMAND';this.logOpen=false;}
 reset(){this.phaseRevision=null;this.actorIndex=0;this.mode='COMMAND';this.draft=null;this.partyReason=null;this.partyReturnMode='COMMAND';this.logOpen=false;}
 sync(screen,view){
  const snapshot=view?.snapshot;if(!snapshot||snapshot.phase!=='COMMAND')return;
  if(this.phaseRevision!==snapshot.phaseRevision){this.phaseRevision=snapshot.phaseRevision;this.actorIndex=0;this.mode='COMMAND';this.draft=null;this.partyReason=null;this.partyReturnMode='COMMAND';screen.commands={};}
  const actors=activeOwn(snapshot);for(const mon of actors){const forced=forcedCommand(mon);if(forced)screen.commands[mon.actorId]=forced;}
  if(!actors.length){this.mode='REVIEW';return;}
  if(this.mode==='REVIEW'&&actors.every(mon=>screen.commands[mon.actorId]))return;
  if(!actors[this.actorIndex]||screen.commands[actors[this.actorIndex].actorId]){
   const next=actors.findIndex(mon=>!screen.commands[mon.actorId]);
   if(next<0){this.mode='REVIEW';this.actorIndex=Math.max(0,actors.length-1);this.draft=null;}else{this.actorIndex=next;this.mode='COMMAND';this.draft=null;}
  }
 }
 uiMode(view){if(view?.snapshot?.phase!=='COMMAND')return null;return commandModes[this.mode]||'BATTLE_COMMAND';}
 currentActor(view){return activeOwn(view?.snapshot)[this.actorIndex]||null;}
 currentActorId(view){return this.currentActor(view)?.actorId||null;}
 advance(screen,view){
  const actors=activeOwn(view.snapshot),next=actors.findIndex((mon,index)=>index>this.actorIndex&&!screen.commands[mon.actorId]),fallback=actors.findIndex(mon=>!screen.commands[mon.actorId]);
  if(next>=0||fallback>=0){this.actorIndex=next>=0?next:fallback;this.mode='COMMAND';this.draft=null;this.partyReason=null;}
  else{this.mode='REVIEW';this.draft=null;this.partyReason=null;}
  this.onChange();
 }
 complete(screen,view,command){screen.commands[command.actorId]=command;this.advance(screen,view);}
 beginEdit(screen,view,actorId){const actors=activeOwn(view.snapshot),index=actors.findIndex(mon=>mon.actorId===actorId);if(index<0)return false;delete screen.commands[actorId];this.actorIndex=index;this.mode='COMMAND';this.draft=null;this.partyReason=null;this.onChange();return true;}
 toggleLog(){this.logOpen=!this.logOpen;this.onChange();return true;}
 cancel(screen,view){
  if(!view?.snapshot||view.snapshot.phase!=='COMMAND')return false;
  if(this.mode==='MOVE'){this.mode='COMMAND';this.draft=null;this.onChange();return true;}
  if(this.mode==='TARGET'){this.mode='MOVE';this.onChange();return true;}
  if(this.mode==='PARTY'){this.mode=this.partyReturnMode||'COMMAND';if(this.partyReason==='switch')this.draft=null;this.onChange();return true;}
  if(this.mode==='REVIEW'){
   const actors=activeOwn(view.snapshot),last=[...actors].reverse().find(mon=>screen.commands[mon.actorId]&&!forcedCommand(mon));
   if(last)return this.beginEdit(screen,view,last.actorId);return false;
  }
  if(this.mode==='COMMAND'&&this.actorIndex>0){
   const actors=activeOwn(view.snapshot),previous=actors[this.actorIndex-1];if(previous&&!forcedCommand(previous))return this.beginEdit(screen,view,previous.actorId);
  }
  return false;
 }
 selectMove(screen,view,catalog,moveId){
  const snapshot=view.snapshot,mon=this.currentActor(view),move=moveById(catalog,moveId);if(!mon||!move)return false;
  const option=usableMoves(snapshot,mon,catalog).find(entry=>entry.move.id===moveId);if(!option||option.disabled)return false;
  const draft={kind:'move',actorId:mon.actorId,moveId:move.id,...(this.draft?.mega?{mega:true}:{})},mode=moveTargetMode(move,mon),targets=targetCandidates(snapshot,mon,move),needsPivot=!!move.actionProfile?.requiresPivotTarget;
  this.draft=draft;
  if(!automaticTargets.has(mode)){
   if(targets.length===1){draft.target={side:targets[0].side,slot:targets[0].slot};if(needsPivot){this.partyReason='pivot';this.partyReturnMode='MOVE';this.mode='PARTY';this.onChange();return true;}this.complete(screen,view,draft);return true;}
   this.mode='TARGET';this.onChange();return true;
  }
  if(needsPivot){this.partyReason='pivot';this.partyReturnMode='MOVE';this.mode='PARTY';this.onChange();return true;}
  this.complete(screen,view,draft);return true;
 }
 handleClick(screen,el,view,catalog){
  const action=el.dataset.v3Battle;if(!action?.startsWith('ui-'))return {handled:false};this.sync(screen,view);const mon=this.currentActor(view),snapshot=view.snapshot;
  if(action==='ui-fight'){if(!mon)return {handled:true};this.draft={actorId:mon.actorId,mega:false};this.mode='MOVE';this.onChange();return {handled:true};}
  if(action==='ui-party'){if(!mon)return {handled:true};this.draft={actorId:mon.actorId};this.partyReason='switch';this.partyReturnMode='COMMAND';this.mode='PARTY';this.onChange();return {handled:true};}
  if(action==='ui-log'){this.toggleLog();return {handled:true};}
  if(action==='ui-surrender')return {handled:true,effect:'surrender'};
  if(action==='ui-back'){this.cancel(screen,view);return {handled:true};}
  if(action==='ui-mega'){if(this.draft&&megaInfo(snapshot,mon,catalog)?.available){this.draft.mega=!this.draft.mega;this.onChange();}return {handled:true};}
  if(action==='ui-move'){this.selectMove(screen,view,catalog,el.dataset.moveId);return {handled:true};}
  if(action==='ui-target'){
   if(!this.draft)return {handled:true};this.draft.target={side:el.dataset.side,slot:Number(el.dataset.slot)};const move=moveById(catalog,this.draft.moveId);
   if(move?.actionProfile?.requiresPivotTarget){this.partyReason='pivot';this.partyReturnMode='TARGET';this.mode='PARTY';this.onChange();}else this.complete(screen,view,{...this.draft});return {handled:true};
  }
  if(action==='ui-reserve'){
   const actorId=el.dataset.reserveId;if(!actorId||el.disabled)return {handled:true};
   if(this.partyReason==='pivot'&&this.draft){this.draft.switchToId=actorId;this.complete(screen,view,{...this.draft});}
   else if(mon)this.complete(screen,view,{kind:'switch',actorId:mon.actorId,toId:actorId});return {handled:true};
  }
  if(action==='ui-edit'){this.beginEdit(screen,view,el.dataset.actorId);return {handled:true};}
  if(action==='ui-submit')return {handled:true,effect:'submit'};
  return {handled:true};
 }
 render(screen,view,catalog){
  this.sync(screen,view);const snapshot=view.snapshot,actors=activeOwn(snapshot),mon=this.currentActor(view);if(this.mode==='REVIEW')return this.renderReview(screen,view,catalog);
  if(!mon)return `<div class="pokemon-command-message"><strong>Waiting for battle state…</strong></div>`;
  const stepLabel=`${Math.min(this.actorIndex+1,actors.length)} / ${actors.length}`;
  if(this.mode==='MOVE')return this.renderMoves(screen,view,catalog,mon,stepLabel);
  if(this.mode==='TARGET')return this.renderTargets(screen,view,catalog,mon,stepLabel);
  if(this.mode==='PARTY')return this.renderParty(screen,view,catalog,mon,stepLabel);
  return this.renderCommand(screen,view,catalog,mon,stepLabel);
 }
 renderCommand(screen,view,catalog,mon,stepLabel){
  const snapshot=view.snapshot,moves=usableMoves(snapshot,mon,catalog),canFight=moves.some(entry=>!entry.disabled),choices=reserveChoices(screen,snapshot,mon.actorId),canSwitch=choices.some(entry=>!entry.disabled);
  return `<div class="pokemon-command-layout"><div class="pokemon-command-message"><small>COMMAND · ${stepLabel}</small><strong>What will ${esc(mon.name)} do?</strong><span>${view.mode==='double'?'Choose this Pokémon\'s action, then command its partner.':'Choose an action for this turn.'}</span></div><div class="pokemon-command-grid"><button data-ui-focusable data-ui-focus-id="cmd-fight-${mon.actorId}" data-ui-row="0" data-ui-col="0" data-v3-battle="ui-fight" ${canFight?'':'disabled'}><b>FIGHT</b><small>Choose a move</small></button><button data-ui-focusable data-ui-focus-id="cmd-party-${mon.actorId}" data-ui-row="0" data-ui-col="1" data-v3-battle="ui-party" ${canSwitch?'':'disabled'}><b>POKÉMON</b><small>Switch party member</small></button><button data-ui-focusable data-ui-focus-id="cmd-log-${mon.actorId}" data-ui-row="1" data-ui-col="0" data-v3-battle="ui-log"><b>LOG</b><small>${this.logOpen?'Hide':'Review'} battle history</small></button><button data-ui-focusable data-ui-focus-id="cmd-surrender-${mon.actorId}" data-ui-row="1" data-ui-col="1" data-v3-battle="ui-surrender" class="danger-command"><b>SURRENDER</b><small>Forfeit the match</small></button></div></div>`;
 }
 renderMoves(screen,view,catalog,mon,stepLabel){
  const snapshot=view.snapshot,options=usableMoves(snapshot,mon,catalog),mega=megaInfo(snapshot,mon,catalog),megaOn=this.draft?.mega===true;
  const buttons=options.map(({move,disabled},index)=>`<button class="pokemon-move-tile type-${esc(move.type)}" style="--move-type:${typeColors[move.type]||'#8ca0b8'}" data-ui-focusable data-ui-focus-id="move-${mon.actorId}-${move.id}" data-ui-row="${Math.floor(index/2)}" data-ui-col="${index%2}" data-v3-battle="ui-move" data-move-id="${move.id}" ${disabled?'disabled':''}><span class="move-type-dot"></span><b>${esc(move.name)}</b><small>${esc(move.type)} · ${esc(move.category)}</small><em>${move.power||'—'} PWR</em><span>${mon.pp?.[move.id]??0}/${move.maxPP} PP</span></button>`).join('');
  return `<div class="pokemon-command-layout move-select-layout"><div class="pokemon-command-message"><small>FIGHT · ${stepLabel}</small><strong>Choose ${esc(mon.name)}'s move.</strong><span>${choiceLockMove(snapshot,mon)?`Choice lock: ${esc(moveById(catalog,choiceLockMove(snapshot,mon))?.name||choiceLockMove(snapshot,mon))}`:'Type, category and PP are shown on each move.'}</span>${mega?`<button class="mega-command-toggle ${megaOn?'selected':''}" data-ui-focusable data-ui-focus-id="mega-${mon.actorId}" data-ui-row="2" data-ui-col="0" data-v3-battle="ui-mega" ${mega.available?'':'disabled'}><b>${megaOn?'✓ MEGA':'MEGA'}</b><small>${megaOn?'Evolution queued':'Evolve into '+esc(mega.form?.name||mega.relation.megaSpeciesId)}</small></button>`:''}<button class="command-back" data-ui-focusable data-ui-focus-id="back-moves-${mon.actorId}" data-ui-row="3" data-ui-col="0" data-v3-battle="ui-back">← Back</button></div><div class="pokemon-move-grid">${buttons}</div></div>`;
 }
 renderTargets(screen,view,catalog,mon,stepLabel){
  const move=moveById(catalog,this.draft?.moveId),targets=targetCandidates(view.snapshot,mon,move),buttons=targets.map((target,index)=>`<button class="pokemon-target-tile ${target.kind}" data-ui-focusable data-ui-focus-id="target-${target.side}-${target.slot}" data-ui-row="${Math.floor(index/2)}" data-ui-col="${index%2}" data-v3-battle="ui-target" data-side="${target.side}" data-slot="${target.slot}"><small>${target.kind==='foe'?'OPPONENT':'ALLY'} · SLOT ${target.slot+1}</small><b>${esc(target.name)}</b></button>`).join('');
  return `<div class="pokemon-command-layout"><div class="pokemon-command-message"><small>TARGET · ${stepLabel}</small><strong>${esc(move?.name||'Move')} — choose a target.</strong><span>Only legal adjacent targets are shown.</span><button class="command-back" data-ui-focusable data-ui-focus-id="back-target-${mon.actorId}" data-ui-row="9" data-ui-col="0" data-v3-battle="ui-back">← Back</button></div><div class="pokemon-target-grid">${buttons||'<p>No legal target.</p>'}</div></div>`;
 }
 renderParty(screen,view,catalog,mon,stepLabel){
  const choices=reserveChoices(screen,view.snapshot,mon.actorId),buttons=choices.map(({mon:reserve,disabled},index)=>`<button class="pokemon-party-tile" data-ui-focusable data-ui-focus-id="reserve-${reserve.actorId}" data-ui-row="${Math.floor(index/2)}" data-ui-col="${index%2}" data-v3-battle="ui-reserve" data-reserve-id="${reserve.actorId}" ${disabled?'disabled':''}><b>${esc(reserve.name)}</b><span class="party-hp"><i style="--hp:${percent(reserve)}%"></i></span><small>${Math.round(percent(reserve))}% HP${disabled?' · already selected':''}</small></button>`).join('');
  const verb=this.partyReason==='pivot'?'Choose who enters after the move.':`Switch ${esc(mon.name)} with which Pokémon?`;
  return `<div class="pokemon-command-layout"><div class="pokemon-command-message"><small>POKÉMON · ${stepLabel}</small><strong>${verb}</strong><span>${this.partyReason==='pivot'?'The move will resolve before the switch.':'Only healthy reserve Pokémon are available.'}</span><button class="command-back" data-ui-focusable data-ui-focus-id="back-party-${mon.actorId}" data-ui-row="9" data-ui-col="0" data-v3-battle="ui-back">← Back</button></div><div class="pokemon-party-grid">${buttons||'<p>No reserve Pokémon available.</p>'}</div></div>`;
 }
 renderReview(screen,view,catalog){
  const snapshot=view.snapshot,actors=activeOwn(snapshot),rows=actors.map((mon,index)=>`<button class="pokemon-review-row" data-ui-focusable data-ui-focus-id="review-${mon.actorId}" data-ui-row="${index}" data-ui-col="0" data-v3-battle="ui-edit" data-actor-id="${mon.actorId}"><span><small>SLOT ${mon.activeSlot+1}</small><b>${esc(mon.name)}</b></span><em>${commandSummary(screen.commands[mon.actorId],snapshot,catalog)}</em><strong>EDIT ›</strong></button>`).join('');
  return `<div class="pokemon-review-layout"><div class="pokemon-command-message"><small>READY · TURN ${snapshot.turn}</small><strong>Review your commands.</strong><span>Confirm when every active Pokémon has an action.</span></div><div class="pokemon-review-list">${rows}</div><div class="pokemon-review-actions"><button data-ui-focusable data-ui-focus-id="review-back" data-ui-row="90" data-ui-col="0" data-v3-battle="ui-back">← Edit last</button><button class="primary" data-ui-focusable data-ui-focus-id="review-submit" data-ui-row="90" data-ui-col="1" data-v3-battle="ui-submit">Confirm turn ${snapshot.turn} →</button></div></div>`;
 }
}

export {activeOwn,moveTargetMode,targetCandidates,usableMoves,megaInfo};
