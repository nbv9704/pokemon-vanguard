import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {v3Catalog} from '../server/v3-catalog.mjs';

const slice=JSON.parse(await readFile(new URL('../content-src/beta-slice-v35.json',import.meta.url),'utf8'));
const canonical=JSON.parse(await readFile(new URL('../content-src/ma-canonical-v1.json',import.meta.url),'utf8'));
const foundation=JSON.parse(await readFile(new URL('../content-src/battle-foundation-v1.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const wave=['aegislash','archaludon','armarouge','bellibolt','castform','ceruledge','ditto','espathra','farigiraf','gourgeist-jumbo','gourgeist-large','gourgeist-small','hydrapple','kingambit','maushold','mimikyu','morpeko','orthworm','palafin','rotom','rotom-fan','rotom-frost','rotom-heat','rotom-mow','rotom-wash','sinistcha','tinkaton','zoroark','zoroark-hisui'];

test('r3-nonmega-ma-wave6 closes the canonical 213-entry non-Mega selector',()=>{
 assert.equal(v3Catalog.species.length,213);assert.equal(slice.completeSpeciesIds.length,213);assert.deepEqual(new Set(v3Catalog.species.map(x=>x.id)),new Set(canonical.expectedNonMegaIds));
 for(const id of wave){assert.ok(v3Catalog.speciesById[id]?.enabledForBattle,id);assert.ok(slice.completeSpeciesIds.includes(id),id);}
 for(const id of ['aegislash-blade','aegislash-shield','lycanroc','castform-sunny','castform-rainy','castform-snowy','mimikyu-busted','morpeko-hangry','palafin-hero'])assert.equal(v3Catalog.speciesById[id],undefined,id);
});

test('r3-nonmega-ma-wave6 keeps Rotom as six independent roster entries with appliance stats and signature moves',()=>{
 const base=v3Catalog.speciesById.rotom;assert.deepEqual(base.baseStats,{hp:50,atk:50,def:77,spa:95,spd:77,spe:91});
 const signatures={'rotom-heat':'overheat','rotom-wash':'hydro-pump','rotom-frost':'blizzard','rotom-fan':'air-slash','rotom-mow':'leaf-storm'};
 for(const [id,signature] of Object.entries(signatures)){const mon=v3Catalog.speciesById[id];assert.deepEqual(mon.baseStats,{hp:50,atk:65,def:107,spa:105,spd:107,spe:86},id);assert.ok(mon.moveIds.includes(signature),`${id}:${signature}`);for(const other of Object.values(signatures))if(other!==signature)assert.equal(mon.moveIds.includes(other),false,`${id} must not inherit ${other}`);}
});

test('r3-nonmega-ma-wave6 keeps dynamic battle forms internal and foundation-complete',()=>{
 const required=['castform','castform-sunny','castform-rainy','castform-snowy','aegislash','aegislash-blade','aegislash-shield','mimikyu','mimikyu-busted','morpeko','morpeko-hangry','palafin','palafin-hero'];for(const id of required)assert.ok(foundation.species[id],id);
 assert.deepEqual(manifests.abilities['stance-change'].handlers[0].params.attackForm.baseStats,{hp:60,atk:140,def:50,spa:140,spd:50,spe:60});assert.deepEqual(manifests.abilities['stance-change'].handlers[0].params.shieldForm.baseStats,{hp:60,atk:50,def:140,spa:50,spd:140,spe:60});
 assert.deepEqual(manifests.abilities['zero-to-hero'].handlers[0].params.form.baseStats,{hp:100,atk:160,def:97,spa:106,spd:87,spe:100});
});

test('r3-nonmega-ma-wave6 locks Ditto one-move and Gourgeist Champions size contracts',()=>{
 const ditto=v3Catalog.speciesById.ditto;assert.deepEqual(ditto.moveIds,['transform']);assert.deepEqual(ditto.abilityIds.sort(),['imposter','limber']);assert.deepEqual(ditto.defaultBuild.moveIds,['transform']);
 const sizes={gourgeist:{hp:65,atk:90,def:122,spa:58,spd:75,spe:84},'gourgeist-small':{hp:55,atk:85,def:122,spa:58,spd:75,spe:99},'gourgeist-large':{hp:75,atk:95,def:122,spa:58,spd:75,spe:69},'gourgeist-jumbo':{hp:85,atk:100,def:122,spa:58,spd:75,spe:54}};for(const [id,stats] of Object.entries(sizes))assert.deepEqual(v3Catalog.speciesById[id].baseStats,stats,id);
 assert.equal(foundation.species['gourgeist-small'].weightKg,9.5);assert.equal(foundation.species['gourgeist-large'].weightKg,14);assert.equal(foundation.species['gourgeist-jumbo'].weightKg,39);
});
