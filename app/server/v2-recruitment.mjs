import {applyEconomyTransaction,inspectActionReceipt,recordActionReceipt,validateEconomyActionId} from './v2-economy-ledger.mjs';
import {allocateV2MonId,storeV2Progression} from './v2-progression-state.mjs';
import {prepareRecruitmentState,recruitmentView,rollRecruitmentLineup,trialIsActive} from './v2-recruitment-state.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const actionTypes=new Set(['recruit.refresh','recruit.trial','recruit.permanent']);
export function isV2RecruitmentAction(action){return actionTypes.has(action?.type);}
function fingerprint(action){return JSON.stringify(action.type==='recruit.refresh'?{type:action.type}:{type:action.type,speciesId:action.speciesId,payment:action.type==='recruit.permanent'?(action.payment||'coins'):undefined});}
function permanentMon(progression,speciesId){return progression.mons.find(mon=>mon.speciesId===speciesId&&mon.ownership==='permanent');}
function anySpeciesMon(progression,speciesId){return progression.mons.find(mon=>mon.speciesId===speciesId);}
function ensureDefaultBuild(progression,mon,species){
 let build=progression.builds.find(entry=>entry.monId===mon.monId);if(build)return build;build={buildId:`build-recruit-${progression.nextBuildId++}`,monId:mon.monId,...clone(species.defaultBuild),revision:1};progression.builds.push(build);return build;
}
function addLegacyPermanent(state,species){state.collection=Array.isArray(state.collection)?state.collection:[];if(!state.collection.some(mon=>mon.id===species.legacyId))state.collection.push({id:species.legacyId,level:5,item:0,xp:0});}
function validateRevision(action,recruitment){
 if(!Number.isInteger(action.expectedRevision)||action.expectedRevision!==recruitment.revision)return {ok:false,code:'STALE_REVISION',latestRevision:recruitment.revision};
 if(action.cycleId!==undefined&&action.cycleId!==recruitment.cycleId)return {ok:false,code:'STALE_RECRUITMENT_CYCLE',cycleId:recruitment.cycleId};return {ok:true};
}
function finish(base,action,fingerprintValue,receipt){recordActionReceipt(base,{actionId:action.actionId,kind:action.type,fingerprint:fingerprintValue,receiptId:receipt.receiptId,result:receipt});return {ok:true,state:base,duplicate:false,receipt:clone(receipt)};}

function refresh(base,action,catalog,progression,recruitment){
 const config=catalog.economy.recruitment;if(recruitment.refreshCount>=config.paidRefreshLimitPerCycle)return {ok:false,code:'REFRESH_LIMIT_REACHED'};
 const transaction=applyEconomyTransaction(base,{receiptId:`recruit.refresh:${action.actionId}`,actionId:action.actionId,kind:'recruit.refresh',delta:{coins:-config.refreshCostCoins,crystals:0},details:{cycleId:recruitment.cycleId,refreshNumber:recruitment.refreshCount+1}});if(!transaction.ok)return transaction;
 recruitment.refreshCount++;recruitment.lineupSpeciesIds=rollRecruitmentLineup(base,progression,catalog);recruitment.revision++;
 return {ok:true,receipt:{receiptId:transaction.entry.receiptId,kind:'recruit.refresh',cycleId:recruitment.cycleId,revision:recruitment.revision,refreshCount:recruitment.refreshCount,lineupSpeciesIds:clone(recruitment.lineupSpeciesIds),costCoins:config.refreshCostCoins,balance:clone(base.wallet)}};
}

function trial(base,action,catalog,progression,recruitment,effectiveNow){
 const species=catalog.speciesById[action.speciesId],config=catalog.economy.recruitment;if(!species)return {ok:false,code:'SPECIES_NOT_FOUND'};if(!recruitment.lineupSpeciesIds.includes(species.id))return {ok:false,code:'SPECIES_NOT_IN_LINEUP'};if(permanentMon(progression,species.id))return {ok:false,code:'ALREADY_OWNED'};if(recruitment.trialedSpeciesIds.includes(species.id))return {ok:false,code:'TRIAL_ALREADY_USED_THIS_CYCLE'};
 const active=progression.mons.find(mon=>trialIsActive(mon,effectiveNow));if(active)return {ok:false,code:'TRIAL_SLOT_OCCUPIED',details:[active.speciesId]};
 let mon=anySpeciesMon(progression,species.id);if(!mon){mon={monId:allocateV2MonId(progression),speciesId:species.id,ownership:'trial',trialExpiresAt:null,trialExpired:false,legacyLevel:5,acquiredBy:'trial'};progression.mons.push(mon);}mon.ownership='trial';mon.trialExpiresAt=new Date(effectiveNow+config.trialDurationMs).toISOString();mon.trialExpired=false;mon.acquiredBy='trial';const build=ensureDefaultBuild(progression,mon,species);
 recruitment.trialedSpeciesIds.push(species.id);recruitment.revision++;progression.revision++;storeV2Progression(base,progression);
 return {ok:true,receipt:{receiptId:`recruit.trial:${action.actionId}`,kind:'recruit.trial',cycleId:recruitment.cycleId,revision:recruitment.revision,speciesId:species.id,monId:mon.monId,buildId:build.buildId,trialExpiresAt:mon.trialExpiresAt,costCoins:config.trialCostCoins}};
}

function permanent(base,action,catalog,progression,recruitment){
 const species=catalog.speciesById[action.speciesId],config=catalog.economy.recruitment;if(!species)return {ok:false,code:'SPECIES_NOT_FOUND'};if(permanentMon(progression,species.id))return {ok:false,code:'ALREADY_OWNED'};let mon=anySpeciesMon(progression,species.id),upgradedTrial=mon?.ownership==='trial';if(!upgradedTrial&&!recruitment.lineupSpeciesIds.includes(species.id))return {ok:false,code:'SPECIES_NOT_IN_LINEUP'};
 const payment=action.payment||'coins';if(!['coins','ticket'].includes(payment))return {ok:false,code:'INVALID_RECRUITMENT_PAYMENT'};const costCoins=payment==='coins'?config.permanentCostCoins:0,costTickets=payment==='ticket'?config.permanentCostTickets:0,transaction=applyEconomyTransaction(base,{receiptId:`recruit.permanent:${action.actionId}`,actionId:action.actionId,kind:'recruit.permanent',delta:{coins:-costCoins,crystals:0,recruitmentTickets:-costTickets},details:{cycleId:recruitment.cycleId,speciesId:species.id,payment,upgradedTrial}});if(!transaction.ok)return transaction;
 if(!mon){mon={monId:allocateV2MonId(progression),speciesId:species.id,ownership:'permanent',trialExpiresAt:null,legacyLevel:5,acquiredBy:'recruitment'};progression.mons.push(mon);}else{mon.ownership='permanent';mon.trialExpiresAt=null;mon.trialExpired=false;mon.acquiredBy='recruitment';}
 const build=ensureDefaultBuild(progression,mon,species);addLegacyPermanent(base,species);progression.revision++;recruitment.revision++;storeV2Progression(base,progression);
 return {ok:true,receipt:{receiptId:transaction.entry.receiptId,kind:'recruit.permanent',cycleId:recruitment.cycleId,revision:recruitment.revision,speciesId:species.id,monId:mon.monId,buildId:build.buildId,upgradedTrial,payment,costCoins,costTickets,balance:clone(base.wallet)}};
}

export function applyV2RecruitmentAction(state,action,catalog,{serverNow}={}){
 if(!isV2RecruitmentAction(action))return {ok:false,code:'UNKNOWN_RECRUITMENT_ACTION'};if(!validateEconomyActionId(action.actionId))return {ok:false,code:'ACTION_ID_REQUIRED'};if(serverNow===undefined)return {ok:false,code:'SERVER_TIME_REQUIRED'};
 const base=clone(state),prepared=prepareRecruitmentState(base,catalog,serverNow),{progression,recruitment,effectiveNow}=prepared,fingerprintValue=fingerprint(action),prior=inspectActionReceipt(base,action.actionId,fingerprintValue);
 if(prior.status==='conflict')return {ok:false,code:'ACTION_ID_REUSED'};if(prior.status==='duplicate')return {ok:true,state:base,duplicate:true,receipt:clone(prior.receipt.result)};
 const upgradingTrial=action.type==='recruit.permanent'&&anySpeciesMon(progression,action.speciesId)?.ownership==='trial',revision=upgradingTrial?{ok:true}:validateRevision(action,recruitment);if(!revision.ok)return revision;
 let result;if(action.type==='recruit.refresh')result=refresh(base,action,catalog,progression,recruitment);else if(action.type==='recruit.trial')result=trial(base,action,catalog,progression,recruitment,effectiveNow);else result=permanent(base,action,catalog,progression,recruitment);if(!result.ok)return result;
 return finish(base,action,fingerprintValue,result.receipt);
}

export function v2RecruitmentView(state,catalog,{serverNow}={}){if(serverNow===undefined)return null;return recruitmentView(state,catalog,serverNow);}
