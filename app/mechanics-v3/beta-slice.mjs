import {NATURES,validateStatPoints} from '../rules-v3/stats.mjs';

const byId=list=>new Map((list||[]).map(entry=>[entry.id,entry]));
const MAX_EXPANDED_CATALOG_MEMBERS=256;

export function validateBetaSlice(slice,catalog,coverage){
 const problems=[],formats=slice?.formats,team=slice?.team,expanded=(slice?.schemaVersion||0)>=2;
 if(![1,2,3,4].includes(slice?.schemaVersion))problems.push('unsupported beta slice schemaVersion');
 if(typeof slice?.id!=='string'||!slice.id)problems.push('beta slice id is required');
 if(typeof slice?.snapshotId!=='string'||!slice.snapshotId)problems.push('beta slice snapshotId is required');
 if(slice?.regulationSet!=='m-a')problems.push('beta slice requires regulationSet m-a');
 if(!Array.isArray(formats)||formats.length!==2||!formats.includes('single')||!formats.includes('double'))problems.push('beta slice must support single and double');
 if(!Array.isArray(team)||(expanded?team.length<8||team.length>MAX_EXPANDED_CATALOG_MEMBERS:team.length!==6))problems.push(expanded?`expanded beta slice requires 8-${MAX_EXPANDED_CATALOG_MEMBERS} catalog members`:'beta slice requires exactly six team members');
 const starterIds=expanded?slice.starterTeamSpeciesIds:team?.map(member=>member.speciesId);
 if(expanded&&(!Array.isArray(starterIds)||starterIds.length!==6||new Set(starterIds).size!==6))problems.push('beta slice requires six distinct starterTeamSpeciesIds');
 if(expanded&&Array.isArray(team)&&Array.isArray(starterIds)&&starterIds.some(id=>!team.some(member=>member.speciesId===id)))problems.push('starter team species must exist in the beta catalog');
 if(problems.length)return {ok:false,problems};
 const species=byId(catalog.species),moves=byId(catalog.moves),abilities=byId(catalog.abilities),items=byId(catalog.items),coverageByKey=new Map((coverage?.entries||[]).map(entry=>[`${entry.kind}:${entry.id}`,entry]));
 const seenSpecies=new Set(),starterItems=new Set(),allItems=new Set();
 for(const member of team){const mon=species.get(member.speciesId);
  if(!mon){problems.push(`unknown species ${member.speciesId}`);continue;}
  if(seenSpecies.has(mon.id))problems.push(`duplicate species ${mon.id}`);seenSpecies.add(mon.id);
  if(!mon.regulationSets?.includes(slice.regulationSet))problems.push(`${mon.id} is not in M-A`);
  const requiredMoveCount=Math.min(4,mon.moveIds.length);if(!Array.isArray(member.moveIds)||member.moveIds.length!==requiredMoveCount||new Set(member.moveIds).size!==requiredMoveCount)problems.push(`${mon.id} requires ${requiredMoveCount} distinct move${requiredMoveCount===1?'':'s'}`);
  const pointProblems=validateStatPoints(member.statPoints);if(pointProblems.length)problems.push(...pointProblems.map(problem=>`${mon.id} ${problem}`));
  else if(Object.values(member.statPoints).reduce((sum,value)=>sum+value,0)!==66)problems.push(`${mon.id} requires exactly 66 stat points`);
  if(!NATURES[member.natureId])problems.push(`${mon.id} has unknown nature ${member.natureId}`);
  for(const moveId of member.moveIds||[]){if(!moves.has(moveId)||!mon.moveIds.includes(moveId))problems.push(`${mon.id} cannot use ${moveId}`);else requireCoverage(coverageByKey,'move',moveId,formats,problems);}
  if(!abilities.has(member.abilityId)||!mon.abilityIds.includes(member.abilityId))problems.push(`${mon.id} cannot use ability ${member.abilityId}`);else requireCoverage(coverageByKey,'ability',member.abilityId,formats,problems);
  const item=items.get(member.itemId);if(!item)problems.push(`unknown item ${member.itemId}`);else if(item.availableInChampions!==true)problems.push(`item ${member.itemId} is unavailable in Champions`);else requireCoverage(coverageByKey,'item',member.itemId,formats,problems);
  if(member.itemId!=='none'){allItems.add(member.itemId);if(starterIds.includes(member.speciesId)){if(starterItems.has(member.itemId))problems.push(`duplicate held item ${member.itemId}`);starterItems.add(member.itemId);}}
 }
 if(slice.schemaVersion>=3)validateEnabledContent(slice.enabledContent,{team,species,moves,abilities,items,coverageByKey,formats,problems});
 const enabled=slice.enabledContent||{},moveIds=[...new Set([...team.flatMap(member=>member.moveIds||[]),...(enabled.moveIds||[])])].sort(),abilityIds=[...new Set([...team.map(member=>member.abilityId),...(enabled.abilityIds||[])])].sort(),itemIds=[...new Set([...allItems,...(enabled.itemIds||[])])].sort();
 if(slice.schemaVersion>=4)validateCompleteSpecies(slice.completeSpeciesIds,{team,species,moves,abilities,coverageByKey,formats,moveIds,abilityIds,problems});
 const types=[...new Set(team.flatMap(member=>species.get(member.speciesId)?.types||[]))].sort();
 return {ok:problems.length===0,problems,summary:{members:team.length,starters:starterIds.length,types,moveIds,abilityIds,itemIds,completeSpeciesIds:[...(slice.completeSpeciesIds||[])]}};
}


function validateCompleteSpecies(ids,{team,species,moves,abilities,coverageByKey,formats,moveIds,abilityIds,problems}){
 if(!Array.isArray(ids)||ids.length===0||new Set(ids).size!==ids.length){problems.push('beta slice v4 requires distinct completeSpeciesIds');return;}
 const teamIds=new Set(team.map(member=>member.speciesId)),enabledMoves=new Set(moveIds),enabledAbilities=new Set(abilityIds);
 for(const id of ids){
  const mon=species.get(id);if(!mon){problems.push(`complete species ${id} is unknown`);continue;}
  if(!teamIds.has(id))problems.push(`complete species ${id} is not in the playable beta catalog`);
  for(const moveId of mon.moveIds||[]){if(!moves.has(moveId))problems.push(`complete species ${id} references unknown move ${moveId}`);if(!enabledMoves.has(moveId))problems.push(`complete species ${id} missing legal move ${moveId}`);else requireCoverage(coverageByKey,'move',moveId,formats,problems);}
  for(const abilityId of mon.abilityIds||[]){if(!abilities.has(abilityId))problems.push(`complete species ${id} references unknown ability ${abilityId}`);if(!enabledAbilities.has(abilityId))problems.push(`complete species ${id} missing legal ability ${abilityId}`);else requireCoverage(coverageByKey,'ability',abilityId,formats,problems);}
 }
}

function validateEnabledContent(enabled,{team,species,moves,abilities,items,coverageByKey,formats,problems}){
 if(!enabled||typeof enabled!=='object'||Array.isArray(enabled)){problems.push('beta slice v3 requires enabledContent');return;}
 const memberSpecies=team.map(member=>species.get(member.speciesId)).filter(Boolean),specs=[['moveIds','move',moves,'moveIds'],['abilityIds','ability',abilities,'abilityIds'],['itemIds','item',items,null]];
 for(const [field,kind,index,relation] of specs){const ids=enabled[field];if(!Array.isArray(ids)||new Set(ids).size!==ids.length){problems.push(`enabledContent.${field} must contain distinct IDs`);continue;}
  for(const id of ids){const entry=index.get(id);if(!entry){problems.push(`enabled ${kind} ${id} is unknown`);continue;}if(kind==='item'&&entry.availableInChampions!==true)problems.push(`enabled item ${id} is unavailable in Champions`);if(relation&&!memberSpecies.some(mon=>mon[relation]?.includes(id)))problems.push(`enabled ${kind} ${id} has no beta species relation`);requireCoverage(coverageByKey,kind,id,formats,problems);}
 }
}

function requireCoverage(index,kind,id,formats,problems){const entry=index.get(`${kind}:${id}`);for(const format of formats)if(!entry?.formats?.[format]?.supported)problems.push(`${kind} ${id} is blocked in ${format}: ${entry?.formats?.[format]?.reason||'missing-coverage'}`);}
