import {NATURES,validateStatPoints} from '../rules-v3/stats.mjs';

const clone=value=>structuredClone(value);
const totalPoints=points=>Object.values(points||{}).reduce((sum,value)=>sum+(Number.isInteger(value)?value:0),0);

export function validateV3Build(build,progression,catalog){
 const problems=[],mon=progression.mons.find(entry=>entry.monId===build?.monId),species=catalog.speciesById[mon?.speciesId];
 if(!mon||!species)problems.push('MON_NOT_FOUND');
 if(!NATURES[build?.natureId])problems.push('NATURE_INVALID');
 if(validateStatPoints(build?.statPoints).length||totalPoints(build?.statPoints)!==catalog.regulations[0].statPointBudget)problems.push('STAT_POINTS_INVALID');
 if(!Array.isArray(build?.moveIds)||build.moveIds.length!==4||new Set(build.moveIds).size!==4)problems.push('MOVE_COUNT_INVALID');
 else if(build.moveIds.some(id=>!species?.moveIds.includes(id)||!catalog.movesById[id]?.enabledForBattle))problems.push('MOVE_ILLEGAL');
 if(!species?.abilityIds.includes(build?.abilityId)||!catalog.abilitiesById[build?.abilityId]?.enabledForBattle)problems.push('ABILITY_ILLEGAL');
 if(!catalog.itemsById[build?.itemId]?.enabledForBattle)problems.push('ITEM_ILLEGAL');
 if(typeof build?.name!=='string'||!build.name.trim()||build.name.length>40)problems.push('NAME_INVALID');
 return [...new Set(problems)];
}

export function validateV3Team(team,progression,catalog){
 const problems=[],rule=catalog.regulations[0];
 if(typeof team?.name!=='string'||!team.name.trim()||team.name.length>40)problems.push('NAME_INVALID');
 if(!Array.isArray(team?.buildIds)||team.buildIds.length!==rule.rosterSize||new Set(team.buildIds).size!==team.buildIds.length)problems.push('TEAM_SIZE_INVALID');
 const builds=(team?.buildIds||[]).map(id=>progression.builds.find(build=>build.buildId===id));if(builds.some(build=>!build))problems.push('BUILD_NOT_FOUND');
 const mons=builds.map(build=>progression.mons.find(mon=>mon.monId===build?.monId));if(new Set(mons.filter(Boolean).map(mon=>mon.speciesId)).size!==mons.filter(Boolean).length)problems.push('SPECIES_CLAUSE');
 if(mons.some(mon=>mon?.ownership==='trial'&&mon.trialExpired))problems.push('TRIAL_EXPIRED');
 const items=builds.filter(Boolean).map(build=>build.itemId).filter(id=>id!=='none');if(rule.itemClause&&new Set(items).size!==items.length)problems.push('ITEM_CLAUSE');
 for(const build of builds.filter(Boolean))if(validateV3Build(build,progression,catalog).length)problems.push('BUILD_ILLEGAL');
 return [...new Set(problems)];
}

export function createV3BetaProgression(catalog){
 const starterIds=catalog.starterTeamSpeciesIds||catalog.species.slice(0,6).map(species=>species.id),starters=starterIds.map(id=>catalog.speciesById[id]||catalog.species.find(species=>species.id===id));
 const mons=starters.map(species=>({monId:`v3-mon-${species.id}`,speciesId:species.id,ownership:'permanent'}));
 const builds=starters.map(species=>{const defaults=species.defaultBuild;return {buildId:`v3-build-${species.id}`,monId:`v3-mon-${species.id}`,name:defaults.name,natureId:defaults.natureId,statPoints:clone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};});
 const team={teamId:'v3-team-beta',name:'Beta Squad',buildIds:builds.map(build=>build.buildId),revision:1},progression={schemaVersion:1,catalogVersion:catalog.metadata.catalogVersion,revision:1,mons,builds,teams:[team]};
 progression.nextMonSerial=1;progression.nextBuildSerial=1;
 const invalidBuilds=builds.flatMap(build=>validateV3Build(build,progression,catalog));if(invalidBuilds.length)throw new Error(`invalid promoted default build: ${invalidBuilds.join(', ')}`);
 const teamProblems=validateV3Team(team,progression,catalog);if(teamProblems.length)throw new Error(`invalid promoted default team: ${teamProblems.join(', ')}`);
 return progression;
}

export function applyV3ProgressionAction(progression,action,catalog){
 if(progression?.catalogVersion!==catalog.metadata.catalogVersion)return {ok:false,code:'CATALOG_VERSION_MISMATCH'};
 if(action?.type==='buildV3.save'){
  const current=progression.builds.find(build=>build.buildId===action.build?.buildId);if(!current)return {ok:false,code:'BUILD_NOT_FOUND'};
  const currentMon=progression.mons.find(mon=>mon.monId===current.monId);if(currentMon?.ownership==='trial')return {ok:false,code:currentMon.trialExpired?'TRIAL_EXPIRED':'TRIAL_READ_ONLY'};
  if(action.expectedRevision!==current.revision)return {ok:false,code:'STALE_REVISION'};
  const candidate={...clone(action.build),buildId:current.buildId,monId:current.monId,revision:current.revision};const problems=validateV3Build(candidate,progression,catalog);if(problems.length)return {ok:false,code:'BUILD_ILLEGAL',details:problems};
  const next=clone(progression),index=next.builds.findIndex(build=>build.buildId===current.buildId);candidate.revision++;next.builds[index]=candidate;next.revision++;return {ok:true,progression:next,build:clone(candidate)};
 }
 if(action?.type==='teamV3.save'){
  const current=progression.teams.find(team=>team.teamId===action.team?.teamId);if(!current)return {ok:false,code:'TEAM_NOT_FOUND'};
  if(action.expectedRevision!==current.revision)return {ok:false,code:'STALE_REVISION'};
  const candidate={...clone(action.team),teamId:current.teamId,revision:current.revision},problems=validateV3Team(candidate,progression,catalog);if(problems.length)return {ok:false,code:'TEAM_ILLEGAL',details:problems};
  const next=clone(progression),index=next.teams.findIndex(team=>team.teamId===current.teamId);candidate.revision++;next.teams[index]=candidate;next.revision++;return {ok:true,progression:next,team:clone(candidate)};
 }
 return {ok:false,code:'UNKNOWN_V3_PROGRESSION_ACTION'};
}

export function v3TrainingView(progression,catalog){
 return {catalogVersion:progression.catalogVersion,revision:progression.revision,mons:clone(progression.mons),builds:clone(progression.builds),teams:clone(progression.teams),species:catalog.species.map(species=>({id:species.id,name:species.name,types:[...species.types]}))};
}
