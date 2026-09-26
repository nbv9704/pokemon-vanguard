import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from '../server/legacy/logic-v1.js';
import {migrateV1ToV2} from '../server/migrations.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyV2EconomyAction} from '../server/v2-economy.mjs';
import {adminGiftView,applyAdminGiftAction,enqueueAdminGift,normalizeGiftDraft} from '../server/admin-gifts.mjs';
import {applyMailboxAction,ensureMailboxState,systemMailboxView} from '../server/mailbox-v1.mjs';

const DAY=24*60*60*1000,T0=Date.UTC(2026,8,23,12,0,0);
const migrated=owner=>migrateV1ToV2(setup([owner]),v2Catalog.species).state;

test('system Mailbox tracks unread/read state and reading shortens retention',()=>{
 let state=migrated('mail-lifecycle');ensureMailboxState(state,{now:T0});let view=systemMailboxView(state,v2Catalog,{now:T0});
 assert.equal(view.unreadCount,3);const welcome=view.mails.find(mail=>mail.mailId===0);assert.equal(welcome.unread,true);assert.equal(welcome.expiresAt,T0+90*DAY);
 const opened=applyMailboxAction(state,{type:'mailboxV1.read',kind:'system',mailId:0},{now:T0+DAY});assert.equal(opened.ok,true);state=opened.state;view=systemMailboxView(state,v2Catalog,{now:T0+DAY});
 const readWelcome=view.mails.find(mail=>mail.mailId===0);assert.equal(readWelcome.unread,false);assert.equal(view.unreadCount,2);assert.equal(readWelcome.expiresAt,T0+15*DAY);
 assert.equal(systemMailboxView(state,v2Catalog,{now:T0+16*DAY}).mails.some(mail=>mail.mailId===0),false);
});

test('expired system mail cannot be claimed',()=>{
 let state=migrated('mail-expired');ensureMailboxState(state,{now:T0});const read=applyMailboxAction(state,{type:'mailboxV1.read',kind:'system',mailId:1},{now:T0});assert.equal(read.ok,true);state=read.state;
 const result=applyV2EconomyAction(state,{type:'mail.claim',mailId:1,actionId:'expired-mail-claim'},v2Catalog,{now:T0+8*DAY});assert.equal(result.ok,false);assert.equal(result.code,'MAIL_EXPIRED');
});

test('admin gift retention is configurable and an opened gift expires on the shorter read window',()=>{
 let state=migrated('admin-mail-expired');const draft=normalizeGiftDraft({title:'Event reward',coins:50,mailType:'event',unreadDays:10,readDays:2},v3Catalog,{campaignId:'event-mail',sentBy:'admin',sentAt:T0});assert.equal(draft.ok,true);assert.equal(draft.gift.unreadTtlMs,10*DAY);assert.equal(draft.gift.readTtlMs,2*DAY);
 enqueueAdminGift(state,draft.gift);let view=adminGiftView(state,v3Catalog,{now:T0});assert.equal(view.unreadCount,1);assert.equal(view.gifts[0].expiresAt,T0+10*DAY);
 const opened=applyMailboxAction(state,{type:'mailboxV1.read',kind:'admin',giftId:'event-mail'},{now:T0+DAY});assert.equal(opened.ok,true);state=opened.state;view=adminGiftView(state,v3Catalog,{now:T0+DAY});assert.equal(view.gifts[0].unread,false);assert.equal(view.gifts[0].expiresAt,T0+3*DAY);
 assert.equal(adminGiftView(state,v3Catalog,{now:T0+4*DAY}).gifts.length,0);const claim=applyAdminGiftAction(state,{type:'adminGift.claim',giftId:'event-mail',actionId:'late-claim'},v3Catalog,{now:T0+4*DAY});assert.equal(claim.ok,false);assert.equal(claim.code,'GIFT_EXPIRED');
});
