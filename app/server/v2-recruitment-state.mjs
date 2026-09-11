import {advanceAdventureClock,projectedAdventureNow} from './clock.mjs';
import {ensureEconomyState} from './v2-economy-ledger.mjs';
import {getV2ProgressionState,storeV2Progression} from './v2-progression-state.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const RECRUITMENT_SEED_SALT=0x9e3779b9;

function nextRandom(state){
 ensureEconomyState(state);if(!Number.isInteger(state.rngState.recruitment))state.rngState.recruitment=(((state.seed>>>0)||1)^RECRUITMENT_SEED_SALT)>>>0;
 state.rngState.recruitment=(Math.imul(state.rngState.recruitment>>>0,1664525)+1013904223)>>>0;return state.rngState.recruitment/4294967296;
}

function drawOne(state,ids){return ids.splice(Math.floor(nextRandom(state)*ids.length),1)[0];}
function permanentSpecies(progression){return new Set(progression.mons.filter(mon=>mon.ownership==='permanent').map(mon=>mon.speciesId));}

export function trialExpiryMs(mon){
 if(mon?.trialExpiresAt===null||mon?.trialExpiresAt===undefined)return null;
 if(Number.isFinite(mon.trialExpiresAt))return Math.trunc(mon.trialExpiresAt);
 const parsed=Date.parse(mon.trialExpiresAt);return Number.isFinite(parsed)?parsed:null;
}
export function trialIsExpired(mon,effectiveNow){const expiry=trialExpiryMs(mon);return mon?.ownership==='trial'&&(expiry===null||expiry<=effectiveNow);}
export function trialIsActive(mon,effectiveNow){return mon?.ownership==='trial'&&!trialIsExpired(mon,effectiveNow);}

export function synchronizeTrialExpiry(progression,effectiveNow){
 let changed=false;for(const mon of progression.mons){if(mon.ownership!=='trial')continue;const expired=trialIsExpired(mon,effectiveNow);if(mon.trialExpired!==expired){mon.trialExpired=expired;changed=true;}}
 if(changed)progression.revision++;return changed;
}

function ensureRecruitmentContainer(state){
 if(!state.recruitmentV2||typeof state.recruitmentV2!=='object')state.recruitmentV2={schemaVersion:1,revision:0,cycleId:null,lineupSpeciesIds:[],refreshCount:0,trialedSpeciesIds:[]};
 const recruitment=state.recruitmentV2;recruitment.schemaVersion=1;recruitment.revision=Math.max(0,Math.trunc(recruitment.revision||0));recruitment.refreshCount=Math.max(0,Math.trunc(recruitment.refreshCount||0));recruitment.trialedSpeciesIds=Array.isArray(recruitment.trialedSpeciesIds)?[...new Set(recruitment.trialedSpeciesIds)]:[];recruitment.lineupSpeciesIds=Array.isArray(recruitment.lineupSpeciesIds)?recruitment.lineupSpeciesIds:[];return recruitment;
}

export function rollRecruitmentLineup(state,progression,catalog){
 const size=catalog.economy.recruitment.lineupSize,all=catalog.species.map(species=>species.id),owned=permanentSpecies(progression),unowned=all.filter(id=>!owned.has(id)),selected=[];
 if(unowned.length)selected.push(drawOne(state,[...unowned]));
 const remaining=all.filter(id=>!selected.includes(id));while(selected.length<size&&remaining.length)selected.push(drawOne(state,remaining));
 return selected;
}

export function prepareRecruitmentState(state,catalog,serverNow){
 ensureEconomyState(state);const effectiveNow=advanceAdventureClock(state,serverNow),progression=getV2ProgressionState(state,catalog),recruitment=ensureRecruitmentContainer(state),config=catalog.economy.recruitment;
 if(!Number.isInteger(state.rngState.recruitment))state.rngState.recruitment=(((state.seed>>>0)||1)^RECRUITMENT_SEED_SALT)>>>0;
 const expiryChanged=synchronizeTrialExpiry(progression,effectiveNow),cycleId=Math.floor(effectiveNow/config.cycleDurationMs),lineupInvalid=recruitment.lineupSpeciesIds.length!==config.lineupSize||new Set(recruitment.lineupSpeciesIds).size!==recruitment.lineupSpeciesIds.length||recruitment.lineupSpeciesIds.some(id=>!catalog.speciesById[id]);
 if(recruitment.cycleId!==cycleId||lineupInvalid){recruitment.cycleId=cycleId;recruitment.refreshCount=0;recruitment.trialedSpeciesIds=[];recruitment.lineupSpeciesIds=rollRecruitmentLineup(state,progression,catalog);recruitment.revision++;}
 if(expiryChanged)storeV2Progression(state,progression);
 return {state,progression,recruitment,effectiveNow};
}

export function projectedRecruitmentNow(state,serverNow){return projectedAdventureNow(state,serverNow);}

function ownershipFor(speciesId,progression,effectiveNow){
 const mon=progression.mons.find(entry=>entry.speciesId===speciesId);if(!mon)return {status:'locked',mon:null};if(mon.ownership==='permanent')return {status:'permanent',mon};return {status:trialIsExpired(mon,effectiveNow)?'trial-expired':'trial',mon};
}

export function recruitmentView(state,catalog,serverNow){
 const effectiveNow=projectedRecruitmentNow(state,serverNow),progression=getV2ProgressionState(state,catalog),recruitment=state.recruitmentV2;if(!recruitment)return null;const config=catalog.economy.recruitment;
 const trialMon=progression.mons.find(mon=>mon.ownership==='trial')||null,trialSpecies=trialMon?catalog.speciesById[trialMon.speciesId]:null;
 const projectOffer=speciesId=>{const species=catalog.speciesById[speciesId],owned=ownershipFor(speciesId,progression,effectiveNow);return {speciesId,name:species.name,types:clone(species.types),priceCoins:config.permanentCostCoins,priceTickets:config.permanentCostTickets,abilityIds:clone(species.abilityIds),sampleBuild:clone(species.defaultBuild),ownership:owned.status,monId:owned.mon?.monId||null,trialExpiresAt:owned.mon?.trialExpiresAt||null,trialUsedThisCycle:recruitment.trialedSpeciesIds.includes(speciesId)};};
 return {schemaVersion:1,revision:recruitment.revision,cycleId:recruitment.cycleId,cycleEndsAt:(recruitment.cycleId+1)*config.cycleDurationMs,effectiveNow,refresh:{costCoins:config.refreshCostCoins,count:recruitment.refreshCount,limit:config.paidRefreshLimitPerCycle},offers:recruitment.lineupSpeciesIds.map(projectOffer),activeTrial:progression.mons.filter(mon=>trialIsActive(mon,effectiveNow)).map(mon=>({monId:mon.monId,speciesId:mon.speciesId,trialExpiresAt:mon.trialExpiresAt}))[0]||null,trialOffer:trialSpecies?{...projectOffer(trialSpecies.id),ownership:trialIsExpired(trialMon,effectiveNow)?'trial-expired':'trial',monId:trialMon.monId,trialExpiresAt:trialMon.trialExpiresAt}:null};
}
