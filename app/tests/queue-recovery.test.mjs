import test from 'node:test';
import assert from 'node:assert/strict';
import {SerialTaskQueue} from '../server/serial-task-queue.mjs';

test('serial task queue reports a job failure and continues with later work',async()=>{
 const queue=new SerialTaskQueue(),order=[];
 const failed=queue.run(async()=>{order.push('first');throw new Error('synthetic failure');});
 const recovered=queue.run(async()=>{order.push('second');return 42;});
 await assert.rejects(failed,/synthetic failure/);assert.equal(await recovered,42);await queue.idle();assert.deepEqual(order,['first','second']);assert.equal(queue.depth,0);
});

test('serial task queue preserves order while work awaits',async()=>{
 let now=100;const queue=new SerialTaskQueue({now:()=>now}),order=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const first=queue.run(async()=>{order.push('first:start');await gate;order.push('first:end');});
 const second=queue.run(()=>order.push('second'));
 await Promise.resolve();now=145;assert.deepEqual(order,['first:start']);assert.deepEqual(queue.snapshot(),{depth:2,waiting:1,oldestWaitMs:45});release();await Promise.all([first,second]);assert.deepEqual(order,['first:start','first:end','second']);assert.equal(queue.depth,0);assert.deepEqual(queue.snapshot(),{depth:0,waiting:0,oldestWaitMs:0});
});
