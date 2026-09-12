import {validateBetaReview} from './beta-review.mjs';

const byId=list=>new Map(list.map(entry=>[entry.id,entry]));
const unique=list=>[...new Set(list)];

export function buildPromotedBetaCatalog({slice,review,fetchManifest,catalog,manifests,coverage,rules}){
 const problems=validateBetaReview(review,slice,fetchManifest);if(problems.length)throw new Error(problems.join('; '));
 const speciesById=byId(catalog.species),moveById=byId(catalog.moves),abilityById=byId(catalog.abilities),itemById=byId(catalog.items);
 const moveIds=unique(slice.team.flatMap(member=>member.moveIds)).sort(),abilityIds=unique(slice.team.map(member=>member.abilityId)).sort(),itemIds=unique(slice.team.map(member=>member.itemId)).sort();
 const enabled=(entry,manifest)=>({...structuredClone(entry),implemented:true,enabledForBattle:true,mechanics:structuredClone(manifest)});
 const species=slice.team.map(member=>{const source=speciesById.get(member.speciesId);return {...structuredClone(source),enabledForBattle:true,defaultBuild:{name:`${source.name} Beta`,natureId:member.natureId,statPoints:structuredClone(member.statPoints),moveIds:[...member.moveIds],abilityId:member.abilityId,itemId:member.itemId}};});
 const moves=moveIds.map(id=>enabled(moveById.get(id),manifests.moves[id])),abilities=abilityIds.map(id=>enabled(abilityById.get(id),manifests.abilities[id])),items=itemIds.map(id=>enabled(itemById.get(id),manifests.items[id]));
 const enabledKeys=new Set([...moveIds.map(id=>`move:${id}`),...abilityIds.map(id=>`ability:${id}`),...itemIds.map(id=>`item:${id}`)]),coverageEntries=coverage.entries.filter(entry=>enabledKeys.has(`${entry.kind}:${entry.id}`));
 return {metadata:{schemaVersion:3,catalogVersion:`${slice.snapshotId}-${slice.id}`,rulesVersion:rules.rulesVersion,snapshotId:slice.snapshotId,sliceId:slice.id,regulationSet:slice.regulationSet,reviewedAt:review.reviewedAt,reviewStatus:review.status},regulations:[{id:'m-a-beta',name:'Regulation M-A Beta',formats:['single','double'],rosterSize:6,pick:{single:3,double:4},lead:{single:1,double:2},level:rules.battleLevel,statPointBudget:rules.statPointBudget,statPointCap:rules.statPointCap,speciesClause:true,itemClause:true,megaCount:0}],species,moves,abilities,items,coverage:{singleSupported:coverageEntries.every(entry=>entry.formats.single.supported),doubleSupported:coverageEntries.every(entry=>entry.formats.double.supported),entries:coverageEntries}};
}

export function publicBetaCatalog(catalog){
 const stripMechanics=entry=>{const {mechanics,...publicEntry}=entry;return publicEntry;};
 return {...catalog,moves:catalog.moves.map(stripMechanics),abilities:catalog.abilities.map(stripMechanics),items:catalog.items.map(stripMechanics)};
}
