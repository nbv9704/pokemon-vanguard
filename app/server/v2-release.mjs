import {migrateV1ToV2,saveSchemaVersion} from './migrations.mjs';
import {getV2ProgressionState,storeV2Progression,synchronizeWallet} from './v2-progression-state.mjs';

export function ensureV2Tutorial(state){state.tutorialV2=state.tutorialV2||{completed:false,steps:{team:false,battle:false,reward:false,build:false}};state.tutorialV2.steps=state.tutorialV2.steps||{team:false,battle:false,reward:false,build:false};state.tutorialV2.completed=Object.values(state.tutorialV2.steps).every(Boolean);return state;}
export function markV2Tutorial(state,step){ensureV2Tutorial(state);if(step in state.tutorialV2.steps)state.tutorialV2.steps[step]=true;state.tutorialV2.completed=Object.values(state.tutorialV2.steps).every(Boolean);return state;}

export function upgradeAdventure(state,catalog){const result=migrateV1ToV2(state,catalog.species);if(result.status==='migrated')ensureV2Tutorial(result.state);return result;}

export function synchronizeLegacyState(state,catalog){
 if(saveSchemaVersion(state)<2)return state;synchronizeWallet(state);state.gymProgress={...(state.gymProgress||{}),badges:[...(state.badges||[])]};state.mailClaims=[...(state.mail||[])];const progression=getV2ProgressionState(state,catalog),known=new Set(progression.mons.map(mon=>mon.speciesId));
 for(const owned of state.collection||[]){const species=catalog.species.find(entry=>entry.legacyId===owned.id);if(!species||known.has(species.id))continue;const monId=`mon-${species.id}`,buildId=`build-${species.id}-1`;progression.mons.push({monId,speciesId:species.id,ownership:'permanent',trialExpiresAt:null,legacyLevel:owned.level||5,acquiredBy:'legacy-summon'});progression.builds.push({buildId,monId,...structuredClone(species.defaultBuild),revision:1});known.add(species.id);progression.revision++;}
 for(const mon of progression.mons){const species=catalog.speciesById[mon.speciesId],legacy=(state.collection||[]).find(entry=>entry.id===species?.legacyId);if(legacy)mon.legacyLevel=legacy.level||mon.legacyLevel||5;}
 storeV2Progression(state,progression);ensureV2Tutorial(state);return state;
}
