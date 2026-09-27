import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,validateMechanicManifest} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const items=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/items.json',import.meta.url),'utf8'));
const megaBeta=JSON.parse(await readFile(new URL('../content-src/mega-beta-v8.json',import.meta.url),'utf8'));
const megaItems=items.filter(item=>item.category==='mega-evolution');

for(const format of ['single','double'])test(`r3-item-review-wave9:${format} reviews every Mega Stone without pretending missing forms are executable`,()=>{
 assert.equal(megaItems.length,81);
 for(const item of megaItems){const manifest=manifests.items[item.id];assert.ok(manifest,item.id);assert.deepEqual(validateMechanicManifest(manifest,'items'),[],item.id);assert.ok(manifest.testEvidence[format]?.length,item.id);}
 const executable=megaItems.filter(item=>manifests.items[item.id].reviewState!=='fail-closed').map(item=>item.id).sort();assert.deepEqual(executable,megaBeta.relations.map(relation=>relation.itemId).sort());
 const failClosed=megaItems.filter(item=>manifests.items[item.id].reviewState==='fail-closed');assert.equal(failClosed.length,81-megaBeta.relations.length);assert.ok(failClosed.every(item=>manifests.items[item.id].reviewReason==='mega-relation-not-promoted'));assert.ok(failClosed.every(item=>manifests.items[item.id].testEvidence[format]?.includes(`r3-item-review-wave9:${format}`)));
});

test('every executable Mega Stone manifest matches a promoted Mega relation and form',()=>{
 for(const relation of megaBeta.relations){const manifest=manifests.items[relation.itemId],handler=manifest.handlers[0];assert.equal(handler.id,'mega-stone',relation.itemId);assert.equal(handler.params.baseSpeciesId,relation.baseSpeciesId);assert.equal(handler.params.megaSpeciesId,relation.megaSpeciesId);assert.ok(megaBeta.forms.some(form=>form.id===relation.megaSpeciesId),relation.megaSpeciesId);}
});

test('unpromoted Mega Stones fail closed if they accidentally reach battle passive compilation',()=>{
 assert.throws(()=>compilePassiveEffects({itemId:'barbaracite',manifests}),/unsupported item: barbaracite \(mega-relation-not-promoted\)/);
 for(const relation of megaBeta.relations)assert.doesNotThrow(()=>compilePassiveEffects({itemId:relation.itemId,manifests}),relation.itemId);
 assert.equal(manifests.items['eject-button']?.handlers?.[0]?.id,'item-holder-switch');
});
