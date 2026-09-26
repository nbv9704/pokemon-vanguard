import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyMaCanonicalOverlay} from '../content-import/ma-canonical.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {loadMegaBetaCatalog} from '../server/v3-mega-catalog.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [rawSpecies,canonical]=await Promise.all([json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/species.json'),json('../content-src/ma-canonical-v1.json')]);
const candidateSpecies=applyMaCanonicalOverlay(rawSpecies,canonical),mega=loadMegaBetaCatalog();
const mANonMega=candidateSpecies.filter(entry=>entry.regulationSets?.includes('m-a'));
const mAMega=mega.relations.filter(entry=>entry.regulationSets?.includes('m-a'));
const mAMegaForms=new Set(mAMega.map(entry=>entry.megaSpeciesId));
const mAMegaBases=new Set(mAMega.map(entry=>entry.baseSpeciesId));


test('R3-91 locks Regulation M-A to the exact canonical 213 non-Mega + 59 Mega entries',()=>{
 assert.equal(mANonMega.length,213);assert.deepEqual(mANonMega.map(entry=>entry.id).sort(),[...canonical.expectedNonMegaIds].sort());assert.equal(mAMega.length,59);assert.equal(mAMegaForms.size,59);assert.equal(mAMegaBases.size,58);assert.equal(mANonMega.length+mAMegaForms.size,272);
 for(const id of canonical.excludedSnapshotIds)assert.ok(!mANonMega.some(entry=>entry.id===id),id);
 for(const form of canonical.addedForms)assert.ok(mANonMega.some(entry=>entry.id===form.id),form.id);
 const charizard=mAMega.filter(entry=>entry.baseSpeciesId==='charizard');assert.equal(charizard.length,2);assert.deepEqual(new Set(charizard.map(entry=>entry.megaSpeciesId)),new Set(['charizard-mega-x','charizard-mega-y']));
});

test('M-A runtime exposes 59 legal Mega forms while retaining five later-regulation implementations in source data',()=>{
 assert.equal(mega.relations.length,64);assert.equal(mega.forms.length,64);assert.equal(v3Catalog.megaRelations.length,59);assert.equal(v3Catalog.megaForms.length,59);
 const expected=new Map([['raichu-mega-x','m-b'],['raichu-mega-y','m-b'],['absol-mega-z','m-c'],['garchomp-mega-z','m-c'],['lucario-mega-z','m-c']]);
 for(const [id,regulation] of expected){const relation=mega.relations.find(entry=>entry.megaSpeciesId===id);assert.deepEqual(relation?.regulationSets,[regulation],id);assert.equal(v3Catalog.speciesById[id],undefined,id);assert.ok(!v3Catalog.megaRelations.some(entry=>entry.megaSpeciesId===id),id);}
});

test('R3-91 completes every canonical non-Mega M-A selector entry',()=>{
 const complete=new Set(v3Catalog.contentCompleteness.speciesIds),runtimeIds=new Set(v3Catalog.species.map(entry=>entry.id));
 assert.equal(complete.size,213);assert.equal(runtimeIds.size,213);assert.deepEqual([...runtimeIds].sort(),[...canonical.expectedNonMegaIds].sort());assert.deepEqual([...complete].sort(),[...canonical.expectedNonMegaIds].sort());
 for(const id of ['ditto','castform','rotom-wash','aegislash','palafin','gourgeist-small','gourgeist-large','gourgeist-jumbo'])assert.ok(complete.has(id),id);
 for(const id of ['aegislash-blade','aegislash-shield','lycanroc'])assert.ok(!runtimeIds.has(id),id);
});

test('canonical Rotom entries share the common Champions pool plus exactly their appliance signature',()=>{
 const signatures=new Map(Object.entries(canonical.rotomSignatures)),allSignatures=new Set([...signatures.values()].filter(Boolean));
 const base=mANonMega.find(entry=>entry.id==='rotom'),common=new Set(base.moveIds);
 for(const [id,signature] of signatures){const form=mANonMega.find(entry=>entry.id===id);assert.ok(form,id);for(const moveId of form.moveIds)if(moveId!==signature)assert.ok(common.has(moveId),`${id}:${moveId}`);for(const other of allSignatures)assert.equal(form.moveIds.includes(other),other===signature,`${id}:${other}`);}
});
