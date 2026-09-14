import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {v3BattleSnapshot} from '../server/v3-battle-view.mjs';
import {V3BattleScreen} from '../public/js/v3-battle-screen.js';
import {v3FieldEffectState,renderV3FieldEffects} from '../public/js/v3-field-effects.js';
import {renderV3PlaybackControls} from '../public/js/v3-playback-controls.js';
import {V3PlaybackRunner} from '../public/js/v3-playback-runner.js';
import {applyBattleEvent,battleEventText,createTurnFrames} from '../public/js/v3-battle-timeline.js';

test('playback runner scales waits and cancellation releases pending timers',async()=>{
 const waits=[],scaled=new V3PlaybackRunner({waitImpl:async ms=>waits.push(ms)});scaled.configure({speed:2});await scaled.wait(1050);assert.deepEqual(waits,[525]);
 const runner=new V3PlaybackRunner();runner.configure({speed:1});const started=Date.now(),pending=runner.wait(1000);setTimeout(()=>runner.cancel(),5);await pending;assert.ok(Date.now()-started<200);
});

test('schema-3 Skip commits the authoritative final view and ends playback immediately',async()=>{
 let draws=0;const screen=new V3BattleScreen({onChange:()=>draws++,sendAction(){}}),view={turnSnapshots:{initial:{turn:1,own:[],opponent:[{actorId:'B-0',name:'Target',hpPercent:100,activeSlot:0}]}},events:[{id:'1',kind:'turnStarted',turn:1},{id:'2',kind:'moveStarted',actorId:'A-0',moveId:'stored-power'},{id:'3',kind:'damage',targetId:'B-0',hpAfterPercent:50}],history:[]};
 const playing=screen.playTurn(view);await Promise.resolve();assert.equal(screen.playback.stage,'cast');assert.match(renderV3PlaybackControls({speed:1,playing:true}),/Skip animation/);assert.equal(screen.skipPlayback(),true);await playing;assert.equal(screen.playback,null);assert.ok(draws>=2);
});

test('field adapter renders persistent weather, terrain, room and public side conditions',()=>{
 const snapshot={field:{weather:{id:'rain',remaining:4},terrain:{id:'electric',remaining:3},rooms:{'trick-room':{id:'trick-room',remaining:2},'wonder-room':{id:'wonder-room',remaining:4}}},sideConditions:{own:{reflect:{remaining:5}},opponent:{tailwind:3}}},state=v3FieldEffectState(snapshot),html=renderV3FieldEffects(snapshot);
 assert.equal(state.weather.id,'rain');assert.equal(state.trickRoom,2);assert.deepEqual(state.rooms.map(entry=>entry.id),['trick-room','wonder-room']);assert.deepEqual(state.own.map(entry=>entry.id),['reflect']);assert.match(html,/weather-rain/);assert.match(html,/terrain-electric/);assert.match(html,/room-trick-room/);assert.match(html,/room-wonder-room/);assert.match(html,/Wonder Room<\/b> · 4T/);assert.match(html,/Reflect<\/b> · 5T/);assert.match(html,/Tailwind<\/b> · 3T/);
});

test('condition events update only their declared layer at the impact commit point',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[],opponent:[]},events=[{kind:'moveStarted',actorId:'A-0',moveId:'protect'},{kind:'weatherStarted',weather:'rain',remaining:5},{kind:'sideConditionApplied',side:'A',condition:'reflect',remaining:5}],frames=createTurnFrames(initial,events);
 assert.equal(frames[0].snapshot.field.weather,undefined);assert.equal(frames[1].snapshot.field.weather.id,'rain');assert.equal(frames[1].snapshot.sideConditions.own.reflect.remaining,5);assert.match(battleEventText(events[1],initial,publicV3Catalog),/Rain weather began for 5 turns/);
 assert.match(battleEventText(events[2],initial,publicV3Catalog),/Your side gained Reflect for 5 turns/);
});

test('promoted terrain start/end events drive the persistent field layer and Battle Log text',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[],opponent:[]},started={kind:'terrainStarted',terrain:'grassy',remaining:5},frames=createTurnFrames(initial,[{kind:'moveStarted',actorId:'A-0',moveId:'grassy-terrain'},started]);
 assert.equal(frames[0].snapshot.field.terrain,undefined);assert.equal(frames[1].snapshot.field.terrain.id,'grassy');assert.match(renderV3FieldEffects(frames[1].snapshot),/terrain-grassy/);assert.match(battleEventText(started,initial,publicV3Catalog),/Grassy terrain appeared for 5 turns/);
 assert.match(battleEventText({kind:'terrainEnded',terrain:'grassy'},initial,publicV3Catalog),/Grassy terrain disappeared/);
});

test('hazard events persist layered side chips and Battle Log text',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[],opponent:[{actorId:'B-0',name:'Target'}]},applied={kind:'hazardApplied',side:'B',hazard:'spikes',layers:2,maxLayers:3},triggered={kind:'hazardTriggered',targetId:'B-0',side:'B',hazard:'spikes',layers:2,amount:24,effectiveness:1},frames=createTurnFrames(initial,[{kind:'moveStarted',actorId:'A-0',moveId:'spikes'},applied]);
 const removed=applyBattleEvent(frames[1].snapshot,{kind:'hazardRemoved',actorId:'A-0',moveId:'defog',side:'B',hazard:'spikes',layers:2,reason:'defog'});assert.equal(removed.sideConditions.opponent.spikes,undefined);assert.match(battleEventText({kind:'hazardRemoved',actorId:'A-0',moveId:'defog',side:'B',hazard:'spikes'},initial,publicV3Catalog),/Spikes was cleared from the opposing side by Defog/);
 assert.equal(frames[0].snapshot.sideConditions.opponent.spikes,undefined);assert.equal(frames[1].snapshot.sideConditions.opponent.spikes.layers,2);assert.match(renderV3FieldEffects(frames[1].snapshot),/Spikes<\/b> · ×2/);assert.match(battleEventText(applied,initial,publicV3Catalog),/Spikes was set on the opposing side \(layer 2\/3\)/);assert.match(battleEventText(triggered,initial,publicV3Catalog),/Target was hurt by Spikes for 24 HP/);
});

test('battle projection exposes public field state without sharing team internals',()=>{
 const unit={actorId:'A-0',speciesId:'venusaur',name:'Venusaur',spriteKey:'venusaur',types:['grass','poison'],hp:100,maxHp:100},foe={...unit,actorId:'B-0'},battle={id:'field-view',format:'single',phase:'COMMAND',phaseRevision:2,turn:1,result:null,field:{weather:{id:'rain',remaining:4}},sides:{A:{active:['A-0'],roster:[unit],conditions:{reflect:{remaining:5}}},B:{active:['B-0'],roster:[foe],conditions:{tailwind:3}}}};
 const view=v3BattleSnapshot(battle);assert.equal(view.field.weather.id,'rain');assert.equal(view.sideConditions.own.reflect.remaining,5);assert.equal(view.sideConditions.opponent.tailwind,3);
});

test('Toxic Spikes playback shows status trigger, two-layer chip, and Poison-type absorption cleanup',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[{actorId:'A-0',name:'Beedrill'}],opponent:[{actorId:'B-0',name:'Target'}]};
 const applied={kind:'hazardApplied',side:'B',hazard:'toxic-spikes',layers:2,maxLayers:2},withHazard=applyBattleEvent(initial,applied);assert.equal(withHazard.sideConditions.opponent['toxic-spikes'].layers,2);assert.match(renderV3FieldEffects(withHazard),/Toxic Spikes<\/b> · ×2/);
 const triggered={kind:'hazardTriggered',targetId:'B-0',side:'B',hazard:'toxic-spikes',layers:2,status:'bad-poison'};assert.match(battleEventText(triggered,initial,publicV3Catalog),/Toxic Spikes triggered on Target, inflicting Bad Poison/);
 const absorbed={kind:'hazardRemoved',actorId:'A-0',targetId:'A-0',side:'A',hazard:'toxic-spikes',layers:2,reason:'poison-type-absorption'},ownHazard=applyBattleEvent({...initial,sideConditions:{own:{'toxic-spikes':{id:'toxic-spikes',layers:2}},opponent:{}}},absorbed);assert.equal(ownHazard.sideConditions.own['toxic-spikes'],undefined);assert.match(battleEventText(absorbed,initial,publicV3Catalog),/Beedrill absorbed Toxic Spikes from your side/);
});


test('Room events update independent room layers and Battle Log text',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[],opponent:[]},wonder={kind:'roomStarted',room:'wonder-room',remaining:5},magic={kind:'roomStarted',room:'magic-room',remaining:5};
 let state=applyBattleEvent(initial,wonder);state=applyBattleEvent(state,magic);assert.equal(state.field.rooms['wonder-room'].remaining,5);assert.equal(state.field.rooms['magic-room'].remaining,5);assert.match(renderV3FieldEffects(state),/room-wonder-room/);assert.match(renderV3FieldEffects(state),/room-magic-room/);assert.match(battleEventText(wonder,initial,publicV3Catalog),/Wonder Room swapped Defense and Sp. Def for 5 turns/);
 state=applyBattleEvent(state,{kind:'roomEnded',room:'wonder-room',reason:'recast'});assert.equal(state.field.rooms['wonder-room'],undefined);assert.ok(state.field.rooms['magic-room']);assert.match(battleEventText({kind:'roomEnded',room:'wonder-room',reason:'recast'},initial,publicV3Catalog),/Wonder Room ended after being used again/);
});


test('item reveal, activation and consume events update playback state and Battle Log text',()=>{
 const initial={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[{actorId:'A-0',name:'Venusaur',activeSlot:0}],opponent:[{actorId:'B-0',name:'Primarina',activeSlot:0}]};
 let state=applyBattleEvent(initial,{kind:'itemRevealed',sourceId:'B-0',itemId:'sitrus-berry'});assert.equal(state.opponent[0].revealedItemId,'sitrus-berry');assert.equal(state.opponent[0].itemConsumed,undefined);
 state=applyBattleEvent(state,{kind:'itemConsumed',sourceId:'B-0',itemId:'sitrus-berry'});assert.equal(state.opponent[0].itemConsumed,true);
 assert.match(battleEventText({kind:'itemRevealed',sourceId:'B-0',itemId:'sitrus-berry'},initial,publicV3Catalog),/Primarina revealed Sitrus Berry/);
 assert.match(battleEventText({kind:'itemActivated',sourceId:'B-0',itemId:'sitrus-berry'},initial,publicV3Catalog),/Primarina's Sitrus Berry activated/);
 assert.match(battleEventText({kind:'itemConsumed',sourceId:'B-0',itemId:'sitrus-berry'},initial,publicV3Catalog),/Primarina consumed Sitrus Berry/);
 assert.equal(battleEventText({kind:'damage',actorId:'A-0',targetId:'A-0',amount:15,itemId:'life-orb',reason:'post-move-recoil'},initial,publicV3Catalog),'Venusaur lost 15 HP to Life Orb recoil.');
 assert.equal(battleEventText({kind:'damage',actorId:'B-0',targetId:'A-0',amount:26,itemId:'rocky-helmet',reason:'contact-retaliation'},initial,publicV3Catalog),"Venusaur lost 26 HP from Primarina's Rocky Helmet.");
 assert.equal(battleEventText({kind:'heal',actorId:'A-0',targetId:'A-0',amount:12,itemId:'shell-bell',reason:'damage-recovery'},initial,publicV3Catalog),'Venusaur recovered 12 HP with Shell Bell.');
});

test('Battle Log explains ability hooks and lifecycle failures without raw event names',()=>{
 const snapshot={own:[{actorId:'A-0',name:'Feraligatr'}],opponent:[{actorId:'B-0',name:'Chesnaught'}]};
 assert.match(battleEventText({kind:'abilityTriggered',sourceId:'A-0',abilityId:'sheer-force',effectId:'secondary-effect-power-boost',moveId:'waterfall',suppressedSecondaries:1},snapshot,publicV3Catalog),/Feraligatr's Sheer Force boosted Waterfall and suppressed 1 secondary effect/);
 assert.match(battleEventText({kind:'moveBlocked',targetId:'B-0',moveId:'bullet-seed',reason:'abilityImmune',abilityId:'bulletproof'},snapshot,publicV3Catalog),/Chesnaught's Bulletproof blocked Bullet Seed/);
 assert.match(battleEventText({kind:'statusFailed',targetId:'B-0',status:'sleep',reason:'terrainBlocked'},snapshot,publicV3Catalog),/Chesnaught resisted Sleep: Terrain Blocked/);
 assert.equal(battleEventText({kind:'turnSuspended'},snapshot,publicV3Catalog),'The turn paused for an entry replacement.');
 assert.equal(battleEventText({kind:'turnResumed'},snapshot,publicV3Catalog),'The interrupted turn resumed.');
});
