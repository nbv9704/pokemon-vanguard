import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyMissionAction,ensureMissionState,missionView,recordMissionEvent} from '../server/missions.mjs';
import {MissionView} from '../public/js/mission-view.js';

const MONDAY=Date.UTC(2026,8,21,8),DAY=24*60*60*1000;
const state=()=>({seed:1,coins:100,crystals:50,recruitmentTickets:2,wallet:{coins:100,crystals:50,recruitmentTickets:2},progressionV3:{mons:Array.from({length:6},(_,i)=>({monId:`m${i}`,ownership:'permanent'}))}});

test('daily missions reset by UTC day while starter progress persists',()=>{
 const adventure=state();ensureMissionState(adventure,MONDAY,{login:true});recordMissionEvent(adventure,'battles',1,MONDAY);recordMissionEvent(adventure,'wins',1,MONDAY);
 let view=missionView(adventure,MONDAY);assert.equal(view.daily.find(entry=>entry.id==='daily-login').claimable,true);assert.equal(view.daily.find(entry=>entry.id==='daily-battle').progress,1);assert.equal(view.starter.find(entry=>entry.id==='starter-win').progress,1);
 ensureMissionState(adventure,MONDAY+DAY,{login:true});view=missionView(adventure,MONDAY+DAY);assert.equal(view.daily.find(entry=>entry.id==='daily-battle').progress,0);assert.equal(view.daily.find(entry=>entry.id==='daily-login').progress,1);assert.equal(view.starter.find(entry=>entry.id==='starter-win').progress,1);
});

test('mission rewards are authoritative and cannot be claimed twice',()=>{
 const adventure=state();ensureMissionState(adventure,MONDAY,{login:true});const before=adventure.wallet.recruitmentTickets,claimed=applyMissionAction(adventure,{type:'mission.claim',category:'daily',missionId:'daily-login',actionId:'mission:test-login'},{serverNow:MONDAY});assert.equal(claimed.ok,true);assert.equal(claimed.state.wallet.recruitmentTickets,before+6);
 const duplicate=applyMissionAction(claimed.state,{type:'mission.claim',category:'daily',missionId:'daily-login',actionId:'mission:test-login-2'},{serverNow:MONDAY});assert.equal(duplicate.ok,false);assert.equal(duplicate.code,'MISSION_ALREADY_CLAIMED');
});

test('claim all collects every completed reward and daily completion bonus',()=>{
 const adventure=state();ensureMissionState(adventure,MONDAY,{login:true});for(const event of ['battles','wins','recruits'])recordMissionEvent(adventure,event,1,MONDAY);const projected=missionView(adventure,MONDAY);assert.equal(projected.daily.filter(entry=>entry.claimable).length,5);
 const result=applyMissionAction(adventure,{type:'mission.claimAll',category:'daily',actionId:'mission:test-all'},{serverNow:MONDAY});assert.equal(result.ok,true);assert.equal(result.claimed.length,5);assert.equal(result.state.wallet.recruitmentTickets,26);assert.equal(result.state.wallet.coins,700);assert.equal(result.state.wallet.crystals,350);assert.equal(missionView(result.state,MONDAY).daily.every(entry=>entry.claimed),true);
});

test('mission view renders categories and emits claim actions',()=>{
 const adventure=state();ensureMissionState(adventure,MONDAY,{login:true});const publicView={missions:missionView(adventure,MONDAY)},sent=[],screen=new MissionView({sendAction:action=>sent.push(action),onChange:()=>{},createActionId:()=> 'mission:ui'}),html=screen.render(publicView);assert.match(html,/Daily Missions/);assert.match(html,/Log in to the game/);screen.handleClick({dataset:{mission:'claim',category:'daily',missionId:'daily-login'}});assert.deepEqual(sent[0],{type:'mission.claim',category:'daily',missionId:'daily-login',actionId:'mission:ui'});
});
