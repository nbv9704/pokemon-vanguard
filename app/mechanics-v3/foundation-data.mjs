import {readFileSync} from 'node:fs';

const foundation=JSON.parse(readFileSync(new URL('../content-src/battle-foundation-v1.json',import.meta.url),'utf8'));
const clone=value=>structuredClone(value);

export function battleFoundation(){return clone(foundation);}
export function speciesFoundation(speciesId){const entry=foundation.species?.[speciesId];return entry?clone(entry):null;}
export function itemFoundation(itemId){const entry=foundation.items?.[itemId];return entry?clone(entry):null;}
export function canFlingItem(itemId){return foundation.items?.[itemId]?.fling?.usable===true&&Number.isInteger(foundation.items[itemId].fling.basePower)&&foundation.items[itemId].fling.basePower>0;}
export function flingItemMetadata(itemId){const entry=foundation.items?.[itemId]?.fling;return entry?clone(entry):null;}

export function effectiveWeightKg(unit,{ignoreAbility=false}={}){
 const base=Number(unit?.weightKg);if(!(base>0))return null;
 const reductionHg=Math.max(0,Number(unit?.volatiles?.['weight-reduction']?.reductionHg)||0);
 let weightHg=Math.max(1,Math.round(base*10)-Math.round(reductionHg));
 if(!ignoreAbility)for(const effect of unit?.passiveEffects||[]){if(effect?.sourceKind!=='ability'||effect.kind!=='weight-modifier')continue;weightHg=Math.max(1,Math.trunc(weightHg*effect.multiplier));}
 return weightHg/10;
}

function hash32(text){let value=2166136261;for(const ch of String(text)){value^=ch.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
export function deterministicBattleGender(speciesId,key='default'){
 const rate=foundation.species?.[speciesId]?.genderRate?.femaleEighths;
 if(rate===undefined||rate===null||rate<0)return 'genderless';
 if(rate===0)return 'male';if(rate>=8)return 'female';
 return hash32(`${speciesId}:${key}`)%8<rate?'female':'male';
}

export function hydrateSpeciesFoundation(species){
 const entry=foundation.species?.[species?.id];if(!entry)return species;
 return {...species,heightM:entry.heightM,weightKg:entry.weightKg,genderRate:clone(entry.genderRate)};
}
export function hydrateCatalogFoundation(lists){
 const next=structuredClone(lists);next.species=(next.species||[]).map(hydrateSpeciesFoundation);next.megaForms=(next.megaForms||[]).map(hydrateSpeciesFoundation);return next;
}
