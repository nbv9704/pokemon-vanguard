import {imageAttributes} from './image-variants.js';
// One source of truth for assets that are actually present in public/.
// Display mapping only: registering an image must never grant a ticket or a loot box.
export const UI_ICONS=Object.freeze({
 vp:'/assets/icons/vp.png',
 pokegem:'/assets/icons/pokegem.png',
 bag:'/assets/icons/bag.png',
});
export const TICKET_ASSETS=Object.freeze({
 training:'/assets/items/training_ticket.png',
 recruitment:'/assets/items/recruit_ticket.png',
 rank:'/assets/items/rank_ticket.png',
 shop:'/assets/items/shop_ticket.png',
});
export const RANK_BOX_ASSETS=Object.freeze({
 pokeball:'/assets/items/pokeball_box.png',
 greatball:'/assets/items/greatball_box.png',
 ultraball:'/assets/items/ultraball_box.png',
 masterball:'/assets/items/masterball_box.png',
 challenger:'/assets/items/challenger_box.png',
});
const DISPLAY_ASSETS=Object.freeze({...UI_ICONS,recruitmentTicket:TICKET_ASSETS.recruitment,shopTicket:TICKET_ASSETS.shop,trainingTicket:TICKET_ASSETS.training,rankTicket:TICKET_ASSETS.rank});
export function rewardAsset(kind){return DISPLAY_ASSETS[kind]||null;}
export function rankBoxAsset(rank){return RANK_BOX_ASSETS[String(rank||'').toLowerCase()]||null;}
export function rewardIcon(kind,className=''){
 const src=rewardAsset(kind);if(!src)return '';
 const safeClass=String(className).trim().split(/\s+/).filter(token=>/^[a-zA-Z][\w-]*$/.test(token)).join(' ');
 return `<img class="reward-asset-icon${safeClass?' '+safeClass:''}" ${imageAttributes(src,{lazy:false})} alt="" aria-hidden="true">`;
}
