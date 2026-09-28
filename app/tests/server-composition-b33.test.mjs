import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHttpRequestHandler,readJsonBody} from '../server/http-request-handler.mjs';
import {createPlayerStateProjector} from '../server/public-state-projector.mjs';
import {setup} from '../src/logic.js';
import {upgradeAdventure} from '../server/v2-release.mjs';
import {upgradeAdventureToV3} from '../server/v3-release.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

function res(){return {status:null,headers:null,body:null,headersSent:false,writableEnded:false,destroyed:false,destroy(){this.destroyed=true;},writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;return this;},end(body){this.body=body;this.writableEnded=true;return this;}};}
function fixture(overrides={}){
 const calls=[];
 const dependencies={
  isClosing:()=>false,readiness:{ready:async()=>{calls.push('ready');return true;}},
  requestPolicy:{requestUrl:req=>new URL(req.url,'http://localhost'),clientIp:()=> 'synthetic'},
  auth:{handle:async()=>{calls.push('auth');return false;},readSession:()=>null},
  admin:{handle:async()=>{calls.push('admin');return false;}},
  quotas:{inspector:()=>({ok:true})},v2Catalog,
  serveV2Catalog:(_req,response)=>{calls.push('v2');response.writeHead(200);response.end('v2');},
  serveV3Catalog:(_req,response)=>{calls.push('v3');response.writeHead(200);response.end('v3');},
  serveStatic:async(_req,response,pathname)=>{calls.push('static');response.writeHead(200);response.end(pathname);}
 };
 return {calls,handle:createHttpRequestHandler({...dependencies,...overrides})};
}

test('HTTP composition keeps public health ahead of auth, supports HEAD, 503 readiness and closing',async()=>{
 const f=fixture({readiness:{ready:async()=>false}}),live=res(),ready=res(),head=res();
 await f.handle({url:'/health/live',method:'GET'},live);
 await f.handle({url:'/health/ready',method:'GET'},ready);
 await f.handle({url:'/health/live',method:'HEAD'},head);
 assert.equal(live.status,200);assert.equal(live.headers['Cache-Control'],'no-store');
 assert.equal(ready.status,503);assert.equal(JSON.parse(ready.body).status,'unavailable');
 assert.equal(head.status,200);assert.equal(head.body,undefined);assert.deepEqual(f.calls,[]);
 const closing=fixture({isClosing:()=>true}),unavailable=res();
 await closing.handle({url:'/health/live',method:'GET'},unavailable);assert.equal(unavailable.status,503);
});

test('HTTP composition preserves auth/admin precedence, catalogs and method firewall',async()=>{
 const f=fixture();const catalog=res(),staticFile=res(),wrongMethod=res();
 await f.handle({url:'/api/v3/catalog',method:'GET'},catalog);
 await f.handle({url:'/index.html',method:'GET'},staticFile);
 await f.handle({url:'/api/v3/catalog',method:'POST'},wrongMethod);
 assert.equal(catalog.body,'v3');assert.equal(staticFile.body,'/index.html');assert.equal(wrongMethod.status,405);
 assert.deepEqual(f.calls,['auth','admin','v3','auth','admin','static','auth','admin']);
 const authWins=fixture({auth:{handle:async(_req,response)=>{response.writeHead(401);response.end();return true;},readSession:()=>null}}),blocked=res();
 await authWins.handle({url:'/api/v3/catalog',method:'GET'},blocked);assert.equal(blocked.status,401);assert.deepEqual(authWins.calls,[]);
});

test('HTTP inspector rejects oversized bodies before inspect, enforces quota and avoids duplicate headers',async()=>{
 await assert.rejects(readJsonBody(Readable.from([Buffer.alloc(32769)])),error=>error.statusCode===413);
 assert.deepEqual(await readJsonBody(Readable.from([Buffer.from('{"test":'),Buffer.from('true}')])),{test:true});
 const quota=fixture({quotas:{inspector:()=>({ok:false,retryAfterMs:2400})}}),limited=res();
 await quota.handle(Object.assign(Readable.from(['{}']),{url:'/api/v2/damage',method:'POST'}),limited);
 assert.equal(limited.status,429);assert.equal(limited.headers['Retry-After'],'3');
 const bad=fixture(),invalid=res();
 await bad.handle(Object.assign(Readable.from(['{broken']),{url:'/api/v2/damage',method:'POST'}),invalid);
 assert.equal(invalid.status,400);assert.equal(invalid.body,'Not found');
 const downstream=fixture({serveStatic:async(_req,response)=>{response.writeHead(200);throw new Error('synthetic downstream failure');}}),alreadySent=res();
 await downstream.handle({url:'/test',method:'GET'},alreadySent);assert.equal(alreadySent.status,200);assert.equal(alreadySent.destroyed,true);assert.equal(alreadySent.writableEnded,false);
});

test('public projection factory keeps spectator restricted and owns a detached allowlisted DTO',()=>{
 const base=setup(['owner']);
 const state=upgradeAdventureToV3(upgradeAdventure(base,v2Catalog).state,v3Catalog).state;
 state.futurePrivateField={secret:'SECRET_SENTINEL_B33'};
 state.adminV1={audit:{secret:'SECRET_SENTINEL_B33'}};
 const room={name:'room',state,clients:new Map([[{},'owner']])},now=1750000000000;
 const project=createPlayerStateProjector({clock:{now:()=>now},ranked:{viewFor:()=>({status:'idle'})},trainingPvp:{viewFor:()=>({status:'idle'})},social:{viewFor:()=>({friends:[]})}});
 const own=project(room,'owner');
 assert.equal(own.view.schemaVersion,3);assert.equal(own.view.rankedV1.status,'idle');
 assert.ok(own.view.trainingV3);assert.ok(own.view.mailboxV1);
 assert.doesNotMatch(JSON.stringify(own),/SECRET_SENTINEL_B33/);
 own.view.collection[0].level=999;
 assert.notEqual(room.state.collection[0].level,999);
 const spectator=project(room,'not-the-owner');
 assert.deepEqual(spectator.view,{spectator:true});
 assert.equal(spectator.meta,own.meta);
});
