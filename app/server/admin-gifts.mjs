import {randomUUID} from 'node:crypto';
import {applyEconomyTransaction,ensureEconomyState} from './v2-economy-ledger.mjs';
import {ensureV3ItemInventory} from './v3-item-shop.mjs';
import {grantPokemonToProgression} from './admin-progression-grants.mjs';
import {MAIL_RETENTION_PRESETS,isMailExpired,mailExpiry,normalizeAdminMailLifecycle} from './mailbox-v1.mjs';

const clone=value=>structuredClone(value);
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
const amount=(value,max=1_000_000_000)=>Math.min(max,Math.max(0,Math.trunc(Number(value)||0)));
const DAY=24*60*60*1000;
const retentionMs=(days,fallback)=>{const value=Number(days);return Number.isFinite(value)&&value>0?Math.min(365,Math.max(1/24,value))*DAY:fallback;};
export const isAdminGiftAction=action=>action?.type==='adminGift.claim';

export function ensureAdminGiftState(state){
 if(!state.adminGiftsV1||typeof state.adminGiftsV1!=='object')state.adminGiftsV1={version:1,inbox:[]};
 state.adminGiftsV1.version=1;if(!Array.isArray(state.adminGiftsV1.inbox))state.adminGiftsV1.inbox=[];return state.adminGiftsV1;
}

export function normalizeGiftDraft(input,catalog,{campaignId=randomUUID(),sentBy='admin',sentAt=Date.now()}={}){
 const itemIds=[...new Set((Array.isArray(input?.itemIds)?input.itemIds:[]).map(String))].slice(0,20),speciesIds=[...new Set((Array.isArray(input?.speciesIds)?input.speciesIds:[]).map(String))].slice(0,10);
 if(itemIds.some(id=>!catalog.itemsById[id]?.enabledForBattle))return {ok:false,code:'GIFT_ITEM_NOT_FOUND'};
 if(speciesIds.some(id=>!catalog.speciesById[id]?.enabledForBattle))return {ok:false,code:'GIFT_POKEMON_NOT_FOUND'};
 const preset=MAIL_RETENTION_PRESETS[input?.mailType]||MAIL_RETENTION_PRESETS.standard,gift={giftId:String(campaignId),title:clean(input?.title,80)||'A gift from Vanguard League',message:clean(input?.message,500),sentAt:Number(sentAt),sentBy:clean(sentBy,128)||'admin',mailType:preset.id,unreadTtlMs:retentionMs(input?.unreadDays,preset.unreadTtlMs),readTtlMs:retentionMs(input?.readDays,preset.readTtlMs),readAt:null,reward:{coins:amount(input?.coins),crystals:amount(input?.crystals),recruitmentTickets:amount(input?.recruitmentTickets,1_000_000),shopTickets:amount(input?.shopTickets,1_000_000),trainingTickets:amount(input?.trainingTickets,1_000_000),rankTickets:amount(input?.rankTickets,1_000_000)},itemIds,speciesIds};
 const hasReward=Object.values(gift.reward).some(Boolean)||itemIds.length||speciesIds.length;if(!hasReward)return {ok:false,code:'GIFT_EMPTY'};return {ok:true,gift};
}

export function enqueueAdminGift(state,gift){
 let inbox=ensureAdminGiftState(state).inbox;const now=Number(gift.sentAt)||Date.now();inbox=inbox.filter(entry=>{normalizeAdminMailLifecycle(entry);return !isMailExpired({sentAt:entry.sentAt,readAt:entry.readAt,unreadTtlMs:entry.unreadTtlMs,readTtlMs:entry.readTtlMs},now);});if(inbox.some(entry=>entry.giftId===gift.giftId))return {ok:true,duplicate:true};
 const entry={...clone(gift),claimedAt:null};normalizeAdminMailLifecycle(entry);inbox.unshift(entry);const pending=inbox.filter(item=>!item.claimedAt),claimed=inbox.filter(item=>item.claimedAt);state.adminGiftsV1.inbox=[...pending.slice(0,50),...claimed.slice(0,50)].slice(0,100);state.revision=(state.revision||0)+1;return {ok:true};
}

export function adminGiftView(state,catalog,{now=Date.now()}={}){
 const inbox=ensureAdminGiftState(state).inbox.flatMap(raw=>{const gift=clone(raw);normalizeAdminMailLifecycle(gift);const expiry=mailExpiry({sentAt:gift.sentAt,readAt:gift.readAt,unreadTtlMs:gift.unreadTtlMs,readTtlMs:gift.readTtlMs});if(now>=expiry.expiresAt)return [];const {sentBy:_privateSentBy,...publicGift}=gift;return [{...publicGift,...expiry,unread:gift.readAt===null,items:gift.itemIds.map(id=>({id,name:catalog.itemsById[id]?.name||id})),pokemon:gift.speciesIds.map(id=>({id,name:catalog.speciesById[id]?.name||id})),claimable:!gift.claimedAt}];});
 return {version:1,pendingCount:inbox.filter(entry=>entry.claimable).length,unreadCount:inbox.filter(entry=>entry.unread).length,gifts:inbox};
}

export function applyAdminGiftAction(state,action,catalog,{now=Date.now()}={}){
 if(!isAdminGiftAction(action))return {ok:false,code:'UNKNOWN_ADMIN_GIFT_ACTION'};const base=clone(state),giftState=ensureAdminGiftState(base),gift=giftState.inbox.find(entry=>entry.giftId===String(action.giftId||''));if(!gift)return {ok:false,code:'GIFT_NOT_FOUND'};normalizeAdminMailLifecycle(gift);if(isMailExpired({sentAt:gift.sentAt,readAt:gift.readAt,unreadTtlMs:gift.unreadTtlMs,readTtlMs:gift.readTtlMs},now))return {ok:false,code:'GIFT_EXPIRED'};if(gift.claimedAt)return {ok:true,state:base,duplicate:true};
 if(!base.progressionV3)return {ok:false,code:'SCHEMA_V3_NOT_READY'};ensureEconomyState(base);ensureV3ItemInventory(base.progressionV3,catalog);
 const receiptId=`admin-gift:${String(base.owner||'player').slice(0,80)}:${gift.giftId}`,tx=applyEconomyTransaction(base,{receiptId,actionId:action.actionId||null,kind:'admin-gift',delta:gift.reward,details:{giftId:gift.giftId,title:gift.title}});if(!tx.ok)return tx;
 const addedItems=[];for(const itemId of gift.itemIds){if(base.progressionV3.ownedItemIds.includes(itemId))continue;base.progressionV3.ownedItemIds.push(itemId);addedItems.push(itemId);}
 const addedPokemon=[];for(const speciesId of gift.speciesIds){const species=catalog.speciesById[speciesId];if(!species)continue;const result=grantPokemonToProgression(base.progressionV3,species,{acquiredBy:`admin-gift:${gift.giftId}`});if(result.ok)addedPokemon.push(speciesId);}
 if(gift.readAt===null)gift.readAt=now;gift.claimedAt=now;base.progressionV3.revision++;base.revision=(base.revision||0)+1;base.notice=`Gift received · ${gift.title}`;return {ok:true,state:base,reward:clone(gift.reward),addedItems,addedPokemon};
}
