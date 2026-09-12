import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateBetaReview} from '../content-import/beta-review.mjs';
import {publicV3Catalog,v3Catalog} from '../server/v3-catalog.mjs';
import {createLocalServer} from '../local-server.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [slice,review,manifest]=await Promise.all([json('../content-src/beta-slice-v2.json'),json('../content-src/beta-slice-v2-review.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/fetch-manifest.json')]);

test('scoped beta review is hash-bound and rejects stale source evidence',()=>{
 assert.deepEqual(validateBetaReview(review,slice,manifest),[]);
 const stale=structuredClone(manifest);stale.sources.find(source=>source.key==='moves').sha256='changed';assert.match(validateBetaReview(review,slice,stale).join('\n'),/source hash mismatch for moves/);
});

test('promoted schema-3 catalog exposes only the reviewed beta slice',()=>{
 assert.equal(v3Catalog.metadata.schemaVersion,3);assert.equal(v3Catalog.metadata.catalogVersion,'pv-ma-2026-09-12-beta2-beta-slice-v2-mega-beta-v1');assert.equal(v3Catalog.species.length,12);assert.equal(v3Catalog.megaForms.length,1);assert.equal(v3Catalog.moves.length,29);assert.equal(v3Catalog.abilities.length,5);assert.equal(v3Catalog.items.length,12);assert.equal(v3Catalog.starterTeamSpeciesIds.length,6);assert.equal(v3Catalog.regulations[0].megaCount,1);
 assert.equal(v3Catalog.coverage.singleSupported,true);assert.equal(v3Catalog.coverage.doubleSupported,true);assert.ok(v3Catalog.species.every(species=>Object.values(species.defaultBuild.statPoints).reduce((sum,value)=>sum+value,0)===66));
 assert.ok(v3Catalog.moves.every(move=>move.mechanics));assert.ok(publicV3Catalog.moves.every(move=>move.mechanics===undefined));assert.ok(publicV3Catalog.species.every(species=>species.regulationSets.includes('m-a')));
 assert.equal(v3Catalog.speciesById['venusaur-mega'].baseStats.def,123);assert.equal(v3Catalog.abilitiesById['thick-fat'].mechanics.handlers[0].id,'received-type-damage-reduction');assert.equal(publicV3Catalog.abilities.find(entry=>entry.id==='thick-fat').mechanics,undefined);
});

test('local server serves the active schema-3 catalog as read-only data',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vanguard-v3-catalog-')),app=createLocalServer({saveDir:dir});try{const port=await app.listen(0),response=await fetch(`http://127.0.0.1:${port}/api/v3/catalog`),body=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(body.metadata.catalogVersion,v3Catalog.metadata.catalogVersion);assert.equal(body.species.length,12);}finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
