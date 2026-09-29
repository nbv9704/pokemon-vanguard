import {MOVE_CATEGORY_SYMBOLS,POKEMON_TYPE_SYMBOLS} from './pokemon-symbol-assets-data.js';
import {assetUrl} from '../asset-runtime.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normal=value=>String(value||'normal').trim().toLowerCase();
const title=value=>normal(value).replace(/(^|-)(\w)/g,(_,dash,char)=>`${dash?' ':''}${char.toUpperCase()}`);
export const pokemonTypeIds=Object.freeze(Object.keys(POKEMON_TYPE_SYMBOLS));
export const moveCategoryIds=Object.freeze(Object.keys(MOVE_CATEGORY_SYMBOLS));
export const pokemonSymbolSources=Object.freeze({types:POKEMON_TYPE_SYMBOLS,categories:MOVE_CATEGORY_SYMBOLS});
export function typeSymbolAsset(type,variant='icon'){
 const id=normal(type),entry=POKEMON_TYPE_SYMBOLS[id]||POKEMON_TYPE_SYMBOLS.normal,key=variant==='ic'?'ic':'icon';
 return {id,variant:key,local:assetUrl(`/assets/ui/pokemon-types/${key}/${entry[key]}`)};
}
export function moveCategoryAsset(category){
 const id=normal(category),entry=MOVE_CATEGORY_SYMBOLS[id]||MOVE_CATEGORY_SYMBOLS.status;
 return {id,local:assetUrl(`/assets/ui/move-categories/${entry.file}`)};
}
function fallbackAttrs(asset,{label,short}){return `src="${esc(asset.local)}" data-pv-symbol-label="${esc(label)}" data-pv-symbol-short="${esc(short)}"`;}
export function typeSymbolImg(type,{variant='icon',className='',alt=null}={}){
 const asset=typeSymbolAsset(type,variant),label=alt===null?`${title(asset.id)} type`:alt;
 return `<img class="pv-type-symbol pv-type-symbol-${asset.variant}${className?` ${esc(className)}`:''}" ${fallbackAttrs(asset,{label:`${title(asset.id)} type`,short:asset.variant==='ic'?asset.id.toUpperCase():asset.id.slice(0,2).toUpperCase()})} alt="${esc(label)}">`;
}
export function moveCategoryImg(category,{className='',alt=null}={}){
 const asset=moveCategoryAsset(category),label=alt===null?`${title(asset.id)} move category`:alt;
 return `<img class="pv-move-category-symbol pv-move-category-${asset.id}${className?` ${esc(className)}`:''}" ${fallbackAttrs(asset,{label:`${title(asset.id)} move category`,short:asset.id[0].toUpperCase()})} alt="${esc(label)}">`;
}
export function typeStripList(types,{className=''}={}){
 const list=(types||[]).filter(Boolean);
 return `<div class="pv-type-strip-list${className?` ${esc(className)}`:''}">${list.map(type=>typeSymbolImg(type,{variant:'ic'})).join('')}</div>`;
}
/** Retain visible semantics while optional project-owned art is being supplied. */
export function recoverPokemonSymbolImage(image,{documentRef=typeof document!=='undefined'?document:null}={}){
 if(!documentRef||!image?.replaceWith||!image.dataset?.pvSymbolLabel)return false;
 const fallback=documentRef.createElement('span');
 fallback.className=`${image.className} pv-symbol-text-fallback`;
 fallback.textContent=image.dataset.pvSymbolShort||image.dataset.pvSymbolLabel;
 fallback.title=image.dataset.pvSymbolLabel;
 if(image.alt==='')fallback.setAttribute('aria-hidden','true');
 else{fallback.setAttribute('role','img');fallback.setAttribute('aria-label',image.dataset.pvSymbolLabel);}
 image.replaceWith(fallback);
 return 'text';
}
if(typeof window!=='undefined'&&!window.__PV_SYMBOL_FALLBACK_BOUND__){
 window.__PV_SYMBOL_FALLBACK_BOUND__=true;
 window.addEventListener('error',event=>{
  const image=event.target;
  if(typeof HTMLImageElement!=='undefined'&&image instanceof HTMLImageElement)recoverPokemonSymbolImage(image);
 },true);
}
