import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {ticketBagView,ticketCount,applyBagAction,ensureTicketBag} from '../server/ticket-bag.mjs';
import {applyEconomyTransaction} from '../server/v2-economy-ledger.mjs';
import {applyV3ShopAction,v3ShopView} from '../server/v3-item-shop.mjs';
import {checkoutV3Training} from '../server/v3-training-checkout.mjs';
import {protectRankedLoss} from '../server/rank-ticket-settlement.mjs';
import {ensureRankedState,RankedService} from '../server/ranked-v1.mjs';
import {normalizeGiftDraft,enqueueAdminGift,applyAdminGiftAction} from '../server/admin-gifts.mjs';
import {BagView} from '../public/js/bag-view.js';
import {ShopView} from '../public/js/shop-view.js';
import {createRouter} from '../public/js/router.js';

const state=(coins=2000)=>({owner:'ticket-test',revision:1,schemaVersion:3,coins,gems:0,recruitmentTickets:2,wallet:{coins,crystals:0,recruitmentTickets:2},progressionV3:createV3BetaProgression(v3Catalog)});
const grant=(s,delta,receipt='gift')=>applyEconomyTransaction(s,{receiptId:receipt,kind:'admin-gift',delta});

test('old saves keep recruitment tickets as Bag items; zero new ticket types initialize safely',()=>{
 const s=state();delete s.wallet;assert.equal(ticketCount(s,'recruitment'),2);
 const bag=ticketBagView(s,v3Catalog);
 assert.deepEqual(bag.tickets.map(t=>t.id),['recruitment','shop','training','rank']);
 assert.deepEqual(bag.tickets.map(t=>t.count),[2,0,0,0]);
 assert.ok(bag.heldItems.length>=10);
 assert.deepEqual(ensureTicketBag(s),ensureTicketBag(s));
});

test('tickets are granted and debited by atomic, receipt-aware economy transactions',()=>{
 const s=state();assert.equal(grant(s,{shopTickets:2,trainingTickets:1,rankTickets:3}).ok,true);
 assert.deepEqual([s.ticketBagV1.shopTickets,s.ticketBagV1.trainingTickets,s.ticketBagV1.rankTickets],[2,1,3]);
 assert.equal(grant(s,{shopTickets:100},'gift').duplicate,true);
 const invalid=grant(s,{shopTickets:-3},'overdraw');assert.equal(invalid.ok,false);assert.equal(s.ticketBagV1.shopTickets,2);
 assert.equal(s.economyLedger.length,1);
});

test('Shop Ticket unlocks any sale item for free and rejects duplicates or unavailable items',()=>{
 let s=state(0);grant(s,{shopTickets:1});const action={type:'shopV3.buy',itemId:'charcoal',payment:'ticket',actionId:'shop:once'};
 const buy=applyV3ShopAction(s,action,v3Catalog);assert.equal(buy.ok,true);s=buy.state;
 assert.equal(s.wallet.coins,0);assert.equal(s.ticketBagV1.shopTickets,0);assert.equal(s.progressionV3.ownedItemIds.includes('charcoal'),true);
 const duplicate=applyV3ShopAction(s,action,v3Catalog);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.state.ticketBagV1.shopTickets,0);
 assert.equal(applyV3ShopAction(s,{...action,itemId:'sitrus-berry'},v3Catalog).code,'ACTION_ID_REUSED');
 assert.equal(applyV3ShopAction(s,{type:'shopV3.buy',itemId:'beedrillite',payment:'ticket',actionId:'shop:other'},v3Catalog).code,'ITEM_NOT_FOR_SALE');
 assert.equal(v3ShopView(s,v3Catalog).shopTickets,0);
});

test('Shop Tickets do not substitute for paid purchase when explicitly choosing VP',()=>{
 const s=state(0);grant(s,{shopTickets:1});const buy=applyV3ShopAction(s,{type:'shopV3.buy',itemId:'charcoal',payment:'coins',actionId:'shop:coins'},v3Catalog);
 assert.equal(buy.code,'INSUFFICIENT_COINS');assert.equal(s.ticketBagV1.shopTickets,1);
});

test('Training Ticket covers an expensive entire training transaction; free save cannot waste one',()=>{
 const s=state(0),original=s.progressionV3.builds[0],updated=structuredClone(original);updated.revision++;updated.natureId=original.natureId==='adamant'?'modest':'adamant';
 assert.equal(checkoutV3Training(s,original,updated,{payment:'ticket'}).code,'INSUFFICIENT_TRAINING_TICKETS');
 grant(s,{trainingTickets:1});const paid=checkoutV3Training(s,original,updated,{payment:'ticket',actionId:'training:1'});
 assert.equal(paid.ok,true);assert.ok(paid.cost.total>=500);assert.equal(s.wallet.coins,0);assert.equal(s.ticketBagV1.trainingTickets,0);
 assert.equal(s.economyLedger.find(e=>e.kind==='buildV3.training').delta.trainingTickets,-1);
 grant(s,{trainingTickets:1},'gift:second');assert.equal(checkoutV3Training(s,updated,updated,{payment:'ticket'}).code,'TICKET_NOT_REQUIRED');assert.equal(s.ticketBagV1.trainingTickets,1);
});

test('Rank Ticket can be armed/disarmed only when owned; it is not consumed until a real loss',()=>{
 const s=state();ensureRankedState(s);s.rankedV1.rating=1200;
 assert.equal(applyBagAction(s,{type:'bagV1.rankProtection',enabled:true}).code,'INSUFFICIENT_RANK_TICKETS');
 grant(s,{rankTickets:1});let changed=applyBagAction(s,{type:'bagV1.rankProtection',enabled:true});assert.equal(changed.ok,true);
 assert.equal(changed.state.ticketBagV1.rankProtectionArmed,true);assert.equal(changed.state.ticketBagV1.rankTickets,1);
 assert.deepEqual(protectRankedLoss(changed.state,'ranked:win',16),{delta:16,protected:false});
 assert.deepEqual(protectRankedLoss(changed.state,'ranked:draw',0),{delta:0,protected:false});
 assert.equal(changed.state.ticketBagV1.rankTickets,1);
 assert.deepEqual(protectRankedLoss(changed.state,'ranked:loss',-16),{delta:0,protected:true});
 assert.equal(changed.state.ticketBagV1.rankTickets,0);assert.equal(changed.state.ticketBagV1.rankProtectionArmed,false);
 assert.deepEqual(protectRankedLoss(changed.state,'ranked:second-loss',-12),{delta:-12,protected:false});
});

test('Rank protection does not consume at 0 RP floor or when disarmed',()=>{
 const s=state();grant(s,{rankTickets:1});s.rankedV1={rating:0};s.ticketBagV1.rankProtectionArmed=true;
 assert.deepEqual(protectRankedLoss(s,'ranked:floor',-10),{delta:-10,protected:false});assert.equal(s.ticketBagV1.rankTickets,1);
 s.rankedV1.rating=1000;const disarmed=applyBagAction(s,{type:'bagV1.rankProtection',enabled:false}).state;assert.equal(disarmed.ticketBagV1.rankProtectionArmed,false);
 assert.deepEqual(protectRankedLoss(disarmed,'ranked:unarmed',-10),{delta:-10,protected:false});assert.equal(disarmed.ticketBagV1.rankTickets,1);
});

test('Ranked settlement preserves history loss, uses one ticket, records 0 delta and shows protected result',async()=>{
 const a=state(),b=state();for(const s of [a,b])ensureRankedState(s);a.owner='A';b.owner='B';grant(b,{rankTickets:1});b.ticketBagV1.rankProtectionArmed=true;
 const states={A:a,B:b};let writes=0;const service=new RankedService({catalog:v3Catalog,getState:id=>states[id],persistPair:async entries=>{writes+=entries.length;}});
 const match={id:'ranked:protected',mode:'single',participants:{A:{accountId:'A',name:'Winner'},B:{accountId:'B',name:'Loser'}},settled:false,battle:null,forfeitWinner:'A'};
 await service.settle(match);assert.equal(match.settled,true);assert.equal(match.rankTicketProtected.B,true);
 assert.equal(b.rankedV1.losses,1);assert.equal(b.rankedV1.rating,1000);assert.equal(b.rankedV1.history[0].rankTicketProtected,true);
 assert.equal(b.ticketBagV1.rankTickets,0);assert.equal(b.ticketBagV1.rankProtectionArmed,false);
 assert.equal(service.viewFor('B',b).status,'idle');assert.equal(writes,2);
 await service.settle(match);assert.equal(b.rankedV1.losses,1);assert.equal(b.economyLedger.filter(e=>e.kind==='ranked.rank-protection').length,1);
});

test('Admin gifts can award all four ticket items without mixing them into held-item catalog',()=>{
 const s=state();const input={title:'Ticket bundle',recruitmentTickets:4,shopTickets:2,trainingTickets:3,rankTickets:1};
 const draft=normalizeGiftDraft(input,v3Catalog,{campaignId:'tickets:gift',sentAt:1000});assert.equal(draft.ok,true);
 enqueueAdminGift(s,draft.gift);const claim=applyAdminGiftAction(s,{type:'adminGift.claim',giftId:'tickets:gift'},v3Catalog,{now:1001});assert.equal(claim.ok,true);
 assert.deepEqual(ticketBagView(claim.state,v3Catalog).tickets.map(t=>t.count),[6,2,3,1]);
 const second=applyAdminGiftAction(claim.state,{type:'adminGift.claim',giftId:'tickets:gift'},v3Catalog,{now:1002});assert.equal(second.duplicate,true);
 assert.equal(second.state.ticketBagV1.rankTickets,1);
});

test('Bag route and UI present all ticket assets without reusing the Shop Owned icon',()=>{
 const sent=[],s=state();grant(s,{shopTickets:2,rankTickets:1});const bag={bagV1:ticketBagView(s,v3Catalog)};
 const screen=new BagView({sendAction:action=>sent.push(action),onChange(){},createActionId:()=> 'bag:ui'}),html=screen.render(bag);
 for(const asset of ['recruit_ticket.png','shop_ticket.png','training_ticket.png','rank_ticket.png'])assert.match(html,new RegExp(asset));
 assert.equal(createRouter().go('bag'),true);assert.match(html,/data-bag="select"/);
 screen.handleClick({dataset:{bag:'select',ticket:'rank'}});assert.match(screen.render(bag),/Activate for next Ranked loss/);
 screen.handleClick({dataset:{bag:'arm',enabled:'true'}});assert.deepEqual(sent,[{type:'bagV1.rankProtection',enabled:true,actionId:'bag:ui'}]);
 const shopScreen=new ShopView({sendAction:action=>sent.push(action),onChange(){},createActionId:()=> 'buy:1'});
 shopScreen.handleClick({dataset:{shop:'buy-ticket',itemId:'charcoal'}});assert.deepEqual(sent[1],{type:'shopV3.buy',itemId:'charcoal',payment:'ticket',actionId:'buy:1'});
 const shop=readFileSync(new URL('../public/js/shop-view.js',import.meta.url),'utf8');assert.doesNotMatch(shop,/rewardIcon\('bag'/);
});
