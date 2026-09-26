import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../content-src/champions-item-acquisition.json',import.meta.url),'utf8'));
const beginning=new Set(config.beginningItemIds||[]),premium=new Set(config.heldItemPrice1000Ids||[]),tutorial=new Set(config.megaTutorialItemIds||[]),depositOnly=new Set(config.depositOnlyItemIds||[]);
export const V3_ITEM_ACQUISITION_SOURCE=config.source;
export const V3_BEGINNING_ITEM_IDS=Object.freeze([...(config.beginningItemIds||[])]);
export const V3_STARTER_HELD_ITEM_IDS=Object.freeze(['leftovers','white-herb','choice-scarf','kings-rock','lum-berry','sitrus-berry']);

export function v3ItemAcquisition(item){
 if(!item)return null;
 if(beginning.has(item.id))return {kind:'beginning',priceCoins:0,label:'Beginning'};
 if(tutorial.has(item.id))return {kind:'mega-tutorial',priceCoins:null,label:'Mega Evolution Tutorial'};
 if(depositOnly.has(item.id))return {kind:'deposit',priceCoins:null,label:'Pokémon Legends: Z-A Deposit'};
 const base=config.defaultShopPrices?.[item.category];if(!Number.isInteger(base))return {kind:'unavailable',priceCoins:null,label:'Unavailable'};
 return {kind:'shop',priceCoins:premium.has(item.id)?1000:base,label:'Shop'};
}

export function validateV3ItemAcquisitionCatalog(catalog){
 const problems=[],ids=new Set(catalog.items.map(item=>item.id));
 for(const id of [...beginning,...premium,...tutorial,...depositOnly])if(!ids.has(id))problems.push(`item acquisition references missing active item: ${id}`);
 for(const item of catalog.items){const acquisition=v3ItemAcquisition(item);if(!acquisition||acquisition.kind==='unavailable')problems.push(`active item has no acquisition source: ${item.id}`);}
 return problems;
}
