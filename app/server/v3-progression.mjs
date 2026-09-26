import {NATURES,validateStatPoints} from '../rules-v3/stats.mjs';
import {V3_BEGINNING_ITEM_IDS,V3_STARTER_HELD_ITEM_IDS} from './v3-item-acquisition.mjs';

const clone=value=>structuredClone(value);
export const V3_TEAM_SLOT_COUNT=5;
const defaultTeamId=index=>index===0?'v3-team-beta':`v3-team-${index+1}`;
const totalPoints=points=>Object.values(points||{}).reduce((sum,value)=>sum+(Number.isInteger(value)?value:0),0);
export function v3TrainingCost(current,candidate){const statPoints=Object.keys(current?.statPoints||{}).reduce((sum,key)=>sum+Math.max(0,(candidate?.statPoints?.[key]||0)-(current.statPoints[key]||0)),0),moves=(candidate?.moveIds||[]).filter(id=>!(current?.moveIds||[]).includes(id)).length;return {statPoints,nature:current?.natureId!==candidate?.natureId?1:0,ability:current?.abilityId!==candidate?.abilityId?1:0,moves,total:statPoints*5+(current?.natureId!==candidate?.natureId?500:0)+(current?.abilityId!==candidate?.abilityId?500:0)+moves*250};}

export function validateV3Build(build,progression,catalog){
 const problems=[],mon=progression.mons.find(entry=>entry.monId===build?.monId),species=catalog.speciesById[mon?.speciesId];
 if(!mon||!species)problems.push('MON_NOT_FOUND');
 if(!NATURES[build?.natureId])problems.push('NATURE_INVALID');
 if(validateStatPoints(build?.statPoints).length||totalPoints(build?.statPoints)!==catalog.regulations[0].statPointBudget)problems.push('STAT_POINTS_INVALID');
 const requiredMoveCount=Math.min(4,species?.moveIds?.length||4);if(!Array.isArray(build?.moveIds)||build.moveIds.length!==requiredMoveCount||new Set(build.moveIds).size!==requiredMoveCount)problems.push('MOVE_COUNT_INVALID');
 else if(build.moveIds.some(id=>!species?.moveIds.includes(id)||!catalog.movesById[id]?.enabledForBattle))problems.push('MOVE_ILLEGAL');
 if(!species?.abilityIds.includes(build?.abilityId)||!catalog.abilitiesById[build?.abilityId]?.enabledForBattle)problems.push('ABILITY_ILLEGAL');
 if(!catalog.itemsById[build?.itemId]?.enabledForBattle)problems.push('ITEM_ILLEGAL');
 if(typeof build?.name!=='string'||!build.name.trim()||build.name.length>40)problems.push('NAME_INVALID');
 return [...new Set(problems)];
}

export function validateV3TeamDraft(team,progression,catalog){
 const problems=[],rule=catalog.regulations[0];
 if(typeof team?.name!=='string'||!team.name.trim()||team.name.length>40)problems.push('NAME_INVALID');
 if(!Array.isArray(team?.buildIds)||team.buildIds.length!==rule.rosterSize||new Set(team.buildIds).size!==team.buildIds.length)problems.push('TEAM_SIZE_INVALID');
 const builds=(team?.buildIds||[]).map(id=>progression.builds.find(build=>build.buildId===id));if(builds.some(build=>!build))problems.push('BUILD_NOT_FOUND');
 return [...new Set(problems)];
}

export function validateV3Team(team,progression,catalog){
 const problems=[...validateV3TeamDraft(team,progression,catalog)],rule=catalog.regulations[0],builds=(team?.buildIds||[]).map(id=>progression.builds.find(build=>build.buildId===id));
 const mons=builds.map(build=>progression.mons.find(mon=>mon.monId===build?.monId));if(new Set(mons.filter(Boolean).map(mon=>mon.speciesId)).size!==mons.filter(Boolean).length)problems.push('SPECIES_CLAUSE');
 if(mons.some(mon=>mon?.ownership==='trial'&&mon.trialExpired))problems.push('TRIAL_EXPIRED');
 const items=builds.filter(Boolean).map(build=>build.itemId).filter(id=>id!=='none');if(rule.itemClause&&new Set(items).size!==items.length)problems.push('ITEM_CLAUSE');
 for(const build of builds.filter(Boolean))if(validateV3Build(build,progression,catalog).length)problems.push('BUILD_ILLEGAL');
 return [...new Set(problems)];
}

export function createV3BetaProgression(catalog){
 const starterIds=catalog.starterTeamSpeciesIds||catalog.species.slice(0,6).map(species=>species.id),starters=starterIds.map(id=>catalog.speciesById[id]||catalog.species.find(species=>species.id===id));
 const mons=starters.map(species=>({monId:`v3-mon-${species.id}`,speciesId:species.id,ownership:'permanent'}));
 const builds=starters.map((species,index)=>{const defaults=species.defaultBuild,itemId=V3_STARTER_HELD_ITEM_IDS[index]||V3_BEGINNING_ITEM_IDS[index]||defaults.itemId;return {buildId:`v3-build-${species.id}`,monId:`v3-mon-${species.id}`,name:defaults.name,natureId:defaults.natureId,statPoints:clone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1};});
 const buildIds=builds.map(build=>build.buildId),teams=Array.from({length:V3_TEAM_SLOT_COUNT},(_,index)=>({teamId:defaultTeamId(index),name:index===0?'Beta Squad':`Team ${index+1}`,buildIds:[...buildIds],revision:1})),progression={schemaVersion:1,catalogVersion:catalog.metadata.catalogVersion,revision:1,mons,builds,teams,activeTeamId:teams[0].teamId,teamSlotsVersion:1,itemInventoryVersion:1,ownedItemIds:[...V3_BEGINNING_ITEM_IDS]};
 progression.nextMonSerial=1;progression.nextBuildSerial=1;
 const invalidBuilds=builds.flatMap(build=>validateV3Build(build,progression,catalog));if(invalidBuilds.length)throw new Error(`invalid promoted default build: ${invalidBuilds.join(', ')}`);
 for(const team of teams){const teamProblems=validateV3Team(team,progression,catalog);if(teamProblems.length)throw new Error(`invalid promoted default team: ${teamProblems.join(', ')}`);}
 return progression;
}

export function normalizeV3TeamSlots(progression,catalog){
 const next=clone(progression),teams=(next.teams||[]).slice(0,V3_TEAM_SLOT_COUNT),seed=teams.find(team=>team.teamId===next.activeTeamId)||teams[0];
 if(!seed)return {progression:next,changed:false};
 const used=new Set(teams.map(team=>team.teamId));
 while(teams.length<V3_TEAM_SLOT_COUNT){const index=teams.length;let teamId=defaultTeamId(index),suffix=2;while(used.has(teamId))teamId=`v3-team-${index+1}-${suffix++}`;used.add(teamId);teams.push({teamId,name:`Team ${index+1}`,buildIds:[...seed.buildIds],revision:1});}
 const activeTeamId=teams.some(team=>team.teamId===next.activeTeamId)?next.activeTeamId:teams[0].teamId,changed=next.teamSlotsVersion!==1||activeTeamId!==next.activeTeamId||JSON.stringify(teams)!==JSON.stringify(next.teams||[]);
 next.teams=teams;next.activeTeamId=activeTeamId;next.teamSlotsVersion=1;if(changed)next.revision=(next.revision||0)+1;return {progression:next,changed};
}

export function applyV3ProgressionAction(progression,action,catalog){
 if(progression?.catalogVersion!==catalog.metadata.catalogVersion)return {ok:false,code:'CATALOG_VERSION_MISMATCH'};
 if(action?.type==='buildV3.save'){
  const current=progression.builds.find(build=>build.buildId===action.build?.buildId);if(!current)return {ok:false,code:'BUILD_NOT_FOUND'};
  const currentMon=progression.mons.find(mon=>mon.monId===current.monId);if(currentMon?.ownership==='trial')return {ok:false,code:currentMon.trialExpired?'TRIAL_EXPIRED':'TRIAL_READ_ONLY'};
  if(action.expectedRevision!==current.revision)return {ok:false,code:'STALE_REVISION'};
  const candidate={...clone(action.build),buildId:current.buildId,monId:current.monId,revision:current.revision};if(Array.isArray(progression.ownedItemIds)&&!progression.ownedItemIds.includes(candidate.itemId))return {ok:false,code:'ITEM_NOT_OWNED'};const problems=validateV3Build(candidate,progression,catalog);if(problems.length)return {ok:false,code:'BUILD_ILLEGAL',details:problems};
  const next=clone(progression),index=next.builds.findIndex(build=>build.buildId===current.buildId);candidate.revision++;next.builds[index]=candidate;next.revision++;return {ok:true,progression:next,build:clone(candidate)};
 }
 if(action?.type==='teamV3.save'){
  const current=progression.teams.find(team=>team.teamId===action.team?.teamId);if(!current)return {ok:false,code:'TEAM_NOT_FOUND'};
  if(action.expectedRevision!==current.revision)return {ok:false,code:'STALE_REVISION'};
  const candidate={...clone(action.team),teamId:current.teamId,revision:current.revision},problems=validateV3TeamDraft(candidate,progression,catalog);if(problems.length)return {ok:false,code:'TEAM_DRAFT_INVALID',details:problems};
  const next=clone(progression),index=next.teams.findIndex(team=>team.teamId===current.teamId);candidate.revision++;next.teams[index]=candidate;next.revision++;return {ok:true,progression:next,team:clone(candidate)};
 }
 if(action?.type==='teamV3.activate'){
  const current=progression.teams.find(team=>team.teamId===action.teamId);if(!current)return {ok:false,code:'TEAM_NOT_FOUND'};const problems=validateV3TeamDraft(current,progression,catalog);if(problems.length)return {ok:false,code:'TEAM_DRAFT_INVALID',details:problems};
  if(progression.activeTeamId===current.teamId)return {ok:true,progression:clone(progression),team:clone(current),activated:false};const next=clone(progression);next.activeTeamId=current.teamId;next.revision++;return {ok:true,progression:next,team:clone(current),activated:true};
 }
 if(action?.type==='replicaV3.apply'){
  if(action.expectedRevision!==progression.revision)return {ok:false,code:'STALE_REVISION'};
  const replica=action.replica;if(replica?.version!==1||!Array.isArray(replica.members)||replica.members.length!==catalog.regulations[0].rosterSize)return {ok:false,code:'REPLICA_INVALID'};
  const speciesIds=replica.members.map(member=>member?.speciesId);if(new Set(speciesIds).size!==speciesIds.length)return {ok:false,code:'REPLICA_SPECIES_CLAUSE'};
  const next=clone(progression),buildIds=[];
  for(const member of replica.members){const mon=next.mons.find(entry=>entry.speciesId===member.speciesId&&entry.ownership==='permanent')||next.mons.find(entry=>entry.speciesId===member.speciesId&&entry.ownership==='trial'&&!entry.trialExpired);if(!mon)return {ok:false,code:'REPLICA_POKEMON_NOT_OWNED',details:[member.speciesId]};const current=next.builds.find(entry=>entry.monId===mon.monId);if(!current)return {ok:false,code:'REPLICA_BUILD_NOT_FOUND',details:[member.speciesId]};if(Array.isArray(next.ownedItemIds)&&!next.ownedItemIds.includes(member.itemId))return {ok:false,code:'REPLICA_ITEM_NOT_OWNED',details:[member.itemId]};const candidate={...current,name:typeof member.buildName==='string'&&member.buildName.trim()?member.buildName.slice(0,40):current.name,natureId:member.natureId,statPoints:clone(member.statPoints),moveIds:[...member.moveIds],abilityId:member.abilityId,itemId:member.itemId,revision:current.revision};const problems=validateV3Build(candidate,next,catalog);if(problems.length)return {ok:false,code:'REPLICA_BUILD_ILLEGAL',details:[member.speciesId,...problems]};candidate.revision++;next.builds[next.builds.findIndex(entry=>entry.buildId===current.buildId)]=candidate;buildIds.push(candidate.buildId);}
  const currentTeam=next.teams.find(team=>team.teamId===next.activeTeamId)||next.teams[0];if(!currentTeam)return {ok:false,code:'TEAM_NOT_FOUND'};const team={...currentTeam,name:typeof replica.name==='string'&&replica.name.trim()?replica.name.slice(0,40):'Replica Team',buildIds,revision:currentTeam.revision},problems=validateV3Team(team,next,catalog);if(problems.length)return {ok:false,code:'REPLICA_TEAM_ILLEGAL',details:problems};team.revision++;next.teams[next.teams.findIndex(entry=>entry.teamId===currentTeam.teamId)]=team;next.revision++;return {ok:true,progression:next,team:clone(team),replica:true};
 }
 return {ok:false,code:'UNKNOWN_V3_PROGRESSION_ACTION'};
}

export function v3TrainingView(progression,catalog){
 return {catalogVersion:progression.catalogVersion,revision:progression.revision,activeTeamId:progression.activeTeamId||progression.teams?.[0]?.teamId||null,ownedItemIds:[...(progression.ownedItemIds||[])],mons:clone(progression.mons),builds:clone(progression.builds),teams:clone(progression.teams),species:catalog.species.map(species=>({id:species.id,name:species.name,types:[...species.types]}))};
}
