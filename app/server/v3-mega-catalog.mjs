import {readFileSync} from 'node:fs';

const file=new URL('../content-src/mega-beta-v8.json',import.meta.url);

const clone=value=>structuredClone(value);

function upsertById(list,entries){
 const next=[...(list||[]).map(clone)],index=new Map(next.map((entry,position)=>[entry.id,position]));
 for(const entry of entries||[]){const value=clone(entry),position=index.get(value.id);if(position===undefined){index.set(value.id,next.length);next.push(value);}else next[position]={...next[position],...value};}
 return next;
}

function coverageEntry(kind,entry){
 return {kind,id:entry.id,name:entry.name,requiredHandlers:entry.mechanics.handlers.map(handler=>handler.id),formats:{single:{supported:true,reason:null},double:{supported:true,reason:null}},missingHandlers:[],manifestProblems:[]};
}

function upsertCoverage(list,entries){
 const next=[...(list||[]).map(clone)],index=new Map(next.map((entry,position)=>[`${entry.kind}:${entry.id}`,position]));
 for(const entry of entries){const key=`${entry.kind}:${entry.id}`,position=index.get(key);if(position===undefined){index.set(key,next.length);next.push(entry);}else next[position]={...next[position],...entry};}
 return next;
}

function supportsRegulation(relation,regulationSet){return (relation.regulationSets||[]).some(id=>regulationSet===id||regulationSet.startsWith(`${id}-`)||regulationSet.startsWith(id));}

export function loadMegaBetaCatalog(){return JSON.parse(readFileSync(file,'utf8'));}

export function extendCatalogWithMega(base,mega=loadMegaBetaCatalog()){
 const next=clone(base),regulation=next.regulations[0],regulationSet=regulation.id;
 const relations=(mega.relations||[]).filter(entry=>supportsRegulation(entry,regulationSet));
 const formIds=new Set(relations.map(entry=>entry.megaSpeciesId)),itemIds=new Set(relations.map(entry=>entry.itemId));
 const forms=(mega.forms||[]).filter(entry=>formIds.has(entry.id)),abilityIds=new Set(forms.map(entry=>entry.abilityId));
 const abilities=(mega.abilities||[]).filter(entry=>abilityIds.has(entry.id)),items=(mega.items||[]).filter(entry=>itemIds.has(entry.id));
 next.metadata.catalogVersion=`${next.metadata.catalogVersion}-${mega.id}`;
 next.metadata.megaCatalogId=mega.id;
 next.metadata.megaRegulationSet=regulationSet;
 next.regulations[0]={...regulation,megaCount:1};
 next.megaRelations=clone(relations);
 next.megaForms=clone(forms);
 next.abilities=upsertById(next.abilities,abilities);
 next.items=upsertById(next.items,items);
 next.coverage.entries=upsertCoverage(next.coverage.entries,[
  ...abilities.map(entry=>coverageEntry('ability',entry)),
  ...items.map(entry=>coverageEntry('item',entry))
 ]);
 return next;
}
