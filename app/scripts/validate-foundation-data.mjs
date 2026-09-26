import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {effectiveWeightKg,flingItemMetadata} from '../mechanics-v3/foundation-data.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=file=>readFile(file,'utf8').then(JSON.parse);
const foundation=await readJson(path.join(root,'content-src','battle-foundation-v1.json'));
const items=await readJson(path.join(root,'content-candidates','pv-ma-2026-09-12-beta2','normalized','items.json'));
const active=await readJson(path.join(root,'content-active','active.json'));
const activeCatalog=await readJson(path.join(root,'content-active',active.catalogFile));
const mega=await readJson(path.join(root,'content-src','mega-beta-v8.json'));
const problems=[];
if(foundation.schemaVersion!==1)problems.push('foundation schemaVersion must be 1');
const battleSpecies=[...(activeCatalog.species||[]),...(mega.forms||[])];
for(const species of battleSpecies){const entry=foundation.species?.[species.id];if(!entry)problems.push(`missing species foundation: ${species.id}`);else{if(!(Number(entry.heightM)>0))problems.push(`invalid height: ${species.id}`);if(!(Number(entry.weightKg)>0))problems.push(`invalid weight: ${species.id}`);const rate=entry.genderRate?.femaleEighths;if(!Number.isInteger(rate)||rate < -1||rate > 8)problems.push(`invalid gender rate: ${species.id}`);}}

for(const form of mega.forms||[]){
 const entry=foundation.species?.[form.id];
 if(!(Number(form.heightM)>0))problems.push(`Mega form missing explicit heightM: ${form.id}`);
 if(!(Number(form.weightKg)>0))problems.push(`Mega form missing explicit weightKg: ${form.id}`);
 if(entry&&Number(form.heightM)!==Number(entry.heightM))problems.push(`Mega height mismatch: ${form.id}`);
 if(entry&&Number(form.weightKg)!==Number(entry.weightKg))problems.push(`Mega weight mismatch: ${form.id}`);
}
const candidateIds=new Set(items.map(item=>item.id)),foundationIds=new Set(Object.keys(foundation.items||{}));
for(const id of candidateIds)if(!foundationIds.has(id))problems.push(`missing item foundation: ${id}`);
for(const id of foundationIds)if(!candidateIds.has(id))problems.push(`unexpected item foundation: ${id}`);
for(const item of items){const meta=flingItemMetadata(item.id);if(!meta){problems.push(`missing fling metadata: ${item.id}`);continue;}if(item.category==='mega-evolution'){if(meta.usable!==false||meta.basePower!==null)problems.push(`mega stone must be unflingable: ${item.id}`);}else{if(meta.usable!==true||!Number.isInteger(meta.basePower)||meta.basePower<1)problems.push(`invalid fling power: ${item.id}`);if(item.category==='berry'&&(meta.basePower!==10||meta.effect!=='berry'))problems.push(`berry fling contract mismatch: ${item.id}`);}}
for(const [id,effect] of Object.entries({'kings-rock':'flinch','light-ball':'paralysis','mental-herb':'mental-herb','poison-barb':'poison','white-herb':'white-herb'}))if(flingItemMetadata(id)?.effect!==effect)problems.push(`special fling effect mismatch: ${id}`);
if(effectiveWeightKg({weightKg:85.5,volatiles:{'weight-reduction':{reductionHg:1000}}})!==0.1)problems.push('Autotomize weight floor contract mismatch');
if(problems.length)throw new Error(`Foundation validation failed:\n${problems.map(x=>`  • ${x}`).join('\n')}`);
console.log(`foundation OK — ${battleSpecies.length} battle forms; ${candidateIds.size}/${candidateIds.size} candidate items`);
