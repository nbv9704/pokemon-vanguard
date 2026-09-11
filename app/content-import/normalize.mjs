import {extractDocs,extractRosterRanch,resolveRscReference} from './rsc-parser.mjs';

const STAT_FIELDS={hp:'hp',attack:'atk',defense:'def',specialAttack:'spa',specialDefense:'spd',speed:'spe'};
const valueSlug=value=>typeof value==='string'?value.toLowerCase():value?.slug||value?.name?.toLowerCase().replaceAll(' ','-');

function resolvedList(values,rows,owner,kind,unresolved){
 const result=[];
 for(const value of values||[]){
  const resolved=resolveRscReference(value,rows);
  const slug=valueSlug(resolved);
  if(slug)result.push(slug);else unresolved.push({owner,kind,reference:value});
 }
 return [...new Set(result)];
}

export function normalizeSpeciesPage(html,{regulation='m-a'}={}){
 const {docs,rows}=extractDocs(html),unresolved=[];
 const sourceBySlug=new Map(docs.map(entry=>[entry.slug,entry]));
 const species=[];
 for(const entry of docs){
  const regulationSets=resolvedList(entry.regulationSets,rows,entry.slug,'regulation',unresolved);
  if(entry.isMega||!regulationSets.includes(regulation))continue;
  const baseStats={};for(const [source,target] of Object.entries(STAT_FIELDS))baseStats[target]=entry[source];
  species.push({id:entry.slug,sourceSlug:entry.slug,sourceId:entry.id,dexNumber:entry.nationalNumber,formId:entry.slug,name:entry.name,types:resolvedList(entry.type,rows,entry.slug,'type',unresolved),baseStats,regulationSets,moveIds:resolvedList(entry.moves,rows,entry.slug,'move',unresolved),abilityIds:resolvedList(entry.abilities,rows,entry.slug,'ability',unresolved),spriteKey:entry.slug});
 }
 species.sort((a,b)=>a.dexNumber-b.dexNumber||a.id.localeCompare(b.id));
 return {species,sourceBySlug,rows,unresolved};
}

export function normalizeMovesPage(html,allowedIds){
 const {docs,rows}=extractDocs(html);
 return docs.filter(entry=>allowedIds.has(entry.slug)).map(entry=>({id:entry.slug,sourceSlug:entry.slug,sourceId:entry.id,name:entry.name,type:valueSlug(resolveRscReference(entry.type,rows)),category:valueSlug(resolveRscReference(entry.damageClass,rows)),power:Number(entry.power)>0?entry.power:null,accuracy:Number(entry.accuracy)>0?entry.accuracy:null,maxPP:entry.pp,description:entry.description||'',implemented:false,mechanics:null})).sort((a,b)=>a.id.localeCompare(b.id));
}

export function normalizeAbilitiesPage(html,allowedIds){
 const {docs}=extractDocs(html);
 return docs.filter(entry=>allowedIds.has(entry.slug)).map(entry=>({id:entry.slug,sourceSlug:entry.slug,sourceId:entry.id,name:entry.name,description:entry.description||'',isMegaAbility:Boolean(entry.isMegaAbility),implemented:false,mechanics:null})).sort((a,b)=>a.id.localeCompare(b.id));
}

export function normalizeItemsPage(html){
 const {docs,rows}=extractDocs(html);
 return docs.map(entry=>({id:entry.slug,sourceSlug:entry.slug,sourceId:entry.id,name:entry.name,description:entry.description||'',category:valueSlug(resolveRscReference(entry.category,rows)),availableInChampions:Boolean(entry.availableInChampions),unlock:entry.unlock??null,implemented:false,legalByRegulation:{},mechanics:null})).sort((a,b)=>a.id.localeCompare(b.id));
}

export function normalizeRosterRanchPage(html){
 const {rosters,defaultRosterId}=extractRosterRanch(html);
 return {defaultSourceId:defaultRosterId,banners:rosters.map(entry=>({id:entry.slug,sourceSlug:entry.slug,sourceId:entry.id,name:entry.name,startAt:entry.startDate??null,endAt:entry.endDate??null,kind:entry.kind??'standard',pullCount:10,poolSpeciesIds:[...new Set((entry.pokemon||[]).map(mon=>mon.slug).filter(Boolean))]}))};
}
