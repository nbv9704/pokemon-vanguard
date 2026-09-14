const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const automaticTargets=new Set(['self','userSide','field','allAdjacentFoes','allAdjacent','foeSide']);
const activeOwn=snapshot=>snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp>0).sort((a,b)=>a.activeSlot-b.activeSlot);
const reserves=snapshot=>snapshot.own.filter(mon=>mon.activeSlot<0&&mon.hp>0);
const choiceLockMove=(snapshot,mon)=>snapshot.field?.rooms?.['magic-room']?null:mon.volatiles?.['choice-lock']?.moveId||null;

function defaultMove(screen,snapshot,mon,catalog,index){
 const recharge=mon.volatiles?.['must-recharge'],charge=mon.volatiles?.['two-turn-move'];
 if(recharge){screen.commands[mon.actorId]={kind:'recharge',actorId:mon.actorId};return;}
 if(charge){screen.commands[mon.actorId]={kind:'move',actorId:mon.actorId,moveId:charge.moveId,...(charge.target?{target:charge.target}:{})};return;}
 const available=reserves(snapshot),reserveIds=new Set(available.map(entry=>entry.actorId)),locked=choiceLockMove(snapshot,mon),existing=screen.commands[mon.actorId],existingMove=existing?.kind==='move'&&catalog.moves.find(entry=>entry.id===existing.moveId),automatic=existingMove&&automaticTargets.has(existingMove.actionProfile.targetMode),targetAlive=automatic||snapshot.opponent.some(entry=>entry.activeSlot===existing?.target?.slot&&entry.hpPercent>0);
 if(existing?.kind==='switch'&&!reserveIds.has(existing.toId))delete screen.commands[mon.actorId];
 else if(existingMove&&((mon.pp[existingMove.id]||0)<=0||locked&&existingMove.id!==locked||!targetAlive||existingMove.actionProfile.requiresPivotTarget&&!reserveIds.has(existing.switchToId)))delete screen.commands[mon.actorId];
 else if(existing)return;
 const candidates=mon.buildSnapshot.moveIds.map(id=>catalog.moves.find(entry=>entry.id===id)).filter(move=>move&&(mon.pp[move.id]||0)>0&&(!locked||move.id===locked)),move=candidates.find(entry=>!entry.actionProfile.requiresPivotTarget)||candidates[0];
 if(!move){const reserve=available[index]||available[0];if(reserve)screen.commands[mon.actorId]={kind:'switch',actorId:mon.actorId,toId:reserve.actorId};else delete screen.commands[mon.actorId];return;}
 const target=automaticTargets.has(move.actionProfile.targetMode)?undefined:{side:'B',slot:snapshot.opponent.find(entry=>entry.activeSlot>=0&&entry.hpPercent>0)?.activeSlot||0};
 screen.commands[mon.actorId]={kind:'move',actorId:mon.actorId,moveId:move.id,...(target?{target}:{}),...(move.actionProfile.requiresPivotTarget&&available[index]?{switchToId:available[index].actorId}:{})};
}

function moveCards(mon,command,catalog,snapshot){
 const locked=choiceLockMove(snapshot,mon);
 return mon.buildSnapshot.moveIds.map(id=>{
  const move=catalog.moves.find(entry=>entry.id===id),selected=command.kind==='move'&&command.moveId===id;
  return `<button data-v3-battle="move" data-actor-id="${mon.actorId}" data-move-id="${id}" class="${selected?'selected':''}" ${mon.pp[id]<=0||locked&&id!==locked?'disabled':''}><b>${esc(move.name)}</b><small>${move.type} · ${move.category} · ${move.power||'—'} power</small><small>${mon.pp[id]}/${move.maxPP} PP · ${move.actionProfile.targetMode}</small></button>`;
 }).join('');
}

function megaChoice(mon,command,snapshot,catalog){
 const relation=catalog.megaRelations?.find(entry=>entry.baseSpeciesId===(mon.baseSpeciesId||mon.speciesId)&&entry.itemId===mon.buildSnapshot.itemId);if(!relation)return '';
 const form=catalog.megaForms?.find(entry=>entry.id===relation.megaSpeciesId),available=!mon.megaEvolved&&(snapshot.megaUsed?.A||0)<(snapshot.megaLimit||0)&&command.kind==='move';
 return `<label class="v3-mega-choice"><input type="checkbox" data-v3-mega="${mon.actorId}" ${command.mega?'checked':''} ${available?'':'disabled'}> Mega Evolve into ${esc(form?.name||relation.megaSpeciesId)}</label>`;
}

function commandPanel(screen,snapshot,mon,catalog,index){
 defaultMove(screen,snapshot,mon,catalog,index);const command=screen.commands[mon.actorId]||{kind:'none'},recharge=mon.volatiles?.['must-recharge'],charge=mon.volatiles?.['two-turn-move'];
 if(recharge)return `<section class="panel v3-forced-action"><h3>${esc(mon.name)} — recharging</h3><p>${esc(catalog.moves.find(entry=>entry.id===recharge.moveId)?.name||recharge.moveId)} requires this turn to recharge. No move or switch can be selected.</p></section>`;
 if(charge){const move=catalog.moves.find(entry=>entry.id===charge.moveId);return `<section class="panel v3-forced-action"><h3>${esc(mon.name)} — committed action</h3><p>${esc(move?.name||charge.moveId)} finishes charging and attacks this turn. The original target slot stays locked.</p></section>`;}
 const foes=snapshot.opponent.filter(entry=>entry.activeSlot>=0&&entry.hpPercent>0),targetOptions=foes.map(foe=>`<option value="${foe.activeSlot}">${esc(foe.name)} · slot ${foe.activeSlot+1}</option>`).join(''),reserveOptions=reserves(snapshot).map(entry=>`<option value="${entry.actorId}">${esc(entry.name)} · ${Math.round(entry.hp/entry.maxHp*100)}%</option>`).join('');
 return `<section class="panel"><h3>${esc(mon.name)} — choose an action</h3><div class="v2-moves">${moveCards(mon,command,catalog,snapshot)}</div>${megaChoice(mon,command,snapshot,catalog)}<label>Target<select data-v3-target="${mon.actorId}" ${command.kind==='switch'?'disabled':''}>${targetOptions}</select></label><label>Switch Mon<select data-v3-switch="${mon.actorId}"><option value="">Use selected move</option>${reserveOptions}</select></label></section>`;
}

export function renderV3Commands(screen,view,catalog){
 const snapshot=view.snapshot,panels=activeOwn(snapshot).map((mon,index)=>commandPanel(screen,snapshot,mon,catalog,index)).join('');
 return `<div class="v2-command-grid">${panels}</div><button class="primary v2-submit" data-v3-battle="submit">Confirm turn ${snapshot.turn}</button>`;
}

export function renderV3Replacements(screen,view){
 const snapshot=view.snapshot;if(screen.replacementRevision!==snapshot.phaseRevision){screen.replacementRevision=snapshot.phaseRevision;screen.replacements={};}
 const slots=snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp<=0).map(mon=>mon.activeSlot),active=new Set(snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp>0).map(mon=>mon.actorId)),available=snapshot.own.filter(mon=>mon.hp>0&&!active.has(mon.actorId)),chosen=Object.values(screen.replacements).filter(Boolean),ready=chosen.length===Math.min(slots.length,available.length)&&new Set(chosen).size===chosen.length;
 const selectors=slots.map(slot=>`<label>Slot ${slot+1}<select data-v3-replacement="${slot}"><option value="">Choose reserve</option>${available.map(mon=>`<option value="${mon.actorId}" ${screen.replacements[slot]===mon.actorId?'selected':''}>${esc(mon.name)}</option>`).join('')}</select></label>`).join('');
 return `<section class="panel replacement-panel"><h2>Choose replacement Mon</h2>${selectors}<button class="primary" data-v3-battle="replace" ${ready?'':'disabled'}>Send Mon into battle</button></section>`;
}
