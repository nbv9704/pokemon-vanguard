import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountCoordinator} from '../server/account-coordinator.mjs';

test('account coordinator serializes overlapping account sets in stable order',async()=>{
 const coordinator=new AccountCoordinator(),order=[];let release;const gate=new Promise(resolve=>{release=resolve;});
 const pair=coordinator.withAccounts(['b','a'],async()=>{order.push('pair:start');await gate;order.push('pair:end');});
 const single=coordinator.withAccounts(['b'],()=>order.push('single'));await Promise.resolve();assert.deepEqual(order,['pair:start']);release();await Promise.all([pair,single]);assert.deepEqual(order,['pair:start','pair:end','single']);
});

test('account coordinator recovers after rejected multi-account work',async()=>{
 const coordinator=new AccountCoordinator();await assert.rejects(coordinator.withAccounts(['a','b'],async()=>{throw new Error('synthetic');}),/synthetic/);assert.equal(await coordinator.withAccounts(['b','a'],async()=>42),42);
});
