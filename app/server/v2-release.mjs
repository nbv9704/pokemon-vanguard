import {migrateV1ToV2,saveSchemaVersion} from './migrations.mjs';
import {allocateV2MonId,getV2ProgressionState,storeV2Progression,synchronizeWallet} from './v2-progression-state.mjs';
import {ensureEconomyState} from './v2-economy-ledger.mjs';

export function ensureV2Tutorial(state){state.tutorialV2=state.tutorialV2||{completed:false,steps:{team:false,battle:false,reward:false,build:false}};state.tutorialV2.steps=state.tutorialV2.steps||{team:false,battle:false,reward:false,build:false};state.tutorialV2.completed=Object.values(state.tutorialV2.steps).every(Boolean);return state;}
export function markV2Tutorial(state,step){ensureV2Tutorial(state);if(step in state.tutorialV2.steps)state.tutorialV2.steps[step]=true;state.tutorialV2.completed=Object.values(state.tutorialV2.steps).every(Boolean);return state;}

export function upgradeAdventure(state,catalog){const result=migrateV1ToV2(state,catalog.species);if(result.status!=='deferred-active-battle'&&saveSchemaVersion(result.state)>=2){ensureEconomyState(result.state);if((result.state.economyVersion||0)<2&&result.state.wallet.recruitmentTickets===0){result.state.wallet.recruitmentTickets=1;result.state.recruitmentTickets=1;}result.state.economyVersion=2;ensureV2Tutorial(result.state);}return result;}

export function synchronizeLegacyState(state,catalog){
 if(saveSchemaVersion(state)<2)return state;synchronizeWallet(state);ensureEconomyState(state);state.economyVersion=2;state.gymProgress={...(state.gymProgress||{}),badges:[...(state.badges||[])]};state.mailClaims=[...(state.mail||[])];const progression=getV2ProgressionState(state,catalog);
 for(const owned of state.collection||[]){
  const species=catalog.species.find(entry=>entry.legacyId===owned.id);if(!species)continue;let mon=progression.mons.find(entry=>entry.speciesId===species.id);
  if(mon){if(mon.ownership!=='permanent'){mon.ownership='permanent';mon.trialExpiresAt=null;mon.trialExpired=false;mon.acquiredBy='legacy-summon';progression.revision++;}mon.legacyLevel=owned.level||mon.legacyLevel||5;continue;}
  const monId=allocateV2MonId(progression),buildId=`build-recruit-${progression.nextBuildId++}`;progression.mons.push({monId,speciesId:species.id,ownership:'permanent',trialExpiresAt:null,trialExpired:false,legacyLevel:owned.level||5,acquiredBy:'legacy-summon'});progression.builds.push({buildId,monId,...structuredClone(species.defaultBuild),revision:1});progression.revision++;
 }
 for(const mon of progression.mons){const species=catalog.speciesById[mon.speciesId],legacy=(state.collection||[]).find(entry=>entry.id===species?.legacyId);if(legacy)mon.legacyLevel=legacy.level||mon.legacyLevel||5;}
 storeV2Progression(state,progression);ensureV2Tutorial(state);return state;
}
