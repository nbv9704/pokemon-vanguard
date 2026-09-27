import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from '../src/logic.js';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {commitReceiptCommand} from '../server/receipt-command-handler.mjs';
import {applyMissionAction,ensureMissionState} from '../server/missions.mjs';
import {applyAdminGiftAction,enqueueAdminGift,normalizeGiftDraft} from '../server/admin-gifts.mjs';
import {applyBagAction,ensureTicketBag} from '../server/ticket-bag.mjs';

const NOW=Date.UTC(2026,8,27,8);
const clone=value=>structuredClone(value);
function state(){const base=upgradeAdventureToV3(upgradeAdventure(setup(['b14-player']),v2Catalog).state,v3Catalog).state;ensureMissionState(base,NOW,{login:true});ensureTicketBag(base).rankTickets=1;for(const id of ['gift-one','gift-two']){const draft=normalizeGiftDraft({coins:50,title:id},v3Catalog,{campaignId:id,sentBy:'admin',sentAt:NOW});assert.equal(enqueueAdminGift(base,draft.gift).ok,true);}return base;}
async function loseAckThenRetry(initial,action,apply){let durable=clone(initial),writes=0;const options={accountId:'b14-player',liveState:initial,load:async()=>clone(durable),persist:async(_id,next)=>{durable=clone(next);writes++;if(writes===1)throw Error('ACK_LOST');},action,apply};await assert.rejects(commitReceiptCommand(options),/ACK_LOST/);const retry=await commitReceiptCommand(options);return {durable,retry,writes,invoke:next=>commitReceiptCommand({...options,action:next})};}

test('Mission reward retry after a lost ACK returns the durable receipt without paying twice',async()=>{
 const initial=state(),before=initial.wallet.recruitmentTickets,action={type:'mission.claim',category:'daily',missionId:'daily-login',actionId:'b14:mission'};
 const run=await loseAckThenRetry(initial,action,(saved,input)=>applyMissionAction(saved,input,{serverNow:NOW}));
 assert.equal(run.retry.duplicate,true);assert.equal(run.retry.state.wallet.recruitmentTickets,before+6);assert.equal(run.writes,1);
 assert.equal(run.retry.state.actionReceipts.filter(entry=>entry.actionId===action.actionId).length,1);
 const conflict=await run.invoke({...action,missionId:'daily-battle'});assert.equal(conflict.code,'ACTION_ID_REUSED');
});

test('Admin Gift retry after a lost ACK cannot grant twice or reuse the ID for another gift',async()=>{
 const initial=state(),before=initial.wallet.coins,action={type:'adminGift.claim',giftId:'gift-one',actionId:'b14:gift'};
 const run=await loseAckThenRetry(initial,action,(saved,input)=>applyAdminGiftAction(saved,input,v3Catalog,{now:NOW+1}));
 assert.equal(run.retry.duplicate,true);assert.equal(run.retry.state.wallet.coins,before+50);assert.equal(run.writes,1);
 assert.equal(run.retry.state.adminGiftsV1.inbox.find(gift=>gift.giftId==='gift-one').claimedAt,NOW+1);
 const conflict=await run.invoke({...action,giftId:'gift-two'});assert.equal(conflict.code,'ACTION_ID_REUSED');
});

test('Rank protection retry after a lost ACK preserves the setting and rejects payload collision',async()=>{
 const initial=state(),action={type:'bagV1.rankProtection',enabled:true,actionId:'b14:bag'};
 const run=await loseAckThenRetry(initial,action,applyBagAction);
 assert.equal(run.retry.duplicate,true);assert.equal(run.retry.state.ticketBagV1.rankProtectionArmed,true);assert.equal(run.writes,1);
 const conflict=await run.invoke({...action,enabled:false});assert.equal(conflict.code,'ACTION_ID_REUSED');
});
