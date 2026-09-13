import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {v3BattleSnapshot} from '../server/v3-battle-view.mjs';
import {V3BattleScreen} from '../public/js/v3-battle-screen.js';
import {v3FieldEffectState,renderV3FieldEffects} from '../public/js/v3-field-effects.js';
import {renderV3PlaybackControls} from '../public/js/v3-playback-controls.js';
import {V3PlaybackRunner} from '../public/js/v3-playback-runner.js';
import {battleEventText,createTurnFrames} from '../public/js/v3-battle-timeline.js';

test('playback runner scales waits and cancellation releases pending timers',async()=>{
 const waits=[],scaled=new V3PlaybackRunner({waitImpl:async ms=>waits.push(ms)});scaled.configure({speed:2});await scaled.wait(1050);assert.deepEqual(waits,[525]);
 const runner=new V3PlaybackRunner();runner.configure({speed:1});const started=Date.now(),pending=runner.wait(1000);setTimeout(()=>runner.cancel(),5);await pending;assert.ok(Date.now()-started<200);
});

test('schema-3 Skip commits the authoritative final view and ends playback immediately',async()=>{
 let draws=0;const screen=new V3BattleScreen({onChange:()=>draws++,sendAction(){}}),view={turnSnapshots:{initial:{turn:1,own:[],opponent:[{actorId:'B-0',name:'Target',hpPercent:100,activeSlot:0}]}},events:[{id:'1',kind:'turnStarted',turn:1},{id:'2',kind:'moveStarted',actorId:'A-0',moveId:'stored-power'},{id:'3',kind:'damage',targetId:'B-0',hpAfterPercent:50}],history:[]};
 const playing=screen.playTurn(view);await Promise.resolve();assert.equal(screen.playback.stage,'cast');assert.match(renderV3PlaybackControls({speed:1,playing:true}),/Skip animation/);assert.equal(screen.skipPlayback(),true);await playing;assert.equal(screen.playback,null);assert.ok(draws>=2);
});

test('field adapter renders persistent weather, terrain, room and public side conditions',()=>{
 const snapshot={field:{weather:{id:'rain',remaining:4},terrain:{id:'electric',remaining:3},trickRoom:{remaining:2}},sideConditions:{own:{reflect:{remaining:5}},opponent:{tailwind:3}}},state=v3FieldEffectState(snapshot),html=renderV3FieldEffects(snapshot);
 assert.equal(state.weather.id,'rain');assert.equal(state.trickRoom,2);assert.deepEqual(state.own.map(entry=>entry.id),['reflect']);assert.match(html,/weather-rain/);assert.match(html,/terrain-electric/);assert.match(html,/trick-room/);assert.match(html,/Reflect<\/b> · 5T/);assert.match(html,/Tailwind<\/b> · 3T/);
});

test('condition events update only their declared layer at the impact commit point',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[],opponent:[]},events=[{kind:'moveStarted',actorId:'A-0',moveId:'protect'},{kind:'weatherStarted',weather:'rain',remaining:5},{kind:'sideConditionApplied',side:'A',condition:'reflect',remaining:5}],frames=createTurnFrames(initial,events);
 assert.equal(frames[0].snapshot.field.weather,undefined);assert.equal(frames[1].snapshot.field.weather.id,'rain');assert.equal(frames[1].snapshot.sideConditions.own.reflect.remaining,5);assert.match(battleEventText(events[1],initial,publicV3Catalog),/Rain weather began for 5 turns/);
 assert.match(battleEventText(events[2],initial,publicV3Catalog),/Your side gained Reflect for 5 turns/);
});

test('battle projection exposes public field state without sharing team internals',()=>{
 const unit={actorId:'A-0',speciesId:'venusaur',name:'Venusaur',spriteKey:'venusaur',types:['grass','poison'],hp:100,maxHp:100},foe={...unit,actorId:'B-0'},battle={id:'field-view',format:'single',phase:'COMMAND',phaseRevision:2,turn:1,result:null,field:{weather:{id:'rain',remaining:4}},sides:{A:{active:['A-0'],roster:[unit],conditions:{reflect:{remaining:5}}},B:{active:['B-0'],roster:[foe],conditions:{tailwind:3}}}};
 const view=v3BattleSnapshot(battle);assert.equal(view.field.weather.id,'rain');assert.equal(view.sideConditions.own.reflect.remaining,5);assert.equal(view.sideConditions.opponent.tailwind,3);
});
