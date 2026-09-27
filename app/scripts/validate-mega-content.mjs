import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadMegaBetaCatalog} from '../server/v3-mega-catalog.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=file=>readFile(file,'utf8').then(JSON.parse);
const active=await readJson(path.join(root,'content-active','active.json'));
const catalog=await readJson(path.join(root,'content-active',active.catalogFile));
const mega=loadMegaBetaCatalog(),regulationSet=catalog.regulations?.[0]?.id;
const candidateSpecies=await readJson(path.join(root,'content-validation',catalog.metadata.snapshotId,'normalized','species.json'));
const candidateById=new Map(candidateSpecies.map(entry=>[entry.id,entry]));
const activeSpecies=new Set((catalog.species||[]).map(entry=>entry.id));
const activeMoves=new Set((catalog.moves||[]).map(entry=>entry.id));
const activeAbilities=new Set((catalog.abilities||[]).map(entry=>entry.id));
const completeSpecies=new Set(catalog.contentCompleteness?.speciesIds||[]);
const legalRelations=(mega.relations||[]).filter(entry=>(entry.regulationSets||[]).some(id=>regulationSet===id||regulationSet.startsWith(`${id}-`)||regulationSet.startsWith(id))); 
const legalFormIds=new Set(legalRelations.map(entry=>entry.megaSpeciesId)),legalItemIds=new Set(legalRelations.map(entry=>entry.itemId));
const legalForms=(mega.forms||[]).filter(entry=>legalFormIds.has(entry.id));
const forms=new Set(legalForms.map(entry=>entry.id));
const stones=new Set((mega.items||[]).filter(entry=>legalItemIds.has(entry.id)).map(entry=>entry.id));
const problems=[];
for(const form of legalForms)if(form.spriteKey!==form.id)problems.push(`Mega form ${form.id} must use its own spriteKey, got ${form.spriteKey||'missing'}`);
for(const relation of legalRelations){
 const {baseSpeciesId,megaSpeciesId,itemId}=relation;
 if(!activeSpecies.has(baseSpeciesId))problems.push(`Mega relation ${megaSpeciesId} missing playable base species ${baseSpeciesId}`);
 if(!completeSpecies.has(baseSpeciesId))problems.push(`Mega relation ${megaSpeciesId} base species is not content-complete: ${baseSpeciesId}`);
 if(!forms.has(megaSpeciesId))problems.push(`Mega relation missing form: ${megaSpeciesId}`);
 if(!stones.has(itemId))problems.push(`Mega relation missing stone: ${itemId}`);
 const source=candidateById.get(baseSpeciesId);if(!source){problems.push(`Mega base species missing from candidate snapshot: ${baseSpeciesId}`);continue;}
 for(const moveId of source.moveIds||[])if(!activeMoves.has(moveId))problems.push(`Mega base ${baseSpeciesId} missing legal move from active catalog: ${moveId}`);
 for(const abilityId of source.abilityIds||[])if(!activeAbilities.has(abilityId))problems.push(`Mega base ${baseSpeciesId} missing legal ability from active catalog: ${abilityId}`);
}
const relationBases=[...new Set(legalRelations.map(entry=>entry.baseSpeciesId))];
if(problems.length)throw new Error(`Mega content validation failed:\n${problems.map(problem=>`  • ${problem}`).join('\n')}`);
console.log(`mega content OK — ${regulationSet}: ${relationBases.length}/${relationBases.length} promoted Mega bases content-complete; ${legalRelations.length} legal Mega relations; ${completeSpecies.size} total content-complete species`);
