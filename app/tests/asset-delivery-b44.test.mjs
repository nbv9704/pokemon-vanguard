import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {assetRuntimeSnapshot,assetUrl,initializeAssetRuntime,localAssetPath,preloadAssets} from '../public/js/asset-runtime.js';
import {collectBattleAssetPaths,resetBattleAssetReadiness,warmBattleAssets} from '../public/js/battle-asset-readiness.js';
import {createClientStateReceiver} from '../public/js/client-state-receiver.js';
import {imageAttributes} from '../public/js/image-variants.js';

test('asset resolver is local-only and exposes no remote delivery configuration',()=>{
 assert.equal(assetUrl('/pokemon-sprites/ditto.gif'),'/pokemon-sprites/ditto.gif');assert.equal(localAssetPath('/pokemon-sprites/ditto.gif'),'/pokemon-sprites/ditto.gif');assert.equal(localAssetPath('https://cdn.example.test/file.png'),null);assert.deepEqual(assetRuntimeSnapshot(),{config:{schemaVersion:1,delivery:'local'}});
});

test('local asset initialization completes without a network configuration request',async()=>{
 const progress=[],result=await initializeAssetRuntime({onProgress:value=>progress.push(value)});assert.deepEqual(result,{config:{schemaVersion:1,delivery:'local'}});assert.deepEqual(progress,[{stage:'ready',loaded:1,total:1}]);
});

test('a missing local image is reported without retrying a remote origin',async()=>{
 let assignments=0;class FakeImage{set src(value){this._src=value;assignments++;queueMicrotask(()=>this.onerror?.());}get src(){return this._src;}}
 const result=await preloadAssets(['/assets/icons/missing.png'],{ImageImpl:FakeImage,timeoutMs:100});assert.deepEqual(result,{loaded:1,failed:['/assets/icons/missing.png']});assert.equal(assignments,1);
});

test('preload bounds concurrency on Save-Data and responsive DPR candidates stay local',async()=>{
 let active=0,peak=0;class SlowImage{set src(value){this._src=value;active++;peak=Math.max(peak,active);setTimeout(()=>{active--;this.onload?.();},2);}get src(){return this._src;}decode(){return Promise.resolve();}}
 await preloadAssets(['/logo.png','/assets/icons/Home.png','/assets/icons/arena.png'],{ImageImpl:SlowImage,connection:{saveData:true},concurrency:8});assert.equal(peak,2);
 const attributes=imageAttributes('/assets/icons/Home.png',{lazy:false});assert.match(attributes,/src="\/assets\/icons\/Home\.png"/);assert.match(attributes,/srcset="\/assets\/optimized\/.+ 1x, \/assets\/optimized\/.+ 2x"/);assert.doesNotMatch(attributes,/https?:/);
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
