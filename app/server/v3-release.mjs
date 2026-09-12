import {createV3BetaProgression} from './v3-progression.mjs';

const clone=value=>structuredClone(value);
const activeBattle=state=>(state?.battle&&!state.battle.result)||(state?.battleV2&&!['FINISHED'].includes(state.battleV2.phase));

export function upgradeAdventureToV3(state,catalog){
 const source=clone(state),version=Number.isInteger(source?.schemaVersion)?source.schemaVersion:1;
 if(version>3)throw new Error(`Save schema ${version} is newer than this application supports`);
 if(version===3){
  if(source.progressionV3?.catalogVersion!==catalog.metadata.catalogVersion)throw new Error('Schema-3 save catalog version mismatch');
  return {status:'current',state:source,report:{from:3,to:3,changed:false}};
 }
 if(activeBattle(source))return {status:'deferred-active-battle',state:source,report:{from:version,to:3,changed:false,reason:'Finish or surrender the active battle first'}};
 const legacyV2Archive=version===2?{catalogVersion:source.catalogVersion||null,progressionRevision:source.progressionRevision||null,mons:clone(source.mons||[]),builds:clone(source.builds||[]),teams:clone(source.teams||[]),activeTeamId:source.activeTeamId||null}:null;
 const progressionV3=createV3BetaProgression(catalog),migrated={...source,schemaVersion:3,rulesVersion:catalog.metadata.rulesVersion,catalogVersion:catalog.metadata.catalogVersion,progressionV3,legacyV2Archive,migrationV3:{from:version,to:3,id:`v${version}-to-v3-beta`,catalogVersion:catalog.metadata.catalogVersion}};
 return {status:'migrated',state:migrated,report:{from:version,to:3,changed:true,mons:progressionV3.mons.length,builds:progressionV3.builds.length,teamSize:progressionV3.teams[0].buildIds.length}};
}
