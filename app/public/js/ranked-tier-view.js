import {imageAttributes} from './image-variants.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const FALLBACK={tier:'Poké Ball',tierAsset:'/ranks/pokeball.png',rating:0};

export function rankedTierEmblem(profile,{className='ranked-tier-emblem',decorative=false}={}){
 const ranked=profile||FALLBACK,src=ranked.tierAsset||FALLBACK.tierAsset,label=ranked.tier||FALLBACK.tier;
 return `<img class="${esc(className)}" ${imageAttributes(src,{lazy:false,size:104})} alt="${decorative?'':`${esc(label)} rank emblem`}" ${decorative?'aria-hidden="true"':''}>`;
}

export function rankedTierLine(profile){
 const ranked=profile||FALLBACK;
 return `${esc(ranked.tier||FALLBACK.tier)} · ${Number.isFinite(Number(ranked.rating))?Math.trunc(Number(ranked.rating)):0} RP`;
}

export function rankedTierNext(profile){
 if(!profile?.nextTier||!Number.isFinite(Number(profile?.nextTierRating)))return 'Highest Vanguard rank';
 return `Next: ${esc(profile.nextTier)} at ${Math.trunc(Number(profile.nextTierRating))} RP`;
}
