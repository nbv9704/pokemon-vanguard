import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {extractDocs,resolveRscReference} from '../content-import/rsc-parser.mjs';
import {normalizeAbilitiesPage,normalizeItemsPage,normalizeMovesPage,normalizeRosterRanchPage,normalizeSpeciesPage} from '../content-import/normalize.mjs';
import {fetchSnapshot,sha256} from '../content-import/snapshot.mjs';
import {validateNormalizedCandidate} from '../content-import/validate-candidate.mjs';

const rscHtml=props=>`<!doctype html><script>self.__next_f.push(${JSON.stringify([1,`6:${JSON.stringify(['$','$L1',null,props])}`])})</script>`;
const type={name:'Poison',slug:'poison',id:'type-poison'};
const move={name:'Dire Claw',slug:'dire-claw',id:'move-dire-claw'};
const ability={name:'Unburden',slug:'unburden',id:'ability-unburden'};
const pokemonHtml=rscHtml({data:{docs:[
 {name:'Fixture Base',nationalNumber:1,slug:'fixture-base',type:[type],moves:[move],abilities:[ability],hp:50,attack:60,defense:70,specialAttack:80,specialDefense:90,speed:100,regulationSets:[{name:'M-A',slug:'m-a'}],isMega:false,id:'species-base'},
 {name:'Fixture Form',nationalNumber:1,slug:'fixture-form',type:['$6:props:data:docs:0:type:0'],moves:['$6:props:data:docs:0:moves:0'],abilities:['$6:props:data:docs:0:abilities:0'],hp:51,attack:61,defense:71,specialAttack:81,specialDefense:91,speed:101,regulationSets:['$6:props:data:docs:0:regulationSets:0'],isMega:false,id:'species-form'},
 {name:'Other Regulation',nationalNumber:2,slug:'other-regulation',type:[type],moves:[move],abilities:[ability],hp:1,attack:1,defense:1,specialAttack:1,specialDefense:1,speed:1,regulationSets:[{name:'M-B',slug:'m-b'}],isMega:false,id:'species-other'}
]}});

test('RSC parser extracts component data and resolves form references',()=>{
 const {docs,rows}=extractDocs(pokemonHtml);
 assert.equal(docs.length,3);
 assert.deepEqual(resolveRscReference(docs[1].type[0],rows),type);
 const result=normalizeSpeciesPage(pokemonHtml);
 assert.deepEqual(result.species.map(entry=>entry.id),['fixture-base','fixture-form']);
 assert.deepEqual(result.species[1].types,['poison']);
 assert.deepEqual(result.species[1].moveIds,['dire-claw']);
 assert.deepEqual(result.species[1].baseStats,{hp:51,atk:61,def:71,spa:81,spd:91,spe:101});
 assert.deepEqual(result.unresolved,[]);
});

test('candidate normalizers retain descriptions but keep mechanics disabled',()=>{
 const moves=normalizeMovesPage(rscHtml({data:{docs:[{...move,type:{name:'Poison',slug:'poison'},damageClass:{name:'Physical',slug:'physical'},power:80,accuracy:100,pp:24,description:'May inflict a status.'},{name:'Fixture Move',slug:'fixture-move',id:'move-fixture',type:'$6:props:data:docs:0:type',damageClass:'$6:props:data:docs:0:damageClass',power:0,accuracy:0,pp:1}]}}),new Set(['dire-claw','fixture-move']));
 const abilities=normalizeAbilitiesPage(rscHtml({data:{docs:[{...ability,description:'Raises Speed after losing an item.',isMegaAbility:false}]}}),new Set(['unburden']));
 const items=normalizeItemsPage(rscHtml({data:{docs:[{name:'Sitrus Berry',slug:'sitrus-berry',id:'item-sitrus',description:'Restores HP.',category:'berry',availableInChampions:true,unlock:'beginning'}]}}));
 assert.equal(moves[0].implemented,false);assert.equal(moves[0].mechanics,null);
 assert.equal(moves[1].type,'poison');assert.equal(moves[1].category,'physical');
 assert.equal(moves[1].power,null);assert.equal(moves[1].accuracy,null);
 assert.equal(abilities[0].implemented,false);assert.equal(abilities[0].mechanics,null);
 assert.deepEqual(items[0].legalByRegulation,{});assert.equal(items[0].availableInChampions,true);
});

test('Roster Ranch normalizer produces dated, banner-owned ten-pull pools',()=>{
 const result=normalizeRosterRanchPage(rscHtml({rosterSummaries:[{name:'Regular Roster M-A',slug:'regular-roster-m-a',id:'banner-a',startDate:'2026-04-08T12:00:00.000Z',endDate:'2026-06-17T12:00:00.000Z',kind:'standard',pokemon:[{slug:'fixture-base'},{slug:'fixture-form'}]}],defaultRosterId:'banner-a'}));
 assert.equal(result.banners[0].pullCount,10);
 assert.deepEqual(result.banners[0].poolSpeciesIds,['fixture-base','fixture-form']);
});

test('snapshot fetch writes hashes once and refuses to replace an immutable snapshot',async()=>{
 const appRoot=await mkdtemp(path.join(os.tmpdir(),'pv-import-'));
 await mkdir(path.join(appRoot,'content-src'),{recursive:true});
 await writeFile(path.join(appRoot,'content-src','pokemon-sources.json'),JSON.stringify({targetGame:'Pokémon Vanguard',initialRegulation:'m-a',sources:{pokemon:'https://fixture.invalid/pokemon'}}));
 let calls=0;const body=Buffer.from('fixture response');
 const fetchFn=async()=>{calls++;return new Response(body,{status:200,headers:{etag:'fixture-v1'}});};
 const first=await fetchSnapshot({appRoot,snapshotId:'fixture-2026-09-11',fetchFn,now:()=>new Date('2026-09-11T00:00:00.000Z')});
 assert.equal(first.manifest.sources[0].sha256,sha256(body));
 assert.equal(await readFile(path.join(first.candidateRoot,'raw','pokemon.html'),'utf8'),'fixture response');
 await assert.rejects(()=>fetchSnapshot({appRoot,snapshotId:'fixture-2026-09-11',fetchFn}),/already exists/);
 assert.equal(calls,1);
});

test('candidate validation blocks broken mechanics metadata and references',()=>{
 const fixture={species:[{id:'fixture',sourceSlug:'fixture',types:['poison'],baseStats:{hp:1,atk:1,def:1,spa:1,spd:1,spe:1},regulationSets:['m-a'],moveIds:['dire-claw'],abilityIds:['unburden']}],moves:[{id:'dire-claw',type:'poison',category:'physical',maxPP:24,power:80,accuracy:100}],abilities:[{id:'unburden'}],items:[{id:'sitrus-berry',availableInChampions:true,implemented:false}],rosterRanch:{banners:[{id:'regular-roster-m-a',pullCount:10,poolSpeciesIds:['fixture']}]},unresolved:[]};
 assert.deepEqual(validateNormalizedCandidate(fixture),[]);
 fixture.species[0].moveIds=['missing'];fixture.moves[0].type='unknown';fixture.unresolved.push({kind:'type'});
 const problems=validateNormalizedCandidate(fixture).join('\n');
 assert.match(problems,/missing move/);assert.match(problems,/invalid move type/);assert.match(problems,/unresolved source/);
});
