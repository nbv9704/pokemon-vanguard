import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from '../server/legacy/logic-v1.js';
import {migrateV1ToV2} from '../server/migrations.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {applyV2EconomyAction} from '../server/v2-economy.mjs';
import {applyEconomyTransaction} from '../server/v2-economy-ledger.mjs';
import {settleV2Battle} from '../server/v2-settlement.mjs';
import {upgradeAdventure} from '../server/v2-release.mjs';

const migrated=owner=>migrateV1ToV2(setup([owner]),v2Catalog.species).state;

test('economy config uses equal-pool eight-offer recruitment with seven-day trials',()=>{
 const economy=v2Catalog.economy;assert.equal(economy.schemaVersion,2);assert.equal(economy.recruitment.lineupSize,8);assert.equal(economy.recruitment.trialDurationMs,7*24*60*60*1000);assert.equal(economy.recruitment.permanentCostCoins,1200);assert.equal(economy.recruitment.permanentCostTickets,1);assert.equal(economy.starterWallet.recruitmentTickets,1);assert.equal(economy.summon,undefined);assert.equal(economy.mega.stoneCostCoins,1200);
});

test('existing schema-v2 saves gain one migration ticket without changing coins or crystals',()=>{
 const old=migrated('economy-old-v2');old.wallet={coins:777,crystals:333};old.coins=777;old.gems=333;old.economyVersion=1;delete old.recruitmentTickets;const upgraded=upgradeAdventure(old,v2Catalog);assert.equal(upgraded.status,'current');assert.deepEqual(upgraded.state.wallet,{coins:777,crystals:333,recruitmentTickets:1});assert.equal(upgraded.state.economyVersion,2);
});

test('ledger supports recruitment tickets and rejects negative balances atomically',()=>{
 const state=migrated('economy-ledger'),before=structuredClone(state.wallet),spent=applyEconomyTransaction(state,{receiptId:'ticket:1',kind:'recruit.permanent',delta:{recruitmentTickets:-1}});assert.equal(spent.ok,true);assert.equal(state.wallet.recruitmentTickets,before.recruitmentTickets-1);const duplicate=applyEconomyTransaction(state,{receiptId:'ticket:1',kind:'recruit.permanent',delta:{recruitmentTickets:-1}});assert.equal(duplicate.duplicate,true);assert.equal(state.wallet.recruitmentTickets,before.recruitmentTickets-1);const rejected=applyEconomyTransaction(state,{receiptId:'ticket:2',kind:'recruit.permanent',delta:{recruitmentTickets:-1}});assert.equal(rejected.code,'INSUFFICIENT_RECRUITMENT_TICKETS');assert.equal(state.wallet.recruitmentTickets,0);
});

test('mail claims are action-idempotent and never credit twice',()=>{
 const state=migrated('economy-mail'),before=structuredClone(state.wallet),action={type:'mail.claim',mailId:0,actionId:'mail:first'},first=applyV2EconomyAction(state,action,v2Catalog);assert.equal(first.ok,true);assert.equal(first.state.wallet.coins,before.coins+500);assert.equal(first.state.wallet.crystals,before.crystals+500);assert.equal(first.state.wallet.recruitmentTickets,before.recruitmentTickets);const duplicate=applyV2EconomyAction(first.state,action,v2Catalog);assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.state.wallet,first.state.wallet);assert.equal(duplicate.state.economyLedger.length,1);
});

test('battle settlement uses the shared ledger and remains idempotent',()=>{
 const state=migrated('economy-battle'),before=state.wallet.coins;state.battleV2={id:'battle-ledger',phase:'FINISHED',regulationId:'alpha-single',gym:0,battle:{result:{winner:'A',reason:'all-fainted',receiptId:'battle-ledger:result'}}};const first=settleV2Battle(state,v2Catalog),second=settleV2Battle(state,v2Catalog);assert.equal(first.settled,true);assert.equal(second.settled,false);assert.equal(state.wallet.coins,before+680);assert.equal(state.economyLedger.filter(entry=>entry.receiptId==='battle-ledger:result').length,1);assert.equal(state.rewardReceipts.length,1);
});
