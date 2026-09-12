import {NATURES,validateStatPoints} from '../rules-v3/stats.mjs';

const byId=list=>new Map((list||[]).map(entry=>[entry.id,entry]));

export function validateBetaSlice(slice,catalog,coverage){
 const problems=[],formats=slice?.formats,team=slice?.team;
 if(![1,2].includes(slice?.schemaVersion))problems.push('unsupported beta slice schemaVersion');
 if(typeof slice?.id!=='string'||!slice.id)problems.push('beta slice id is required');
 if(typeof slice?.snapshotId!=='string'||!slice.snapshotId)problems.push('beta slice snapshotId is required');
 if(slice?.regulationSet!=='m-a')problems.push('beta slice requires regulationSet m-a');
 if(!Array.isArray(formats)||formats.length!==2||!formats.includes('single')||!formats.includes('double'))problems.push('beta slice must support single and double');
 if(!Array.isArray(team)||(slice?.schemaVersion===1?team.length!==6:team.length<8||team.length>24))problems.push(slice?.schemaVersion===1?'beta slice requires exactly six team members':'beta slice v2 requires 8-24 catalog members');
 const starterIds=slice?.schemaVersion===2?slice.starterTeamSpeciesIds:team?.map(member=>member.speciesId);
 if(slice?.schemaVersion===2&&(!Array.isArray(starterIds)||starterIds.length!==6||new Set(starterIds).size!==6))problems.push('beta slice requires six distinct starterTeamSpeciesIds');
 if(slice?.schemaVersion===2&&Array.isArray(team)&&Array.isArray(starterIds)&&starterIds.some(id=>!team.some(member=>member.speciesId===id)))problems.push('starter team species must exist in the beta catalog');
 if(problems.length)return {ok:false,problems};
 const species=byId(catalog.species),moves=byId(catalog.moves),abilities=byId(catalog.abilities),items=byId(catalog.items),coverageByKey=new Map((coverage?.entries||[]).map(entry=>[`${entry.kind}:${entry.id}`,entry]));
 const seenSpecies=new Set(),starterItems=new Set(),allItems=new Set();
 for(const member of team){const mon=species.get(member.speciesId);
  if(!mon){problems.push(`unknown species ${member.speciesId}`);continue;}
  if(seenSpecies.has(mon.id))problems.push(`duplicate species ${mon.id}`);seenSpecies.add(mon.id);
  if(!mon.regulationSets?.includes(slice.regulationSet))problems.push(`${mon.id} is not in M-A`);
  if(!Array.isArray(member.moveIds)||member.moveIds.length!==4||new Set(member.moveIds).size!==4)problems.push(`${mon.id} requires four distinct moves`);
  const pointProblems=validateStatPoints(member.statPoints);if(pointProblems.length)problems.push(...pointProblems.map(problem=>`${mon.id} ${problem}`));
  else if(Object.values(member.statPoints).reduce((sum,value)=>sum+value,0)!==66)problems.push(`${mon.id} requires exactly 66 stat points`);
  if(!NATURES[member.natureId])problems.push(`${mon.id} has unknown nature ${member.natureId}`);
  for(const moveId of member.moveIds||[]){if(!moves.has(moveId)||!mon.moveIds.includes(moveId))problems.push(`${mon.id} cannot use ${moveId}`);else requireCoverage(coverageByKey,'move',moveId,formats,problems);}
  if(!abilities.has(member.abilityId)||!mon.abilityIds.includes(member.abilityId))problems.push(`${mon.id} cannot use ability ${member.abilityId}`);else requireCoverage(coverageByKey,'ability',member.abilityId,formats,problems);
  const item=items.get(member.itemId);if(!item)problems.push(`unknown item ${member.itemId}`);else if(item.availableInChampions!==true)problems.push(`item ${member.itemId} is unavailable in Champions`);else requireCoverage(coverageByKey,'item',member.itemId,formats,problems);
  if(member.itemId!=='none'){allItems.add(member.itemId);if(starterIds.includes(member.speciesId)){if(starterItems.has(member.itemId))problems.push(`duplicate held item ${member.itemId}`);starterItems.add(member.itemId);}}
 }
 const types=[...new Set(team.flatMap(member=>species.get(member.speciesId)?.types||[]))].sort();
 return {ok:problems.length===0,problems,summary:{members:team.length,starters:starterIds.length,types,moveIds:[...new Set(team.flatMap(member=>member.moveIds||[]))].sort(),abilityIds:[...new Set(team.map(member=>member.abilityId))].sort(),itemIds:[...allItems].sort()}};
}

function requireCoverage(index,kind,id,formats,problems){const entry=index.get(`${kind}:${id}`);for(const format of formats)if(!entry?.formats?.[format]?.supported)problems.push(`${kind} ${id} is blocked in ${format}: ${entry?.formats?.[format]?.reason||'missing-coverage'}`);}
