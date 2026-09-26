import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {validatePresentationDefinition,PRESENTATION_LAYERS,PRESENTATION_ANCHORS} from '../public/js/presentation/presentation-schema.js';
import {createMovePresentationPlan,movePresentationDefinition,presentationCoverage} from '../public/js/presentation/move-presentation.js';
import {BattlePresentationRuntime} from '../public/js/presentation/battle-presentation-runtime.js';
import {actorPresentationClass,cameraPresentationClass} from '../public/js/presentation/presentation-renderer.js';
import {renderV3BattleFx} from '../public/js/v3-move-fx.js';
import {V3PlaybackRunner} from '../public/js/v3-playback-runner.js';
import {V3BattleScreen} from '../public/js/v3-battle-screen.js';

test('R3-94 presentation schema exposes stable Pokémon-style layers and anchors',()=>{
 assert.deepEqual(PRESENTATION_LAYERS,['BACKGROUND','FIELD_BACK','ACTOR_BACK','ACTOR','ACTOR_FRONT','FX_FRONT','UI']);
 assert.ok(PRESENTATION_ANCHORS.includes('USER_TO_TARGET'));assert.ok(PRESENTATION_ANCHORS.includes('TARGET_CENTER'));assert.ok(PRESENTATION_ANCHORS.includes('FIELD_CENTER'));
 assert.deepEqual(validatePresentationDefinition({id:'bad',duration:10,cues:[{id:'x',type:'effect',at:20,primitive:'orb'}]}),{ok:false,error:'cue x has invalid at'});
});

test('R3-94 all 490 active moves compile into validated cast and impact definitions with an authoritative commit marker',()=>{
 const coverage=presentationCoverage(publicV3Catalog.moves);assert.equal(coverage.length,publicV3Catalog.moves.length);assert.ok(coverage.every(entry=>['signature-timeline','parameterized-template','legacy-adapter'].includes(entry.tier)&&entry.castCues>=3&&entry.impactCues>=3&&entry.commit));
 for(const move of publicV3Catalog.moves){assert.equal(validatePresentationDefinition(movePresentationDefinition(move,{stage:'cast'})).ok,true,move.id);assert.equal(validatePresentationDefinition(movePresentationDefinition(move,{stage:'impact'})).ok,true,move.id);}
});

test('R3-94 beam impact plans carry commit, target motion, camera, screen and semantic audio cues',()=>{
 const move=publicV3Catalog.moves.find(entry=>entry.id==='solar-beam'),plan=createMovePresentationPlan({stage:'impact',moveId:move.id,targetIds:['B-0']},publicV3Catalog);
 assert.equal(plan.profile.id,'beam');assert.equal(plan.tier,'signature-timeline');assert.equal(plan.template,'signature:solar-beam');assert.ok(plan.cues.some(cue=>cue.type==='commit'&&cue.at===0));assert.ok(plan.cues.some(cue=>cue.type==='actor'&&cue.role==='target'&&cue.primitive==='actor-shake'));assert.ok(plan.cues.some(cue=>cue.type==='camera'&&cue.primitive==='camera-shake'));assert.ok(plan.cues.some(cue=>cue.type==='screen'&&cue.primitive==='screen-flash'));assert.ok(plan.cues.some(cue=>cue.type==='audio'&&cue.sound.includes('grass')&&cue.sound.endsWith(':impact')));
 assert.match(cameraPresentationClass(plan),/presentation-camera-shake/);assert.match(cameraPresentationClass(plan),/presentation-screen-flash/);assert.match(actorPresentationClass(plan,{role:'target',targetIndex:0}),/presentation-actor-shake/);
});

test('R3-94 move renderer consumes presentation definitions while preserving authoritative spread target outcomes',()=>{
 const snapshot={format:'double',own:[{actorId:'A-0',activeSlot:0},{actorId:'A-1',activeSlot:1}],opponent:[{actorId:'B-0',activeSlot:0},{actorId:'B-1',activeSlot:1}]},playback={stage:'impact',snapshot,actorId:'B-0',moveId:'water-spout',targetIds:['A-0','A-1'],events:[{kind:'damage',targetId:'A-0'},{kind:'moveMissed',targetId:'A-1'}]},html=renderV3BattleFx(playback,publicV3Catalog);
 assert.match(html,/presentation-runtime/);assert.match(html,/data-presentation-definition="template-field-wave-impact"/);assert.match(html,/data-presentation-tier="parameterized-template"/);assert.match(html,/data-presentation-template="field-wave"/);assert.match(html,/fx-outcome-hit" data-fx-target="A-0"/);assert.match(html,/fx-outcome-miss" data-fx-target="A-1"/);assert.match(html,/--cue-at:/);assert.match(html,/presentation-screen-cue screen-flash/);
});

test('R3-94 presentation runtime routes semantic audio independently from battle state mutation',()=>{
 const seen=[],audio=[],runtime=new BattlePresentationRuntime({onCue:cue=>seen.push(cue.type),onAudio:cue=>audio.push(cue.sound)}),plan=createMovePresentationPlan({stage:'impact',moveId:'waterfall',targetIds:['B-0']},publicV3Catalog),hooks=runtime.hookCues(plan);
 assert.deepEqual(hooks.map(cue=>cue.type),['commit','audio']);for(const cue of hooks)runtime.dispatch(cue,{moveId:'waterfall'});assert.deepEqual(seen,['commit','audio']);assert.deepEqual(audio,['move:water:impact']);
});

test('R3-94 playback runner schedules timeline hooks at speed-scaled cue boundaries',async()=>{
 const waits=[],seen=[],runner=new V3PlaybackRunner({waitImpl:async ms=>waits.push(ms)});runner.configure({speed:2});const ok=await runner.playTimeline(420,[{id:'commit',type:'commit',at:0},{id:'sound',type:'audio',at:40}],cue=>seen.push(cue.id));assert.equal(ok,true);assert.deepEqual(seen,['commit','sound']);assert.deepEqual(waits,[0,20,190]);
});

test('R3-94 battle screen attaches presentation plans to playback without changing authoritative snapshots',async()=>{
 const frames=[],cues=[],screen=new V3BattleScreen({onChange(){if(screen.playback)frames.push(screen.playback);},sendAction(){},wait:async()=>{},onPresentationCue:cue=>cues.push(cue.type)}),view={turnSnapshots:{initial:{turn:1,format:'single',field:{},sideConditions:{own:{},opponent:{}},own:[{actorId:'A-0',name:'User',hp:100,maxHp:100,activeSlot:0}],opponent:[{actorId:'B-0',name:'Target',hpPercent:100,activeSlot:0}]}},events:[{id:'1',kind:'turnStarted',turn:1},{id:'2',kind:'moveStarted',actorId:'A-0',moveId:'waterfall'},{id:'3',kind:'damage',targetId:'B-0',hpAfterPercent:50}],history:[]};
 await screen.playTurn(view,{catalog:publicV3Catalog});const cast=frames.find(frame=>frame.stage==='cast'),impact=frames.find(frame=>frame.stage==='impact');assert.ok(cast.presentation);assert.equal(cast.presentation.stage,'cast');assert.equal(cast.snapshot.opponent[0].hpPercent,100);assert.equal(impact.snapshot.opponent[0].hpPercent,50);assert.ok(cues.includes('commit'));assert.ok(cues.includes('audio'));
});
