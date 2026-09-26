import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyMechanicsSwitch,compilePassiveEffects,createHeldItemState,resolveReactiveSwitchItems,validateMechanicManifest} from '../mechanics-v3/index.mjs';
import {applyHpGroup,applyReplacements,completeEntry,requestForcedReplacement,resolveActionQueue,resumeActionQueue,unitById} from '../rules-v3/index.mjs';
import {firstAiReplacements,v3BattleSnapshot} from '../server/v3-battle-view.mjs';
import {renderV3Replacements} from '../public/js/v3-battle-commands.js';
import {battleEventText} from '../public/js/v3-battle-timeline.js';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
function unit(actorId,itemId=null){return {actorId,speciesId:actorId,name:actorId.toUpperCase(),spriteKey:actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:100,spd:100,spe:100},pp:{tackle:10},maxPp:{tackle:10},status:null,volatiles:{},stages:stages(),abilityState:{},buildSnapshot:{abilityId:null,itemId,moveIds:['tackle']},itemState:createHeldItemState(itemId),passiveEffects:itemId?compilePassiveEffects({itemId,manifests}):[]};}
function fixture({format='single',targetItem='eject-button',bReserves=1,aReserves=1,field={}}={}){const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3'),unit('a4')],b=[unit('b1',targetItem),unit('b2'),unit('b3'),unit('b4')];return {id:`eject-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:17,eventSequence:0,events:[],result:null,field,sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a.slice(0,count+aReserves),conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b.slice(0,count+bReserves),conditions:{}}}};}
const move={id:'tackle',name:'Tackle',type:'normal',category:'physical',power:40,accuracy:100,contact:true};
const evidence={single:['r3-item-lifecycle-wave10:single'],double:['r3-item-lifecycle-wave10:double']};

for(const format of ['single','double'])test(`r3-item-lifecycle-wave10:${format} promotes Eject Button with live holder-switch behavior`,()=>{
 const manifest=manifests.items['eject-button'];assert.ok(manifest);assert.deepEqual(manifest.testEvidence[format],evidence[format]);assert.deepEqual(validateMechanicManifest(manifest,'items'),[]);
 const effect=compilePassiveEffects({itemId:'eject-button',manifests}).find(entry=>entry.kind==='item-holder-switch');assert.equal(effect?.sourceId,'eject-button');
 const state=fixture({format}),targetId=format==='double'?'b2':'b1';if(format==='double')state.sides.B.roster[1]=unit('b2','eject-button');
 const result=resolveReactiveSwitchItems(state,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:[targetId]});const request=result.battle.forcedReplacements.B[0];assert.equal(request.actorId,targetId);assert.equal(request.slot,format==='double'?1:0);assert.equal(unitById(result.battle,targetId).itemState.consumed,true);
});

test('Eject Button consumes only when a legal live replacement can be requested',()=>{
 let battle=fixture(),result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1']});
 assert.equal(result.battle.sides.B.roster[0].itemState.consumed,true);assert.equal(result.battle.sides.B.active[0],'b1');assert.deepEqual(result.battle.forcedReplacements.B,[{side:'B',slot:0,actorId:'b1',reason:'held-item',itemId:'eject-button'}]);assert.ok(result.events.some(event=>event.kind==='forcedReplacementRequested'&&event.actorId==='b1'));
 battle=fixture({bReserves:0});result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1']});assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);assert.equal(result.battle.forcedReplacements,undefined);
 battle=fixture({field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}});result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1']});assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);assert.equal(result.battle.forcedReplacements,undefined);
 battle=fixture();result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[{id:'apply-forced-switch'}]},damagedTargetIds:['b1']});assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);
 battle=fixture();result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:[]});assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);
 battle=fixture();battle.sides.B.roster[0].hp=0;result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1']});assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);
});

test('Double Eject Button requests never consume more holders than live reserve capacity',()=>{
 let battle=fixture({format:'double',bReserves:2});for(const index of [0,1]){const id=`b${index+1}`;battle.sides.B.roster[index]=unit(id,'eject-button');}let result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1','b2']});assert.deepEqual(result.battle.forcedReplacements.B.map(entry=>entry.slot),[0,1]);assert.equal(unitById(result.battle,'b1').itemState.consumed,true);assert.equal(unitById(result.battle,'b2').itemState.consumed,true);
 battle=fixture({format:'double',bReserves:1});for(const index of [0,1]){const id=`b${index+1}`;battle.sides.B.roster[index]=unit(id,'eject-button');}result=resolveReactiveSwitchItems(battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1','b2']});assert.deepEqual(result.battle.forcedReplacements.B.map(entry=>entry.slot),[0]);assert.equal(unitById(result.battle,'b1').itemState.consumed,true);assert.equal(unitById(result.battle,'b2').itemState.consumed,false);
});

test('Eject Button suspends the authoritative action queue and the switched-out holder loses its pending action',()=>{
 const battle=fixture(),actions=[{kind:'move',side:'A',actorId:'a1',moveId:'tackle',priority:0,speed:120},{kind:'move',side:'B',actorId:'b1',moveId:'late-hit',priority:0,speed:80}];
 const handlers={move(state,action){if(action.actorId==='a1'){const hit=applyHpGroup(state,[{actorId:'b1',delta:-20}],'tackle'),eject=resolveReactiveSwitchItems(hit.battle,{actorId:'a1',move,mechanics:{handlers:[]},damagedTargetIds:['b1']});return {battle:eject.battle,events:[...hit.events,...eject.events]};}return {battle:state,events:[{kind:'unexpectedMove',actorId:action.actorId}]};}};
 const first=resolveActionQueue(battle,actions,handlers);assert.equal(first.ok,true);assert.equal(first.suspended,true);assert.equal(first.battle.phase,'REPLACE');assert.equal(first.battle.pendingResolution!=null,true);assert.ok(first.events.some(event=>event.kind==='turnSuspended'&&event.reason==='forcedReplacement'));
 const replaced=applyReplacements(first.battle,{A:[],B:[{slot:0,actorId:'b2'}]});assert.equal(replaced.ok,true);assert.equal(replaced.battle.turn,1);assert.equal(replaced.battle.sides.B.active[0],'b2');assert.equal(replaced.battle.phase,'ENTRY');
 const entered=completeEntry(replaced.battle);assert.equal(entered.ok,true);assert.equal(entered.battle.phase,'RESOLVE');const resumed=resumeActionQueue(entered.battle,handlers);assert.equal(resumed.ok,true);assert.equal(resumed.battle.phase,'END_TURN');assert.ok(resumed.events.some(event=>event.kind==='actionCancelled'&&event.actorId==='b1'));assert.equal(resumed.events.some(event=>event.kind==='unexpectedMove'),false);
});

test('live forced replacement uses mechanics switch-out lifecycle, including infatuation source cleanup',()=>{
 let battle=fixture();battle.sides.A.roster[0].volatiles.infatuation={id:'infatuation',sourceId:'b1'};const requested=requestForcedReplacement(battle,{actorId:'b1',reason:'held-item',itemId:'eject-button'});battle=requested.battle;battle.phase='REPLACE';
 const result=applyReplacements(battle,{A:[],B:[{slot:0,actorId:'b2'}]},{applyLiveSwitch:(current,side,actorId,toId)=>applyMechanicsSwitch(current,side,actorId,toId,{manifests})});assert.equal(result.ok,true);assert.equal(unitById(result.battle,'a1').volatiles.infatuation,undefined);assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.reason==='sourceSwitched'));assert.ok(result.events.some(event=>event.kind==='switchOut'&&event.forced===true&&event.itemId==='eject-button'));
});

test('snapshot, AI replacement and client UI use authoritative live replacement slots',()=>{
 let player=fixture({targetItem:null});const requested=requestForcedReplacement(player,{actorId:'a1',reason:'held-item',itemId:'eject-button'});player=requested.battle;player.phase='REPLACE';const snapshot=v3BattleSnapshot(player);assert.deepEqual(snapshot.replacementSlots,[0]);const html=renderV3Replacements({replacementRevision:null,replacements:{}},{snapshot});assert.match(html,/data-v3-battle="replacement-choice"/);assert.match(html,/data-slot="0"/);assert.match(html,/A2/);
 let ai=fixture();const aiRequested=requestForcedReplacement(ai,{actorId:'b1',reason:'held-item',itemId:'eject-button'});ai=aiRequested.battle;ai.phase='REPLACE';assert.deepEqual(firstAiReplacements(ai),[{slot:0,actorId:'b2'}]);
 const text=battleEventText({kind:'forcedReplacementRequested',actorId:'b1',itemId:'eject-button'},v3BattleSnapshot(ai),{moves:[]});assert.match(text,/B1's Eject Button forced a replacement choice/);
});
