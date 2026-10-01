import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createCatalogLoader,createStyleLoader,RouteModuleRegistry} from '../public/js/feature-loader.js';

test('catalog loader memoizes one request per protocol and never fetches V2 for a V3-only session',async()=>{
 const calls=[],deferred={};
 const loader=createCatalogLoader(url=>{calls.push(url);return new Promise(resolve=>{deferred[url]=()=>resolve(new Response(JSON.stringify({url}),{status:200,headers:{'content-type':'application/json'}}));});});
 const first=loader.load('v3','/api/v3/catalog'),second=loader.load('v3','/api/v3/catalog');
 assert.strictEqual(first,second);assert.deepEqual(calls,[]);await Promise.resolve();assert.deepEqual(calls,['/api/v3/catalog']);
 deferred['/api/v3/catalog']();assert.deepEqual(await first,{url:'/api/v3/catalog'});assert.strictEqual(await loader.load('v3','/api/v3/catalog'),await first);assert.equal(calls.includes('/api/v2/catalog'),false);
});

test('catalog loader exposes failure and explicit retry replaces the rejected promise',async()=>{
 let attempts=0;const loader=createCatalogLoader(async()=>{attempts++;if(attempts===1)throw new Error('offline');return new Response('{"version":3}',{status:200});});
 await assert.rejects(loader.load('v3','/api/v3/catalog'),/offline/);assert.equal(loader.status('v3').state,'error');
 assert.deepEqual(await loader.load('v3','/api/v3/catalog',{retry:true}),{version:3});assert.equal(attempts,2);assert.equal(loader.status('v3').state,'ready');
});

test('route registry deduplicates rapid navigation and isolates a failed optional module',async()=>{
 let coreLoads=0,optionalLoads=0;const registry=new RouteModuleRegistry({core:async()=>{coreLoads++;return {ready:true};},optional:async()=>{optionalLoads++;throw new Error('chunk unavailable');}});
 const [a,b]=await Promise.all([registry.load('core'),registry.load('core')]);assert.strictEqual(a,b);assert.equal(coreLoads,1);
 await assert.rejects(registry.load('optional'),/chunk unavailable/);assert.equal(registry.status('core').state,'ready');assert.equal(registry.status('optional').state,'error');
 await assert.rejects(registry.load('optional',{retry:true}),/chunk unavailable/);assert.equal(optionalLoads,2);
});

test('style loader is a ready barrier and deduplicates stylesheet insertion',async()=>{
 const appended=[],documentLike={createElement(){const listeners={};return {dataset:{},addEventListener(type,callback){listeners[type]=callback;},remove(){},listeners};},head:{append(link){appended.push(link);queueMicrotask(()=>link.listeners.load());}}};
 const styles=createStyleLoader(documentLike),first=styles.load('/battle.css'),second=styles.load('/battle.css');assert.strictEqual(first,second);const link=await first;
 assert.equal(appended.length,1);assert.equal(link.rel,'stylesheet');assert.equal(link.href,'/battle.css');assert.deepEqual(await styles.loadMany(['/battle.css']),[link]);
});

test('client selects legacy and battle features through dynamic imports without eager catalog loads',async()=>{
 const source=await readFile(new URL('../public/client.js',import.meta.url),'utf8'),html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 for(const eager of ['./js/training-editor.js"','./js/box-view.js"','./js/team-builder.js"','./js/v2-battle-screen.js"','./js/damage-inspector.js"','./js/v3-battle-screen.js"'])assert.equal(source.includes(`from "${eager}`),false,eager);
 assert.match(source,/import\('\.\/js\/training-editor\.js'\)/u);assert.match(source,/import\('\.\/js\/damage-inspector\.js'\)/u);assert.match(source,/import\('\.\/js\/v3-battle-screen\.js'\)/u);
 assert.doesNotMatch(source,/trainingEditor\.load\(\)\.catch/u);assert.doesNotMatch(source,/v3TrainingEditor\.load\(\)\.catch/u);assert.match(source,/state\.trainingV3/u);assert.match(source,/data-action="feature-retry"/u);
 for(const coreStyle of ['/training-editor.css','/team-builder.css','/recruitment.css'])assert.equal(html.includes(`href="${coreStyle}"`),true,coreStyle);
 for(const lazyStyle of ['/box-view.css','/v2-battle.css','/damage-inspector.css','/v3-battle-arena.css']){assert.equal(html.includes(`href="${lazyStyle}"`),false,lazyStyle);assert.equal(source.includes(`'${lazyStyle}'`),true,lazyStyle);}
});
