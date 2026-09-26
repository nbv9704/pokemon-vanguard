import {MOVE_CATEGORY_SYMBOLS,POKEMON_TYPE_SYMBOLS} from './pokemon-symbol-assets-data.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normal=value=>String(value||'normal').trim().toLowerCase();
const title=value=>normal(value).replace(/(^|-)(\w)/g,(_,dash,char)=>`${dash?' ':''}${char.toUpperCase()}`);
export const pokemonTypeIds=Object.freeze(Object.keys(POKEMON_TYPE_SYMBOLS));
export const moveCategoryIds=Object.freeze(Object.keys(MOVE_CATEGORY_SYMBOLS));
export const pokemonSymbolSources=Object.freeze({types:POKEMON_TYPE_SYMBOLS,categories:MOVE_CATEGORY_SYMBOLS});
export function typeSymbolAsset(type,variant='icon'){
 const id=normal(type),entry=POKEMON_TYPE_SYMBOLS[id]||POKEMON_TYPE_SYMBOLS.normal,key=variant==='ic'?'ic':'icon';
 return {id,variant:key,local:`/assets/ui/pokemon-types/${key}/${entry[key]}`,fallback:`/api/ui-symbols/${key==='ic'?'type-ic':'type-icon'}/${id}`};
}
export function moveCategoryAsset(category){
 const id=normal(category),entry=MOVE_CATEGORY_SYMBOLS[id]||MOVE_CATEGORY_SYMBOLS.status;
 return {id,local:`/assets/ui/move-categories/${entry.file}`,fallback:`/api/ui-symbols/move-category/${id}`};
}
function fallbackAttrs(asset){return `src="${esc(asset.local)}" data-pv-fallback-src="${esc(asset.fallback)}"`;}
export function typeSymbolImg(type,{variant='icon',className='',alt=null}={}){
 const asset=typeSymbolAsset(type,variant),label=alt===null?`${title(asset.id)} type`:alt;
 return `<img class="pv-type-symbol pv-type-symbol-${asset.variant}${className?` ${esc(className)}`:''}" ${fallbackAttrs(asset)} alt="${esc(label)}">`;
}
export function moveCategoryImg(category,{className='',alt=null}={}){
 const asset=moveCategoryAsset(category),label=alt===null?`${title(asset.id)} move category`:alt;
 return `<img class="pv-move-category-symbol pv-move-category-${asset.id}${className?` ${esc(className)}`:''}" ${fallbackAttrs(asset)} alt="${esc(label)}">`;
}
export function typeStripList(types,{className=''}={}){
 const list=(types||[]).filter(Boolean);
 return `<div class="pv-type-strip-list${className?` ${esc(className)}`:''}">${list.map(type=>typeSymbolImg(type,{variant:'ic'})).join('')}</div>`;
}
if(typeof window!=='undefined'&&!window.__PV_SYMBOL_FALLBACK_BOUND__){
 window.__PV_SYMBOL_FALLBACK_BOUND__=true;
 window.addEventListener('error',event=>{
  const image=event.target,fallback=typeof HTMLImageElement!=='undefined'&&image instanceof HTMLImageElement?image.dataset.pvFallbackSrc:null;
  if(!fallback||image.dataset.pvFallbackUsed==='1')return;
  image.dataset.pvFallbackUsed='1';image.src=fallback;
 },true);
}
