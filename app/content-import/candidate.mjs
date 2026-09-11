import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {normalizeAbilitiesPage,normalizeItemsPage,normalizeMovesPage,normalizeRosterRanchPage,normalizeSpeciesPage} from './normalize.mjs';

const readUtf8=file=>readFile(file,'utf8');
const writeJson=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');

export async function buildCandidate({candidateRoot,regulation='m-a'}){
 const raw=name=>readUtf8(path.join(candidateRoot,'raw',`${name}.html`));
 const [pokemonHtml,movesHtml,abilitiesHtml,itemsHtml,ranchHtml,manifest]=await Promise.all([raw('pokemon'),raw('moves'),raw('abilities'),raw('items'),raw('rosterRanch'),readUtf8(path.join(candidateRoot,'fetch-manifest.json')).then(JSON.parse)]);
 const normalized=normalizeSpeciesPage(pokemonHtml,{regulation});
 const moveIds=new Set(normalized.species.flatMap(entry=>entry.moveIds));
 const abilityIds=new Set(normalized.species.flatMap(entry=>entry.abilityIds));
 const moves=normalizeMovesPage(movesHtml,moveIds),abilities=normalizeAbilitiesPage(abilitiesHtml,abilityIds),items=normalizeItemsPage(itemsHtml),rosterRanch=normalizeRosterRanchPage(ranchHtml);
 const foundMoveIds=new Set(moves.map(entry=>entry.id)),foundAbilityIds=new Set(abilities.map(entry=>entry.id));
 const unresolved=[...normalized.unresolved];
 for(const id of moveIds)if(!foundMoveIds.has(id))unresolved.push({owner:regulation,kind:'move-catalog',reference:id});
 for(const id of abilityIds)if(!foundAbilityIds.has(id))unresolved.push({owner:regulation,kind:'ability-catalog',reference:id});
 const outputRoot=path.join(candidateRoot,'normalized');await mkdir(outputRoot,{recursive:true});
 const provenance={schemaVersion:1,snapshotId:manifest.snapshotId,regulation,parserVersion:manifest.parserVersion,sourceManifest:'../fetch-manifest.json',counts:{species:normalized.species.length,moves:moves.length,abilities:abilities.length,items:items.length,banners:rosterRanch.banners.length,unresolved:unresolved.length}};
 await Promise.all([writeJson(path.join(outputRoot,'species.json'),normalized.species),writeJson(path.join(outputRoot,'moves.json'),moves),writeJson(path.join(outputRoot,'abilities.json'),abilities),writeJson(path.join(outputRoot,'items.json'),items),writeJson(path.join(outputRoot,'roster-banners.json'),rosterRanch),writeJson(path.join(outputRoot,'unresolved.json'),unresolved),writeJson(path.join(outputRoot,'provenance.json'),provenance)]);
 return {outputRoot,provenance,unresolved};
}
