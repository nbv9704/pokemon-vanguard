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

export const PROFILE_PRIMITIVES={
 projectile:['orb','trail','trail'],beam:['beam','ring','spark'],slash:['slash','slash','spark'],rush:['rush','ring','spark'],
 barrage:['pellet','pellet','pellet'],impact:['ring','burst','spark'],aura:['ring','ring','spark'],barrier:['shield','shield','spark'],
 drain:['orb','orb','trail'],'drain-contact':['rush','orb','trail'],seed:['seed','vine','spark'],notes:['note','note','ring'],orb:['orb','ring','spark'],
 'field-burst':['wave','burst','spark']
};

export function moveFxProfile(move){
 if(!move)return {id:'minimal',source:'fallback',type:'normal'};
 const override=OVERRIDES[move.id];
 if(override)return {id:override,source:'override',type:move.type||'normal'};
 if(move.category==='status')return {id:SELF_TARGETS.has(move.actionProfile?.targetMode)?'aura':'orb',source:'category-fallback',type:move.type||'normal'};
 return {id:move.category==='physical'?'impact':'projectile',source:'category-fallback',type:move.type||'normal'};
}

export function v3MoveFxCoverage(moves=[]){return moves.map(move=>({moveId:move.id,...moveFxProfile(move)}));}
