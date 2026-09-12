import {createV3BetaProgression,validateV3Team} from './v3-progression.mjs';

const clone=value=>structuredClone(value);
const activeBattle=state=>(state?.battle&&!state.battle.result)||(state?.battleV2&&!['FINISHED'].includes(state.battleV2.phase));

export function upgradeAdventureToV3(state,catalog){
 const source=clone(state),version=Number.isInteger(source?.schemaVersion)?source.schemaVersion:1;
 if(version>3)throw new Error(`Save schema ${version} is newer than this application supports`);
 if(version===3){
  if(source.progressionV3?.catalogVersion!==catalog.metadata.catalogVersion){const progressionV3=rebaseProgression(source.progressionV3,catalog);return {status:'catalog-upgraded',state:{...source,rulesVersion:catalog.metadata.rulesVersion,catalogVersion:catalog.metadata.catalogVersion,progressionV3,migrationV3:{from:3,to:3,id:'v3-catalog-rebase',catalogVersion:catalog.metadata.catalogVersion}},report:{from:3,to:3,changed:true,mons:progressionV3.mons.length,builds:progressionV3.builds.length,teamSize:progressionV3.teams[0].buildIds.length}};}
  return {status:'current',state:source,report:{from:3,to:3,changed:false}};
 }
 if(activeBattle(source))return {status:'deferred-active-battle',state:source,report:{from:version,to:3,changed:false,reason:'Finish or surrender the active battle first'}};
 const legacyV2Archive=version===2?{catalogVersion:source.catalogVersion||null,progressionRevision:source.progressionRevision||null,mons:clone(source.mons||[]),builds:clone(source.builds||[]),teams:clone(source.teams||[]),activeTeamId:source.activeTeamId||null}:null;
 const progressionV3=createV3BetaProgression(catalog),migrated={...source,schemaVersion:3,rulesVersion:catalog.metadata.rulesVersion,catalogVersion:catalog.metadata.catalogVersion,progressionV3,legacyV2Archive,migrationV3:{from:version,to:3,id:`v${version}-to-v3-beta`,catalogVersion:catalog.metadata.catalogVersion}};
 return {status:'migrated',state:migrated,report:{from:version,to:3,changed:true,mons:progressionV3.mons.length,builds:progressionV3.builds.length,teamSize:progressionV3.teams[0].buildIds.length}};
}

function rebaseProgression(previous,catalog){
 const fresh=createV3BetaProgression(catalog),allowed=new Set(catalog.species.map(species=>species.id));
 const previousMons=(previous?.mons||[]).filter(mon=>allowed.has(mon.speciesId)).map(mon=>({...clone(mon),ownership:mon.ownership==='beta'?'permanent':mon.ownership}));
 const monIds=new Set(previousMons.map(mon=>mon.monId)),previousBuilds=(previous?.builds||[]).filter(build=>monIds.has(build.monId));
 const existingSpecies=new Set(previousMons.map(mon=>mon.speciesId));
 for(const mon of fresh.mons)if(!existingSpecies.has(mon.speciesId)){previousMons.push(mon);previousBuilds.push(fresh.builds.find(build=>build.monId===mon.monId));}
 const progression={...fresh,...clone(previous),catalogVersion:catalog.metadata.catalogVersion,mons:previousMons,builds:previousBuilds,revision:(previous?.revision||0)+1};
 const legalTeams=(previous?.teams||[]).filter(team=>validateV3Team(team,progression,catalog).length===0);progression.teams=legalTeams.length?legalTeams:fresh.teams;
 progression.nextMonSerial=Math.max(1,previous?.nextMonSerial||1);progression.nextBuildSerial=Math.max(1,previous?.nextBuildSerial||1);return progression;
}
