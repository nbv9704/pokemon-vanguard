import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {sha256} from './snapshot.mjs';
import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';

const TYPES=new Set(CANONICAL_TYPES);
const CATEGORIES=new Set(['physical','special','status']);
const STATS=['hp','atk','def','spa','spd','spe'];
const duplicateIds=entries=>entries.map(entry=>entry.id).filter((id,index,ids)=>ids.indexOf(id)!==index);

export function validateNormalizedCandidate({species,moves,abilities,items,rosterRanch,unresolved},regulation='m-a'){
 const problems=[];
 const moveIds=new Set(moves.map(entry=>entry.id)),abilityIds=new Set(abilities.map(entry=>entry.id));
 for(const [label,entries] of Object.entries({species,moves,abilities,items}))for(const id of duplicateIds(entries))problems.push(`${label} has duplicate id ${id}`);
 for(const entry of species){
  if(entry.id!==entry.sourceSlug)problems.push(`${entry.id} does not preserve sourceSlug as candidate id`);
  if(entry.types.length<1||entry.types.length>2||new Set(entry.types).size!==entry.types.length||entry.types.some(type=>!TYPES.has(type)))problems.push(`${entry.id} has invalid types`);
  if(STATS.some(stat=>!Number.isInteger(entry.baseStats?.[stat])||entry.baseStats[stat]<1))problems.push(`${entry.id} has invalid base stats`);
  if(!entry.regulationSets.includes(regulation))problems.push(`${entry.id} is outside ${regulation}`);
  for(const id of entry.moveIds)if(!moveIds.has(id))problems.push(`${entry.id} references missing move ${id}`);
  for(const id of entry.abilityIds)if(!abilityIds.has(id))problems.push(`${entry.id} references missing Ability ${id}`);
 }
 for(const entry of moves){
  if(!TYPES.has(entry.type))problems.push(`${entry.id} has invalid move type ${entry.type}`);
  if(!CATEGORIES.has(entry.category))problems.push(`${entry.id} has invalid category ${entry.category}`);
  if(!Number.isInteger(entry.maxPP)||entry.maxPP<1)problems.push(`${entry.id} has invalid PP`);
  if(entry.power!==null&&(!Number.isInteger(entry.power)||entry.power<0))problems.push(`${entry.id} has invalid power`);
  if(entry.accuracy!==null&&(!Number.isInteger(entry.accuracy)||entry.accuracy<1||entry.accuracy>100))problems.push(`${entry.id} has invalid accuracy`);
 }
 for(const entry of items)if(typeof entry.availableInChampions!=='boolean'||typeof entry.implemented!=='boolean')problems.push(`${entry.id} has invalid availability state`);
 for(const banner of rosterRanch.banners){
  if(!Number.isInteger(banner.pullCount)||banner.pullCount<1)problems.push(`${banner.id} has invalid pull count`);
  if(!Array.isArray(banner.poolSpeciesIds)||!banner.poolSpeciesIds.length)problems.push(`${banner.id} has an empty pool`);
 }
 if(unresolved.length)problems.push(`${unresolved.length} unresolved source references remain`);
 return problems;
}

const loadJson=file=>readFile(file,'utf8').then(JSON.parse);
export async function validateCandidateDirectory(candidateRoot){
 const normalized=path.join(candidateRoot,'normalized');
 const [manifest,provenance,species,moves,abilities,items,rosterRanch,unresolved]=await Promise.all(['fetch-manifest.json','normalized/provenance.json','normalized/species.json','normalized/moves.json','normalized/abilities.json','normalized/items.json','normalized/roster-banners.json','normalized/unresolved.json'].map(file=>loadJson(path.join(candidateRoot,file))));
 const problems=validateNormalizedCandidate({species,moves,abilities,items,rosterRanch,unresolved},provenance.regulation);
 for(const source of manifest.sources){
  const body=await readFile(path.join(candidateRoot,source.filename));
  if(body.length!==source.bytes)problems.push(`${source.key} byte length differs from fetch manifest`);
  if(sha256(body)!==source.sha256)problems.push(`${source.key} hash differs from fetch manifest`);
 }
 const summary={snapshotId:manifest.snapshotId,regulation:provenance.regulation,valid:problems.length===0,reviewStatus:'pending',counts:provenance.counts,problems};
 const lines=[`# Candidate ${summary.snapshotId} / ${summary.regulation}`,'',`Validation: **${summary.valid?'PASS':'FAIL'}**`,'','Manual review: **pending**','','## Counts','',...Object.entries(summary.counts).map(([key,value])=>`- ${key}: ${value}`),'','## Safety gates','','- Raw source byte lengths and SHA-256 hashes verified.','- Species move and Ability references resolved.','- Canonical types, categories and base-stat shapes checked.','- Imported moves, Abilities and items remain disabled until mechanic handlers pass tests.','- Candidate has not been promoted to runtime content.','',`## Problems`,'',...(problems.length?problems.map(problem=>`- ${problem}`):['- None.']),''];
 await writeFile(path.join(normalized,'candidate-report.md'),lines.join('\n'));
 return summary;
}
