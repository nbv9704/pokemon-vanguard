import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeMetrics,instrumentPersistence} from '../server/runtime-metrics.mjs';

test('runtime metrics bound distributions and expose aggregate persistence, loop, memory, broadcast and drop data',async()=>{
 const metrics=new RuntimeMetrics({memoryUsage:()=>({heapUsed:10,heapTotal:20,rss:30})});
 metrics.observeEventLoopLag(4);metrics.observeEventLoopLag(8);metrics.observeBroadcast({deliveredSockets:2,deliveredBytes:40});metrics.observeSocketDrop('backpressure');metrics.observeSocketDrop('closed');
 const storage={async save(){return 'saved';},async savePair(){throw Object.assign(new Error('failed'),{code:'FAIL'});}};instrumentPersistence(storage,metrics);
 assert.equal(await storage.save(),'saved');await assert.rejects(storage.savePair(),/failed/);
 const view=metrics.snapshot();assert.equal(view.persist.samples,2);assert.equal(view.persist.errors,1);assert.equal(view.eventLoop.samples,2);assert.equal(view.eventLoop.p95Ms,8);assert.deepEqual(view.memory,{heapUsedBytes:10,heapTotalBytes:20,rssBytes:30});assert.deepEqual(view.broadcast,{frames:1,deliveries:2,bytes:40});assert.deepEqual(view.socketDrops,{backpressure:1,closed:1,error:0});
});
