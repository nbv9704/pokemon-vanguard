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

// Arrival order is binding for *overlapping* requests, not for unrelated users.
test('pending pair reserves both accounts against newer single-account requests',async()=>{
 const coordinator=new AccountCoordinator(),order=[];
 let releaseA,releaseC;
 const gateA=new Promise(resolve=>{releaseA=resolve;});
 const gateC=new Promise(resolve=>{releaseC=resolve;});
 const activeA=coordinator.withAccounts(['a'],async()=>{order.push('a:start');await gateA;order.push('a:end');});
 const activeC=coordinator.withAccounts(['c'],async()=>{order.push('c:start');await gateC;});
 const pair=coordinator.withAccounts(['b','a'],()=>{order.push('pair');});
 const lateB=coordinator.withAccounts(['b'],()=>{order.push('late-b');});
 const unrelated=coordinator.withAccounts(['d'],()=>{order.push('d');});
 await Promise.resolve();
 assert.deepEqual(order,['a:start','c:start','d'],'unrelated work need not wait for the pair');
 releaseA();await activeA;await pair;await lateB;
 assert.deepEqual(order,['a:start','c:start','d','a:end','pair','late-b']);
 releaseC();await activeC;
});

test('rejected reserved pair releases claims and lets later overlapping jobs run',async()=>{
 const coordinator=new AccountCoordinator(),order=[];
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const first=coordinator.withAccounts(['a'],()=>gate);
 const pair=coordinator.withAccounts(['a','b'],()=>{order.push('pair');throw Error('pair rejected');});
 const later=coordinator.withAccounts(['b'],()=>{order.push('later');});
 await Promise.resolve();assert.deepEqual(order,[]);
 release();await first;await assert.rejects(pair,/pair rejected/);await later;
 assert.deepEqual(order,['pair','later']);
});
