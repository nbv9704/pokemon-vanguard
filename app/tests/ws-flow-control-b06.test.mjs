import test from 'node:test';
import assert from 'node:assert/strict';
import {createInboundLimiter,sendBounded,WS_LIMITS} from '../server/ws-flow-control.mjs';

test('burst of 1,000 synthetic actions cannot exceed per-socket in-process queue bound',()=>{
 const limiter=createInboundLimiter(),socket={},other={};let accepted=0;
 for(let i=0;i<1000;i++)if(limiter.acquire(socket))accepted++;
 assert.equal(accepted,WS_LIMITS.pendingMessagesPerSocket);assert.equal(limiter.pending(other),0);
 assert.equal(limiter.acquire(other),true);assert.equal(limiter.pending(socket),accepted);
 for(let i=0;i<accepted;i++)limiter.release(socket);
 assert.equal(limiter.pending(socket),0);assert.equal(limiter.acquire(socket),true);
});
test('backpressure terminates a slow consumer rather than buffering unlimited state frames',()=>{
 const drops=[],ws={readyState:1,bufferedAmount:WS_LIMITS.maxBufferedBytes+1,send(){throw Error('should never send');},terminate(){this.terminated=true;}};
 assert.equal(sendBounded(ws,{type:'state'},{onDrop:reason=>drops.push(reason)}),false);assert.equal(ws.terminated,true);
 const good={readyState:1,bufferedAmount:0,frames:[],send(text){this.frames.push(JSON.parse(text));}};
 assert.equal(sendBounded(good,{type:'action-ack',actionId:'id'}),true);assert.deepEqual(good.frames,[{type:'action-ack',actionId:'id'}]);
 good.readyState=3;assert.equal(sendBounded(good,{type:'state'},{onDrop:reason=>drops.push(reason)}),false);
 const broken={readyState:1,bufferedAmount:0,send(){throw Error('synthetic send failure');},terminate(){this.terminated=true;}};assert.equal(sendBounded(broken,{type:'state'},{onDrop:reason=>drops.push(reason)}),false);assert.equal(broken.terminated,true);assert.deepEqual(drops,['backpressure','closed','error']);
});
