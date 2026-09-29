import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createAssetConfigHttpResponse} from '../server/http-public-assets.mjs';
import {assetRuntimeSnapshot,assetUrl,configureAssetRuntime,initializeAssetRuntime,localAssetPath,preloadAssets} from '../public/js/asset-runtime.js';
import {collectBattleAssetPaths,resetBattleAssetReadiness,warmBattleAssets} from '../public/js/battle-asset-readiness.js';
import {createClientStateReceiver} from '../public/js/client-state-receiver.js';
import {imageAttributes} from '../public/js/image-variants.js';

function invoke(handler,method='GET'){
 const result={};const res={writeHead(status,headers){result.status=status;result.headers=headers;},end(body){result.body=body;}};handler({method},res);return result;
}
test('asset config publishes only an HTTPS or local public base and never credentials',()=>{
 const good=invoke(createAssetConfigHttpResponse({baseUrl:'https://cdn.example.test/pv/release/'}));
 assert.equal(good.status,200);assert.equal(JSON.parse(good.body).baseUrl,'https://cdn.example.test/pv/release');assert.equal(good.headers['Cache-Control'],'public, max-age=60, must-revalidate');
 const unsafe=JSON.parse(invoke(createAssetConfigHttpResponse({baseUrl:'https://secret@example.test/files'})).body);assert.equal(unsafe.baseUrl,'');
});

test('asset resolver remains local by default and maps a configured release back to local fallback',()=>{
 configureAssetRuntime({},'https://game.example.test');assert.equal(assetUrl('/pokemon-sprites/ditto.gif'),'/pokemon-sprites/ditto.gif');
 configureAssetRuntime({baseUrl:'https://cdn.example.test/pv/r1/'},'https://game.example.test');
 const remote=assetUrl('/pokemon-sprites/ditto.gif');assert.equal(remote,'https://cdn.example.test/pv/r1/pokemon-sprites/ditto.gif');assert.equal(localAssetPath(remote),'/pokemon-sprites/ditto.gif');
 configureAssetRuntime({baseUrl:'javascript:alert(1)'},'https://game.example.test');assert.equal(assetUrl('/logo.png'),'/logo.png');
});

test('runtime config does not download the large manifest during boot unless requested',async()=>{
 const calls=[],fetchImpl=async url=>{calls.push(url);return {ok:true,json:async()=>({schemaVersion:1,baseUrl:'https://cdn.example.test/r1',manifestPath:'/asset-manifest.json'})};};
 await initializeAssetRuntime({fetchImpl,origin:'https://game.example.test'});assert.deepEqual(calls,['/api/assets/config']);assert.equal(assetRuntimeSnapshot().manifest,null);
});

test('an essential CDN image failure opens the session circuit breaker and completes from local assets',async()=>{
 configureAssetRuntime({baseUrl:'https://cdn.example.test/pv/r1'},'https://game.example.test');
 class FakeImage{
  set src(value){this._src=new URL(value,'https://game.example.test/').href;queueMicrotask(()=>this._src.startsWith('https://cdn.example.test/')?this.onerror?.():this.onload?.());}
  get src(){return this._src;}decode(){return Promise.resolve();}
 }
 const result=await preloadAssets(['/assets/icons/Home.png'],{ImageImpl:FakeImage,origin:'https://game.example.test/',timeoutMs:100});
 assert.deepEqual(result,{loaded:1,failed:[]});assert.equal(assetRuntimeSnapshot().config.baseUrl,'');assert.equal(assetUrl('/assets/icons/arena.png'),'/assets/icons/arena.png');
});

test('preload bounds concurrency on Save-Data and responsive DPR candidates use the release resolver',async()=>{
 configureAssetRuntime({baseUrl:'https://cdn.example.test/pv/r1'},'https://game.example.test');let active=0,peak=0;
 class SlowImage{set src(value){this._src=new URL(value,'https://game.example.test/').href;active++;peak=Math.max(peak,active);setTimeout(()=>{active--;this.onload?.();},2);}get src(){return this._src;}decode(){return Promise.resolve();}}
 await preloadAssets(['/logo.png','/assets/icons/Home.png','/assets/icons/arena.png'],{ImageImpl:SlowImage,origin:'https://game.example.test/',connection:{saveData:true},concurrency:8});assert.equal(peak,2);
 const attributes=imageAttributes('/assets/icons/Home.png',{lazy:false});assert.match(attributes,/src="https:\/\/cdn\.example\.test\/pv\/r1\/assets\/icons\/Home\.png"/);assert.match(attributes,/srcset="https:\/\/cdn\.example\.test\/pv\/r1\/assets\/optimized\/.+ 1x, https:\/\/cdn\.example\.test\/pv\/r1\/assets\/optimized\/.+ 2x"/);
});

test('checked-in runtime manifest has deterministic release metadata and essential fallback files',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.schemaVersion,1);assert.match(manifest.release,/^sha256-[a-f0-9]{64}$/);assert.ok(manifest.totals.files>1000);assert.ok(manifest.totals.bytes>0);
 assert.ok(manifest.entries.every(entry=>entry.mime!=='application/octet-stream'));assert.ok(!manifest.entries.some(entry=>entry.path.endsWith('.md')));
 for(const required of ['/logo.png','/pokemon-placeholder.svg']){const entry=manifest.entries.find(value=>value.path===required);assert.ok(entry);assert.equal(entry.essential,true);assert.match(entry.sha256,/^[a-f0-9]{64}$/);}
});

test('battle readiness warms only public roster sprites and deduplicates repeated state pushes',()=>{
 resetBattleAssetReadiness();const state={battleV3:{own:[{speciesId:'ditto',spriteKey:'ditto'}],opponent:[{speciesId:'morpeko'}],privateFutureMove:'never-read'},unrelated:{speciesId:'not-in-regulation'}};
 const paths=collectBattleAssetPaths(state);assert.deepEqual(paths.sort(),['/pokemon-sprites/back/ditto.gif','/pokemon-sprites/back/morpeko.gif','/pokemon-sprites/ditto.gif','/pokemon-sprites/morpeko.gif']);
 const calls=[],preload=value=>{calls.push(value);return Promise.resolve();};assert.equal(warmBattleAssets(state,{preload}).length,4);assert.equal(warmBattleAssets(state,{preload}).length,0);assert.equal(calls.length,1);
 const root={},received=[],warmed=[];const accept=createClientStateReceiver({root,warm:view=>warmed.push(view),receive:(...args)=>received.push(args)});
 accept({spectator:true});assert.match(root.innerHTML,/belongs to another player/);assert.equal(warmed.length,0);accept(state,{version:2});assert.deepEqual(warmed,[state]);assert.deepEqual(received,[[state,{version:2}]]);
});
