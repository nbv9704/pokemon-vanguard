const finiteRating=value=>Math.max(0,Number.isFinite(Number(value))?Math.trunc(Number(value)):1000);

export const RANKED_TIERS=Object.freeze([
 {id:'pokeball',name:'Poké Ball',minRating:0,maxRating:1199,asset:'/ranks/pokeball.png'},
 {id:'greatball',name:'Great Ball',minRating:1200,maxRating:1599,asset:'/ranks/greatball.png'},
 {id:'ultraball',name:'Ultra Ball',minRating:1600,maxRating:1999,asset:'/ranks/ultraball.png'},
 {id:'masterball',name:'Master Ball',minRating:2000,maxRating:2399,asset:'/ranks/masterball.png'},
 {id:'challenger',name:'Challenger',minRating:2400,maxRating:null,asset:'/ranks/challenger.png'}
]);

export function rankedTierInfo(rating){
 const value=finiteRating(rating);
 return RANKED_TIERS.findLast(tier=>value>=tier.minRating)||RANKED_TIERS[0];
}

export function rankedTier(rating){return rankedTierInfo(rating).name;}

export function rankedTierView(rating){
 const value=finiteRating(rating),tier=rankedTierInfo(value),index=RANKED_TIERS.indexOf(tier),next=RANKED_TIERS[index+1]||null;
 return {
  tierId:tier.id,
  tier:tier.name,
  tierAsset:tier.asset,
  tierMinRating:tier.minRating,
  tierMaxRating:tier.maxRating,
  nextTier:next?.name||null,
  nextTierRating:next?.minRating??null
 };
}
