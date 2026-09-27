// Consumable tickets are account-owned items, independent of permanent battle held items.
// Recruitment ticket balance retains its legacy wallet backing for old saves, missions and mail.
export const TICKET_ITEMS=Object.freeze([
 Object.freeze({id:'recruitment',field:'recruitmentTickets',name:'Recruitment Ticket',image:'/assets/items/recruit_ticket.png',description:'Recruit one Pokémon permanently from the current Recruitment lineup.'}),
 Object.freeze({id:'shop',field:'shopTickets',name:'Shop Ticket',image:'/assets/items/shop_ticket.png',description:'Unlock any one item offered for sale in the Shop without spending VP.'}),
 Object.freeze({id:'training',field:'trainingTickets',name:'Training Ticket',image:'/assets/items/training_ticket.png',description:'Pay the entire cost of one Pokémon training session, regardless of price.'}),
 Object.freeze({id:'rank',field:'rankTickets',name:'Rank Ticket',image:'/assets/items/rank_ticket.png',description:'Arm protection for your next Ranked loss; the ticket is spent only when it prevents RP loss.'})
]);
const bagKeys=['shopTickets','trainingTickets','rankTickets'];
const normalize=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function ensureTicketBag(state){
 if(!state.ticketBagV1||typeof state.ticketBagV1!=='object')state.ticketBagV1={};
 const bag=state.ticketBagV1;bag.version=1;for(const key of bagKeys)bag[key]=normalize(bag[key]);
 bag.rankProtectionArmed=!!bag.rankProtectionArmed&&bag.rankTickets>0;return bag;
}
export function ticketCount(state,id){
 if(id==='recruitment')return normalize(state.wallet?.recruitmentTickets??state.recruitmentTickets);
 const item=TICKET_ITEMS.find(entry=>entry.id===id);return item?ensureTicketBag(state)[item.field]:0;
}
export function ticketBagView(state,catalog){
 const holder=structuredClone(state),bag=ensureTicketBag(holder),owned=new Set(holder.progressionV3?.ownedItemIds||[]);
 return {version:1,tickets:TICKET_ITEMS.map(item=>({id:item.id,name:item.name,image:item.image,description:item.description,count:ticketCount(holder,item.id),armed:item.id==='rank'&&bag.rankProtectionArmed})),heldItems:(catalog?.items||[]).filter(item=>owned.has(item.id)).map(item=>({id:item.id,name:item.name,description:item.description,category:item.category})),rankProtectionArmed:bag.rankProtectionArmed};
}
export function applyBagAction(state,action){
 if(action?.type!=='bagV1.rankProtection')return {ok:false,code:'UNKNOWN_BAG_ACTION'};
 if(typeof action.enabled!=='boolean')return {ok:false,code:'INVALID_PROTECTION_STATE'};
 const next=structuredClone(state),bag=ensureTicketBag(next);
 if(action.enabled&&bag.rankTickets<1)return {ok:false,code:'INSUFFICIENT_RANK_TICKETS'};
 bag.rankProtectionArmed=action.enabled;next.revision=(next.revision||0)+1;
 next.notice=action.enabled?'Rank protection armed for your next Ranked loss.':'Rank protection disabled.';
 return {ok:true,state:next};
}
