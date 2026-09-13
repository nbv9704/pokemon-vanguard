const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export const V3_FX_TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

const OVERRIDES={
 'aerial-ace':'slash','brave-bird':'rush','bullet-seed':'barrage','charm':'aura','dragon-tail':'rush',
 'drain-punch':'drain-contact','draining-kiss':'drain','dual-wingbeat':'slash','eruption':'field-burst',
 'feint':'slash','flip-turn':'rush','giga-drain':'drain','gyro-ball':'rush','hard-press':'impact',
 'hex':'aura','leech-seed':'seed','protect':'barrier','quick-guard':'barrier','scale-shot':'barrage',
 'sing':'notes','spiky-shield':'barrier','stored-power':'beam','taunt':'notes','u-turn':'rush',
 'water-spout':'field-burst','wild-charge':'rush','will-o-wisp':'orb'
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

function outcomeOf(events){
 if(events.some(event=>event.kind==='moveMissed'))return 'miss';
 if(events.some(event=>['moveBlocked','protectionApplied','sideProtectionApplied'].includes(event.kind)))return 'blocked';
 if(events.some(event=>event.kind==='heal'))return events.some(event=>event.kind==='damage')?'drain':'heal';
 if(events.some(event=>['statusApplied','statStageChanged','volatileApplied'].includes(event.kind)))return 'status';
 if(events.some(event=>event.kind==='damage'))return 'hit';
 if(events.some(event=>['moveFailed','protectionFailed'].includes(event.kind)))return 'failed';
 return 'resolved';
}

function actorSide(actorId){return String(actorId||'').startsWith('B-')?'enemy':'own';}
function impactCount(events){const targets=new Set(events.filter(event=>event.targetId&&['damage','heal','moveMissed','moveBlocked','statusApplied','statStageChanged','volatileApplied'].includes(event.kind)).map(event=>event.targetId));return Math.max(1,Math.min(4,targets.size));}

export function renderV3BattleFx(playback,catalog){
 if(!playback)return '';
 const mega=playback.events?.find(event=>event.kind==='megaEvolved');
 if(mega)return `<div class="v3-mega-fx from-${actorSide(mega.actorId)}"><i></i><i></i><i></i><strong>MEGA EVOLUTION</strong></div>`;
 if(!['cast','impact'].includes(playback.stage)||!playback.moveId)return '';
 const move=catalog.moves.find(entry=>entry.id===playback.moveId),profile=moveFxProfile(move),outcome=playback.stage==='cast'?'pending':outcomeOf(playback.events||[]),count=playback.stage==='impact'?impactCount(playback.events||[]):1,primitives=PROFILE_PRIMITIVES[profile.id]||['orb','ring','spark'];
 const marks=Array.from({length:Math.max(primitives.length,count)},(_,index)=>`<i class="fx-${primitives[index%primitives.length]}" style="--fx-index:${index};--target-index:${index%count}"></i>`).join('');
 return `<div class="v3-move-fx from-${actorSide(playback.actorId)} stage-${playback.stage} outcome-${outcome}" data-fx-profile="${profile.id}" data-fx-source="${profile.source}" data-move-type="${profile.type}" data-target-count="${count}">${marks}<strong>${escapeHtml(move?.name||playback.moveId)}</strong><span>${escapeHtml(outcome==='pending'?'Cast':outcome)}</span></div>`;
}

export function v3MoveFxCoverage(moves=[]){return moves.map(move=>({moveId:move.id,...moveFxProfile(move)}));}
