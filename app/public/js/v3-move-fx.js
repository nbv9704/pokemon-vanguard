import {createMovePresentationPlan} from './presentation/move-presentation.js';
import {renderPresentationEffects} from './presentation/presentation-renderer.js';
import {moveFxProfile,V3_FX_TYPES,v3MoveFxCoverage} from './v3-move-fx-profile.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export {moveFxProfile,V3_FX_TYPES,v3MoveFxCoverage};

export function outcomeOf(events){
 if(events.some(event=>event.kind==='moveMissed'))return 'miss';
 if(events.some(event=>['moveBlocked','protectionApplied','sideProtectionApplied'].includes(event.kind)))return 'blocked';
 if(events.some(event=>event.kind==='damage'&&event.effectiveness===0))return 'immune';
 if(events.some(event=>event.kind==='heal'))return events.some(event=>event.kind==='damage')?'drain':'heal';
 if(events.some(event=>['statusApplied','statStageChanged','volatileApplied','delayedEffectScheduled','twoTurnMovePrepared','rechargeRequired'].includes(event.kind)))return 'status';
 if(events.some(event=>event.kind==='damage'))return 'hit';
 if(events.some(event=>['moveFailed','protectionFailed'].includes(event.kind)))return 'failed';
 return 'resolved';
}

function actorSide(actorId){return String(actorId||'').startsWith('B-')?'enemy':'own';}
function targetIdsFor(playback,move){
 if(playback.targetIds?.length)return playback.targetIds;
 const mode=move?.actionProfile?.targetMode;
 if(['self','userSide'].includes(mode))return [playback.actorId];
 if(['field','foeSide'].includes(mode))return ['field'];
 return [];
}

function targetOutcome(events,targetId){const targeted=events.filter(event=>event.targetId===targetId);return outcomeOf(targeted.length?targeted:events);}
function overallOutcome(events,outcomes){if(events.some(event=>event.kind==='heal')&&events.some(event=>event.kind==='damage'))return 'drain';return new Set(outcomes).size>1?'mixed':outcomes[0]||outcomeOf(events);}

export function renderV3BattleFx(playback,catalog){
 if(!playback)return '';
 const mega=playback.events?.find(event=>event.kind==='megaEvolved'),special=playback.presentation?.specialEvents?.length;
 if(!['cast','impact'].includes(playback.stage)||!playback.moveId){
  if(!special&&!mega)return '';
  const plan=playback.presentation,marks=renderPresentationEffects(playback,plan,[]),label=mega?'MEGA EVOLUTION':playback.events?.some(event=>event.kind==='transformed')?'TRANSFORM':playback.events?.some(event=>event.kind==='illusionBroken')?'ILLUSION BROKEN':playback.events?.some(event=>event.kind==='abilityFormChanged')?'FORM CHANGE':playback.events?.some(event=>event.kind==='twoTurnMovePrepared')?'VANISHED':playback.events?.some(event=>event.kind==='twoTurnMoveReleased')?'RETURNED':'BATTLE STATE';
  return `<div class="v3-move-fx presentation-runtime special-presentation from-${actorSide(playback.actorId||mega?.actorId)} stage-${escapeHtml(playback.stage||'system')}${playback.speed===2?' speed-2':''}" data-presentation-definition="${escapeHtml(plan?.id||'special-event')}" data-presentation-tier="${escapeHtml(plan?.tier||'special-event')}" data-presentation-template="${escapeHtml(plan?.template||'special-event')}">${marks}<strong>${escapeHtml(label)}</strong></div>`;
 }
 const move=catalog.moves.find(entry=>entry.id===playback.moveId),profile=moveFxProfile(move),events=playback.events||[],targetIds=targetIdsFor(playback,move),outcomes=(targetIds.length?targetIds:['field']).map(targetId=>playback.stage==='cast'?'pending':targetOutcome(events,targetId)),outcome=playback.stage==='cast'?'pending':overallOutcome(events,outcomes),plan=playback.presentation||createMovePresentationPlan({...playback,targetIds},catalog),marks=renderPresentationEffects({...playback,targetIds},plan,outcomes);
 return `<div class="v3-move-fx presentation-runtime from-${actorSide(playback.actorId)} stage-${playback.stage} outcome-${outcome}${playback.speed===2?' speed-2':''}" data-presentation-definition="${escapeHtml(plan?.id||'legacy')}" data-presentation-tier="${escapeHtml(plan?.tier||'legacy-adapter')}" data-presentation-template="${escapeHtml(plan?.template||'legacy')}" data-fx-profile="${profile.id}" data-fx-source="${profile.source}" data-move-type="${profile.type}" data-target-count="${targetIds.length||1}">${marks}<strong>${escapeHtml(move?.name||playback.moveId)}</strong><span>${escapeHtml(outcome==='pending'?'Cast':outcome)}</span></div>`;
}
