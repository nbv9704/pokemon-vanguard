import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {WebSocket} from 'ws';
import {setup} from '../server/legacy/logic-v1.js';
import {migrateV1ToV2} from '../server/migrations.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {createServerClock} from '../server/clock.mjs';
import {applyV2RecruitmentAction} from '../server/v2-recruitment.mjs';
import {prepareRecruitmentState} from '../server/v2-recruitment-state.mjs';
import {applyV2ProgressionAction,getV2Progression} from '../server/v2-progression.mjs';
import {applyV2BattleAction} from '../server/v2-battle-actions.mjs';
import {synchronizeLegacyState} from '../server/v2-release.mjs';
import {createLocalServer} from '../local-server.mjs';
import {v2TrainingView} from '../server/v2-progression.mjs';
import {recruitmentView} from '../server/v2-recruitment-state.mjs';
import {analyzeTeam} from '../public/js/team-analysis.js';

const DAY=24*60*60*1000,TRIAL=7*DAY,T0=Date.UTC(2026,8,11,6,0,0);
const migrated=owner=>migrateV1ToV2(setup([owner]),v2Catalog.species).state;
function prepared(owner='trial-owner',now=T0){const state=migrated(owner);prepareRecruitmentState(state,v2Catalog,now);return state;}
function unownedOffer(state){const owned=new Set(state.mons.filter(mon=>mon.ownership==='permanent').map(mon=>mon.speciesId));return state.recruitmentV2.lineupSpeciesIds.find(id=>!owned.has(id));}
function recruitAction(state,type,speciesId,actionId){return {type,speciesId,actionId,expectedRevision:state.recruitmentV2.revision,cycleId:state.recruitmentV2.cycleId};}
function applyRecruit(state,action,now){const result=applyV2RecruitmentAction(state,action,v2Catalog,{serverNow:now});assert.equal(result.ok,true,result.code);return result.state;}

function addTrialToSixTeam(state,trialSpeciesId){
 const progression=getV2Progression(state,v2Catalog),trialMon=progression.mons.find(mon=>mon.speciesId===trialSpeciesId),trialBuild=progression.builds.find(build=>build.monId===trialMon.monId),team=progression.teams[0];
 const action={type:'team.save',expectedRevision:team.revision,team:{teamId:team.teamId,name:team.name,buildIds:[...team.buildIds.slice(0,5),trialBuild.buildId]}};const saved=applyV2ProgressionAction(state,action,v2Catalog);assert.equal(saved.ok,true,saved.code);return {state:saved.state,trialMonId:trialMon.monId,trialBuildId:trialBuild.buildId,teamId:team.teamId};
}

test('Roster Ranch rolls eight stable unique offers, prioritizes an unowned species and does not reroll on reload',()=>{
 const state=prepared(),beforeRng=state.rngState.recruitment,lineup=[...state.recruitmentV2.lineupSpeciesIds],owned=new Set(state.mons.filter(mon=>mon.ownership==='permanent').map(mon=>mon.speciesId));
 assert.equal(lineup.length,8);assert.equal(new Set(lineup).size,8);assert.equal(owned.has(lineup[0]),false);
 prepareRecruitmentState(state,v2Catalog,T0+12345);assert.deepEqual(state.recruitmentV2.lineupSpeciesIds,lineup);assert.equal(state.rngState.recruitment,beforeRng);
 const restarted=JSON.parse(JSON.stringify(state));prepareRecruitmentState(restarted,v2Catalog,T0+23456);assert.deepEqual(restarted.recruitmentV2.lineupSpeciesIds,lineup);assert.equal(restarted.rngState.recruitment,beforeRng);
});

test('paid refresh is atomic, limited to three per cycle and idempotent by actionId',()=>{
 let state=prepared('refresh-owner'),coins=state.wallet.coins,firstAction,firstReceipt;
 for(let i=1;i<=3;i++){const action={type:'recruit.refresh',actionId:`refresh:${i}`,expectedRevision:state.recruitmentV2.revision,cycleId:state.recruitmentV2.cycleId},result=applyV2RecruitmentAction(state,action,v2Catalog,{serverNow:T0});assert.equal(result.ok,true);state=result.state;if(i===1){firstAction=action;firstReceipt=result.receipt;}assert.equal(state.recruitmentV2.refreshCount,i);assert.equal(state.wallet.coins,coins-i*100);assert.equal(new Set(state.recruitmentV2.lineupSpeciesIds).size,8);}
 const before=JSON.stringify(state),blocked=applyV2RecruitmentAction(state,{type:'recruit.refresh',actionId:'refresh:4',expectedRevision:state.recruitmentV2.revision,cycleId:state.recruitmentV2.cycleId},v2Catalog,{serverNow:T0});assert.equal(blocked.code,'REFRESH_LIMIT_REACHED');assert.equal(JSON.stringify(state),before);
 const duplicate=applyV2RecruitmentAction(state,firstAction,v2Catalog,{serverNow:T0});assert.equal(duplicate.ok,true);assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.receipt,firstReceipt);assert.equal(duplicate.state.wallet.coins,state.wallet.coins);assert.equal(duplicate.state.recruitmentV2.refreshCount,3);
 const conflict=applyV2RecruitmentAction(state,{type:'recruit.trial',speciesId:unownedOffer(state),actionId:firstAction.actionId,expectedRevision:state.recruitmentV2.revision},v2Catalog,{serverNow:T0});assert.equal(conflict.code,'ACTION_ID_REUSED');
});

test('effective server time never rolls backward and cycle state cannot rewind',()=>{
 const state=prepared('clock-owner',T0+2*DAY+5000),cycle=state.recruitmentV2.cycleId,lineup=[...state.recruitmentV2.lineupSpeciesIds],seen=state.clockV2.lastSeenServerTime;
 prepareRecruitmentState(state,v2Catalog,T0-DAY);assert.equal(state.clockV2.lastSeenServerTime,seen);assert.equal(state.recruitmentV2.cycleId,cycle);assert.deepEqual(state.recruitmentV2.lineupSpeciesIds,lineup);
});

test('trial is free/read-only, one active slot, expires at the server deadline and remains referenced',()=>{
 let state=prepared('trial-lifecycle'),speciesId=unownedOffer(state);state=applyRecruit(state,recruitAction(state,'recruit.trial',speciesId,'trial:start'),T0);const progression=getV2Progression(state,v2Catalog),mon=progression.mons.find(entry=>entry.speciesId===speciesId),build=progression.builds.find(entry=>entry.monId===mon.monId),expires=Date.parse(mon.trialExpiresAt);assert.equal(expires,T0+TRIAL);assert.equal(state.wallet.coins,2400);assert.equal(mon.ownership,'trial');assert.equal(mon.trialExpired,false);
 const secondSpecies=state.recruitmentV2.lineupSpeciesIds.find(id=>id!==speciesId&&!state.mons.some(mon=>mon.speciesId===id&&mon.ownership==='permanent')),blocked=applyV2RecruitmentAction(state,recruitAction(state,'recruit.trial',secondSpecies,'trial:second'),v2Catalog,{serverNow:T0});assert.equal(blocked.code,'TRIAL_SLOT_OCCUPIED');
 const sameAgain=applyV2RecruitmentAction(state,recruitAction(state,'recruit.trial',speciesId,'trial:repeat'),v2Catalog,{serverNow:T0});assert.equal(sameAgain.code,'TRIAL_ALREADY_USED_THIS_CYCLE');
 const edit=applyV2ProgressionAction(state,{type:'build.save',expectedRevision:build.revision,build:{...build,name:'Không được sửa'}},v2Catalog);assert.equal(edit.code,'TRIAL_READ_ONLY');
 const refs=addTrialToSixTeam(state,speciesId);state=refs.state;prepareRecruitmentState(state,v2Catalog,expires);const after=getV2Progression(state,v2Catalog),expired=after.mons.find(entry=>entry.monId===refs.trialMonId),team=after.teams.find(entry=>entry.teamId===refs.teamId);assert.equal(expired.trialExpired,true);assert.ok(team.buildIds.includes(refs.trialBuildId));assert.ok(after.builds.some(entry=>entry.buildId===refs.trialBuildId));
});

test('expired Trial stays projected for permanent upgrade and makes its referenced team visibly invalid',()=>{
 let state=prepared('trial-ui'),speciesId=unownedOffer(state);state=applyRecruit(state,recruitAction(state,'recruit.trial',speciesId,'trial:ui'),T0);const refs=addTrialToSixTeam(state,speciesId);state=refs.state;const expiry=Date.parse(getV2Progression(state,v2Catalog).mons.find(mon=>mon.monId===refs.trialMonId).trialExpiresAt),recruitView=recruitmentView(state,v2Catalog,expiry+1),training=v2TrainingView(state,v2Catalog,{now:expiry+1});assert.equal(recruitView.trialOffer.speciesId,speciesId);assert.equal(recruitView.trialOffer.ownership,'trial-expired');assert.ok(recruitView.trialOffer.priceCoins>0);assert.equal(training.mons.find(mon=>mon.monId===refs.trialMonId).trialExpired,true);
 const publicState={trainingV2:training,recruitmentV2:recruitView,types:v2Catalog.species.flatMap(species=>species.types).filter((value,index,array)=>array.indexOf(value)===index),typeChart:Array.from({length:12},()=>Array(12).fill(1))},team=training.teams.find(entry=>entry.teamId===refs.teamId),analysis=analyzeTeam(team.buildIds,publicState,v2Catalog);assert.ok(analysis.issues.some(issue=>issue.includes('Trial expired')));
 const upgraded=applyV2RecruitmentAction(state,recruitAction(state,'recruit.permanent',speciesId,'trial:ui-upgrade'),v2Catalog,{serverNow:expiry+1});assert.equal(upgraded.ok,true,upgraded.code);const after=getV2Progression(upgraded.state,v2Catalog);assert.equal(after.mons.find(mon=>mon.monId===refs.trialMonId).ownership,'permanent');assert.ok(after.teams.find(entry=>entry.teamId===refs.teamId).buildIds.includes(refs.trialBuildId));
});

test('trial expiry blocks preview lock before snapshot but never revokes an already locked battle',()=>{
 let state=prepared('trial-battle'),speciesId=unownedOffer(state);state=applyRecruit(state,recruitAction(state,'recruit.trial',speciesId,'trial:battle'),T0);let refs=addTrialToSixTeam(state,speciesId);state=refs.state;const expires=Date.parse(getV2Progression(state,v2Catalog).mons.find(mon=>mon.monId===refs.trialMonId).trialExpiresAt);
 let started=applyV2BattleAction(state,{type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal',teamId:refs.teamId},v2Catalog,{serverNow:expires-1});assert.equal(started.ok,true,started.code);const pick=started.state.battleV2.playerRoster.slice(0,2).map(mon=>mon.buildId);if(!pick.includes(refs.trialBuildId))pick.push(refs.trialBuildId);else pick.push(started.state.battleV2.playerRoster.find(mon=>!pick.includes(mon.buildId))?.buildId);const selected=[...new Set(pick)].slice(0,3);while(selected.length<3)selected.push(started.state.battleV2.playerRoster.find(mon=>!selected.includes(mon.buildId)).buildId);
 const blocked=applyV2BattleAction(started.state,{type:'battleV2.preview.lock',buildIds:selected},v2Catalog,{serverNow:expires});assert.equal(blocked.code,'ROSTER_ILLEGAL');assert.ok(blocked.details.includes('TRIAL_EXPIRED'));
 started=applyV2BattleAction(state,{type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal',teamId:refs.teamId},v2Catalog,{serverNow:expires-2});assert.equal(started.ok,true);const lockPick=started.state.battleV2.playerRoster.slice(0,3).map(mon=>mon.buildId);if(!lockPick.includes(refs.trialBuildId))lockPick[2]=refs.trialBuildId;const locked=applyV2BattleAction(started.state,{type:'battleV2.preview.lock',buildIds:lockPick},v2Catalog,{serverNow:expires-1});assert.equal(locked.ok,true,locked.code);assert.notEqual(locked.state.battleV2.phase,'PREVIEW');
 const afterExpiry=applyV2BattleAction(locked.state,{type:'battleV2.surrender'},v2Catalog,{serverNow:expires+1});assert.equal(afterExpiry.ok,true,afterExpiry.code);assert.equal(afterExpiry.state.battleV2.phase,'FINISHED');assert.equal(getV2Progression(afterExpiry.state,v2Catalog).mons.find(mon=>mon.monId===refs.trialMonId).trialExpired,true);
});

test('M4 UI acceptance chain keeps the exact Mon/build/team reference through battle, expiry and permanent recruit',()=>{
 let state=prepared('trial-acceptance'),speciesId=unownedOffer(state);state=applyRecruit(state,recruitAction(state,'recruit.trial',speciesId,'trial:acceptance'),T0);const refs=addTrialToSixTeam(state,speciesId);state=refs.state;const expires=Date.parse(getV2Progression(state,v2Catalog).mons.find(mon=>mon.monId===refs.trialMonId).trialExpiresAt);
 const preview=applyV2BattleAction(state,{type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal',teamId:refs.teamId},v2Catalog,{serverNow:expires-2});assert.equal(preview.ok,true,preview.code);const pick=preview.state.battleV2.playerRoster.slice(0,3).map(mon=>mon.buildId);if(!pick.includes(refs.trialBuildId))pick[2]=refs.trialBuildId;const locked=applyV2BattleAction(preview.state,{type:'battleV2.preview.lock',buildIds:pick},v2Catalog,{serverNow:expires-1});assert.equal(locked.ok,true,locked.code);
 const finished=applyV2BattleAction(locked.state,{type:'battleV2.surrender'},v2Catalog,{serverNow:expires+1});assert.equal(finished.ok,true,finished.code);const expired=getV2Progression(finished.state,v2Catalog);assert.equal(expired.mons.find(mon=>mon.monId===refs.trialMonId).trialExpired,true);
 const upgraded=applyV2RecruitmentAction(finished.state,recruitAction(finished.state,'recruit.permanent',speciesId,'recruit:acceptance'),v2Catalog,{serverNow:expires+1});assert.equal(upgraded.ok,true,upgraded.code);const after=getV2Progression(upgraded.state,v2Catalog);assert.equal(after.mons.find(mon=>mon.monId===refs.trialMonId).ownership,'permanent');assert.ok(after.builds.some(build=>build.buildId===refs.trialBuildId&&build.monId===refs.trialMonId));assert.ok(after.teams.find(team=>team.teamId===refs.teamId).buildIds.includes(refs.trialBuildId));
});

test('recruiting permanent upgrades the same expired trial mon/build and unlocks editing',()=>{
 let state=prepared('trial-upgrade'),speciesId=unownedOffer(state);state=applyRecruit(state,recruitAction(state,'recruit.trial',speciesId,'trial:upgrade'),T0);const before=getV2Progression(state,v2Catalog),mon=before.mons.find(entry=>entry.speciesId===speciesId),build=before.builds.find(entry=>entry.monId===mon.monId),expires=Date.parse(mon.trialExpiresAt);prepareRecruitmentState(state,v2Catalog,expires);const cost=v2Catalog.economy.recruitment.permanentCostCoins,coins=state.wallet.coins,action=recruitAction(state,'recruit.permanent',speciesId,'recruit:upgrade'),result=applyV2RecruitmentAction(state,action,v2Catalog,{serverNow:expires});assert.equal(result.ok,true,result.code);assert.equal(result.receipt.upgradedTrial,true);assert.equal(result.receipt.monId,mon.monId);assert.equal(result.receipt.buildId,build.buildId);assert.equal(result.state.wallet.coins,coins-cost);
 const after=getV2Progression(result.state,v2Catalog),upgraded=after.mons.find(entry=>entry.monId===mon.monId);assert.equal(upgraded.ownership,'permanent');assert.equal(upgraded.trialExpiresAt,null);assert.equal(upgraded.trialExpired,false);assert.ok(after.builds.some(entry=>entry.buildId===build.buildId));assert.ok(result.state.collection.some(entry=>entry.id===v2Catalog.speciesById[speciesId].legacyId));
 const savedBuild=after.builds.find(entry=>entry.buildId===build.buildId),edit=applyV2ProgressionAction(result.state,{type:'build.save',expectedRevision:savedBuild.revision,build:{...savedBuild,name:'Permanent editable'}},v2Catalog);assert.equal(edit.ok,true,edit.code);
});

test('a recruitment ticket buys any offered species without a rarity tier',()=>{
 const state=prepared('ticket-recruit'),speciesId=unownedOffer(state),action={...recruitAction(state,'recruit.permanent',speciesId,'recruit:ticket'),payment:'ticket'},beforeCoins=state.wallet.coins,result=applyV2RecruitmentAction(state,action,v2Catalog,{serverNow:T0});assert.equal(result.ok,true,result.code);assert.equal(result.receipt.payment,'ticket');assert.equal(result.receipt.costTickets,1);assert.equal(result.state.wallet.recruitmentTickets,0);assert.equal(result.state.wallet.coins,beforeCoins);assert.equal(getV2Progression(result.state,v2Catalog).mons.find(mon=>mon.speciesId===speciesId)?.ownership,'permanent');
});

test('legacy ownership synchronization upgrades an existing trial instead of creating a duplicate Mon',()=>{
 let state=prepared('trial-legacy-upgrade'),speciesId=unownedOffer(state);state=applyRecruit(state,recruitAction(state,'recruit.trial',speciesId,'trial:legacy'),T0);const before=getV2Progression(state,v2Catalog),trial=before.mons.find(mon=>mon.speciesId===speciesId),build=before.builds.find(entry=>entry.monId===trial.monId),species=v2Catalog.speciesById[speciesId];state.collection.push({id:species.legacyId,level:5,item:0,xp:0});synchronizeLegacyState(state,v2Catalog);const after=getV2Progression(state,v2Catalog),matching=after.mons.filter(mon=>mon.speciesId===speciesId);assert.equal(matching.length,1);assert.equal(matching[0].monId,trial.monId);assert.equal(matching[0].ownership,'permanent');assert.ok(after.builds.some(entry=>entry.buildId===build.buildId));
});

test('lineup, refresh count, action receipt and monotonic clock survive a local-server restart',async()=>{
 const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-trial-'));let now=T0+2*60*60*1000,app=createLocalServer({saveDir,clock:createServerClock(()=>now)});
 try{
  let port=await app.listen(0),client=await openClient(port),initial=client.initial.view.recruitmentV2;assert.equal(initial.offers.length,8);const beforeCoins=client.initial.view.coins,action={type:'recruit.refresh',actionId:'refresh:restart',expectedRevision:initial.revision,cycleId:initial.cycleId};client.ws.send(JSON.stringify({type:'action',action}));let frame=await client.next(m=>m.type==='state'&&m.view?.recruitmentV2?.refresh?.count===1),lineup=frame.view.recruitmentV2.offers.map(o=>o.speciesId),coins=frame.view.coins,effective=frame.view.recruitmentV2.effectiveNow;assert.equal(coins,beforeCoins-100);client.ws.close();await app.close();
  now=T0-DAY;app=createLocalServer({saveDir,clock:createServerClock(()=>now)});port=await app.listen(0);client=await openClient(port);assert.deepEqual(client.initial.view.recruitmentV2.offers.map(o=>o.speciesId),lineup);assert.equal(client.initial.view.recruitmentV2.refresh.count,1);assert.ok(client.initial.view.recruitmentV2.effectiveNow>=effective);assert.equal(client.initial.view.coins,coins);client.ws.send(JSON.stringify({type:'action',action}));frame=await client.next(m=>m.type==='state'&&m.view?.recruitmentV2?.refresh?.count===1);assert.equal(frame.view.coins,coins);assert.deepEqual(frame.view.recruitmentV2.offers.map(o=>o.speciesId),lineup);client.ws.close();
 }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});

async function openClient(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/trial`),frames=[],waiters=[];ws.on('message',raw=>{const frame=JSON.parse(raw),index=waiters.findIndex(waiter=>waiter.predicate(frame));if(index>=0)waiters.splice(index,1)[0].resolve(frame);else frames.push(frame);});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});const next=predicate=>{const index=frames.findIndex(predicate);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('frame timeout')),3000);waiters.push({predicate,resolve:frame=>{clearTimeout(timer);resolve(frame);}});});};ws.send(JSON.stringify({type:'join',playerId:'trial-owner'}));const initial=await next(frame=>frame.type==='state');return {ws,next,initial};
}
