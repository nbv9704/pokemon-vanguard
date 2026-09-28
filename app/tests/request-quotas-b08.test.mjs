import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestQuotas,createTokenBucket} from '../server/request-quotas.mjs';

test('token bucket bounds a synthetic 1000-action flood and refills against a controlled clock',()=>{
 let tick=1000;const bucket=createTokenBucket({capacity:5,windowMs:1000,maxKeys:2,idleMs:2000,now:()=>tick});
 let accepted=0;for(let i=0;i<1000;i++)if(bucket.take('user').ok)accepted++;
 assert.equal(accepted,5);assert.equal(bucket.inspect('user').ok,false);
 tick+=200;assert.equal(bucket.take('user').ok,true);assert.equal(bucket.take('user').ok,false);
 tick+=1000;assert.equal(bucket.take('user').ok,true);
 assert.equal(bucket.take('other').ok,true);assert.equal(bucket.take('third').ok,false,'bounded map fails closed');
 tick+=2001;assert.equal(bucket.take('third').ok,true,'idle keys are reclaimed');assert.ok(bucket.size()<=2);
});

test('account, IP, and socket quotas are independent and cannot starve unrelated users',()=>{
 let tick=0;const quotas=createRequestQuotas({now:()=>tick,limits:{accountActions:2,ipActions:3,socketMessages:2,ipUpgrades:1,httpInspector:1}});
 const a={},b={},other={};
 assert.equal(quotas.message({accountId:'a',ip:'ip1',socket:a}).ok,true);
 assert.equal(quotas.message({accountId:'a',ip:'ip1',socket:a}).ok,true);
 assert.equal(quotas.message({accountId:'a',ip:'ip1',socket:b}).ok,false,'account shared across tabs');
 assert.equal(quotas.message({accountId:'b',ip:'ip1',socket:b}).ok,true);
 assert.equal(quotas.message({accountId:'c',ip:'ip1',socket:other}).ok,false,'IP shared across accounts');
 assert.equal(quotas.message({accountId:'c',ip:'ip2',socket:other}).ok,true,'other IP unaffected');
 assert.equal(quotas.upgrade('ip1').ok,true);assert.equal(quotas.upgrade('ip1').ok,false);
 assert.equal(quotas.inspector('ip2').ok,true);assert.equal(quotas.inspector('ip2').ok,false);
 tick+=60_001;quotas.prune();assert.equal(quotas.upgrade('ip1').ok,true);
});

test('the local-server wires lightweight pre-queue quotas through the B10 trusted-proxy policy',async()=>{
 const {readFile}=await import('node:fs/promises');
 const server=await readFile(new URL('../local-server.mjs',import.meta.url),'utf8');
 const ws=await readFile(new URL('../server/websocket-controller.mjs',import.meta.url),'utf8');
 const http=await readFile(new URL('../server/http-request-handler.mjs',import.meta.url),'utf8');
 assert.match(server,/createWebsocketController\(/);
 assert.match(ws,/quotas\.message\(/);assert.match(ws,/quotas\.upgrade\(/);
 assert.match(server,/createHttpRequestHandler\(/);
 assert.match(http,/quotas\.inspector\(/);assert.match(http,/requestPolicy\.clientIp\(req\)/);
 assert.doesNotMatch(server+ws+http,/req\.headers\[['"]x-forwarded-for['"]\]/);
 assert.ok(ws.indexOf('quotas.message(')<ws.indexOf('inbound.acquire(ws)'));
});
