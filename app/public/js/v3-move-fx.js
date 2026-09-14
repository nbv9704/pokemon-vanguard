import {sceneTracks,sceneTrackStyle} from './v3-scene-anchors.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export const V3_FX_TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

const OVERRIDES={
 'aerial-ace':'slash','brave-bird':'rush','bullet-seed':'barrage','charm':'aura','dragon-tail':'rush',
 'drain-punch':'drain-contact','draining-kiss':'drain','dual-wingbeat':'slash','eruption':'field-burst',
 'feint':'slash','flip-turn':'rush','giga-drain':'drain','gyro-ball':'rush','hard-press':'impact',
 'hex':'aura','leech-seed':'seed','protect':'barrier','quick-guard':'barrier','scale-shot':'barrage',
 'sing':'notes','yawn':'notes','perish-song':'notes','hyper-voice':'notes','waterfall':'rush','crunch':'rush','liquidation':'rush','ice-punch':'impact','body-slam':'impact','rock-slide':'field-burst','water-pulse':'orb','ice-fang':'rush','bulldoze':'field-burst','dig':'rush','fly':'rush','dive':'rush','phantom-force':'aura','solar-beam':'beam','solar-blade':'slash','hydro-cannon':'beam','frenzy-plant':'impact','blast-burn':'field-burst','hyper-beam':'beam','giga-impact':'rush','spiky-shield':'barrier','stored-power':'beam','taunt':'notes','u-turn':'rush',
 'defog':'field-burst','magic-room':'field-burst','trick-room':'field-burst','wonder-room':'field-burst','electric-terrain':'field-burst','grassy-terrain':'field-burst','light-screen':'barrier','misty-terrain':'field-burst','psychic-terrain':'field-burst','spikes':'field-burst','toxic-spikes':'field-burst','stealth-rock':'field-burst','rain-dance':'field-burst','rapid-spin':'rush','reflect':'barrier','sunny-day':'field-burst','tailwind':'field-burst','water-spout':'field-burst','wild-charge':'rush','will-o-wisp':'orb'
};

const SELF_TARGETS=new Set(['self','userSide','field','foeSide']);
const PROFILE_PRIMITIVES={
 projectile:['orb','trail','trail'],beam:['beam','ring','spark'],slash:['slash','slash','spark'],rush:['rush','ring','spark'],
 barrage:['pellet','pellet','pellet'],impact:['ring','burst','spark'],aura:['ring','ring','spark'],barrier:['shield','shield','spark'],
 drain:['orb','orb','trail'],'drain-contact':['rush','orb','trail'],seed:['seed','vine','spark'],notes:['note','note','ring'],
 'field-burst':['wave','burst','spark']
};

export function moveFxProfile(move){
 if(!move)return {id:'minimal',source:'fallback',type:'normal'};
 const override=OVERRIDES[move.id];
 if(override)return {id:override,source:'override',type:move.type||'normal'};
 if(move.category==='status')return {id:SELF_TARGETS.has(move.actionProfile?.targetMode)?'aura':'orb',source:'category-fallback',type:move.type||'normal'};
 return {id:move.category==='physical'?'impact':'projectile',source:'category-fallback',type:move.type||'normal'};
}

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
 const mega=playback.events?.find(event=>event.kind==='megaEvolved');
 if(mega)return `<div class="v3-mega-fx from-${actorSide(mega.actorId)}${playback.speed===2?' speed-2':''}"><i></i><i></i><i></i><strong>MEGA EVOLUTION</strong></div>`;
 if(!['cast','impact'].includes(playback.stage)||!playback.moveId)return '';
 const move=catalog.moves.find(entry=>entry.id===playback.moveId),profile=moveFxProfile(move),events=playback.events||[],tracks=sceneTracks(playback.snapshot||{},playback.actorId,targetIdsFor(playback,move)),primitives=PROFILE_PRIMITIVES[profile.id]||['orb','ring','spark'];
 const outcomes=tracks.map(track=>playback.stage==='cast'?'pending':targetOutcome(events,track.targetId)),outcome=playback.stage==='cast'?'pending':overallOutcome(events,outcomes);
 const marks=tracks.flatMap((track,targetIndex)=>primitives.map((primitive,index)=>`<i class="fx-${primitive} fx-outcome-${outcomes[targetIndex]}" data-fx-target="${escapeHtml(track.targetId)}" style="${sceneTrackStyle(track)};--fx-index:${index};--target-index:${targetIndex}"></i>`)).join('');
 return `<div class="v3-move-fx from-${actorSide(playback.actorId)} stage-${playback.stage} outcome-${outcome}${playback.speed===2?' speed-2':''}" data-fx-profile="${profile.id}" data-fx-source="${profile.source}" data-move-type="${profile.type}" data-target-count="${tracks.length}">${marks}<strong>${escapeHtml(move?.name||playback.moveId)}</strong><span>${escapeHtml(outcome==='pending'?'Cast':outcome)}</span></div>`;
}

export function v3MoveFxCoverage(moves=[]){return moves.map(move=>({moveId:move.id,...moveFxProfile(move)}));}
