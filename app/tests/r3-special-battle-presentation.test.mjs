import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyBattleEvent,createTurnFrames} from '../public/js/v3-battle-timeline.js';
import {BattlePresentationRuntime} from '../public/js/presentation/battle-presentation-runtime.js';
import {actorPresentationClass} from '../public/js/presentation/presentation-renderer.js';
import {v3BattleSnapshot,v3BattleView} from '../server/v3-battle-view.mjs';

const snapshot=()=>({turn:1,format:'single',field:{},sideConditions:{own:{},opponent:{}},own:[{actorId:'A-0',speciesId:'ditto',name:'Ditto',spriteKey:'ditto',types:['normal'],hp:100,maxHp:100,activeSlot:0}],opponent:[{actorId:'B-0',speciesId:'morpeko',name:'Morpeko',spriteKey:'morpeko',types:['electric','dark'],hpPercent:100,activeSlot:0}]});
const catalog={moves:[{id:'transform',name:'Transform',type:'normal',category:'status',actionProfile:{targetMode:'adjacentFoe'}}],species:[],megaForms:[]};

test('R3-96 playback projection applies Transform to the actor while preserving the target identity',()=>{
 const before=snapshot(),after=applyBattleEvent(before,{kind:'transformed',actorId:'A-0',targetId:'B-0',speciesId:'morpeko',name:'Morpeko',spriteKey:'morpeko',types:['electric','dark']},catalog);
 assert.equal(after.own[0].speciesId,'morpeko');assert.equal(after.own[0].spriteKey,'morpeko');assert.deepEqual(after.own[0].types,['electric','dark']);assert.equal(after.opponent[0].speciesId,'morpeko');
});

test('R3-96 Stance Change form event is reflected before the move cast frame',()=>{
 const initial=snapshot();initial.own[0]={...initial.own[0],speciesId:'aegislash-shield',name:'Aegislash (Shield)',spriteKey:'aegislash-shield',types:['steel','ghost']};
 const events=[{kind:'turnStarted',turn:1},{kind:'moveStarted',actorId:'A-0',moveId:'shadow-claw'},{kind:'abilityFormChanged',actorId:'A-0',abilityId:'stance-change',fromSpeciesId:'aegislash-shield',toSpeciesId:'aegislash-blade',name:'Aegislash (Blade)',spriteKey:'aegislash-blade',types:['steel','ghost'],trigger:'before-move'},{kind:'damage',targetId:'B-0',hpAfterPercent:50}];
 const frames=createTurnFrames(initial,events,{catalog:{moves:[],species:[],megaForms:[]}}),cast=frames.find(frame=>frame.stage==='cast'),impact=frames.find(frame=>frame.stage==='impact');
 assert.equal(cast.snapshot.own[0].speciesId,'aegislash-blade');assert.ok(cast.events.some(event=>event.kind==='abilityFormChanged'));assert.equal(impact.snapshot.opponent[0].hpPercent,50);
});

test('R3-96 special presentation maps Mega, Transform, Illusion, Disguise and form transitions to actor cues',()=>{
 const runtime=new BattlePresentationRuntime();
 const cases=[
  [{stage:'mega',duration:1000,events:[{kind:'megaEvolved',actorId:'A-0'}]},'actor-mega'],
  [{stage:'switch',duration:500,events:[{kind:'switchIn',actorId:'A-0'}],snapshot:snapshot()},'actor-emerge'],
  [{stage:'impact',duration:420,events:[{kind:'fainted',actorId:'B-0',targetId:'B-0'}]},'actor-faint'],
  [{stage:'impact',duration:420,moveId:'transform',targetIds:['B-0'],events:[{kind:'transformed',actorId:'A-0',targetId:'B-0'}]},'actor-morph'],
  [{stage:'impact',duration:420,events:[{kind:'illusionBroken',actorId:'B-0'}]},'actor-shatter'],
  [{stage:'impact',duration:420,events:[{kind:'disguiseBroken',actorId:'B-0'}]},'actor-break'],
  [{stage:'endTurn',duration:500,events:[{kind:'abilityFormChanged',actorId:'A-0',abilityId:'hunger-switch',trigger:'end-turn'}]},'actor-morph']
 ];
 for(const [frame,primitive] of cases){const plan=runtime.plan(frame,catalog);assert.ok(plan,primitive);assert.ok(plan.cues.some(cue=>cue.primitive===primitive),primitive);}
 const illusionFrame=cases.find(([frame])=>frame.events?.some(event=>event.kind==='illusionBroken'))[0],plan=runtime.plan(illusionFrame,catalog);assert.match(actorPresentationClass(plan,{actorId:'B-0'}),/presentation-actor-shatter/);
});

test('R3-96 semi-invulnerable events persist a visual state until release or interruption',()=>{
 let state=applyBattleEvent(snapshot(),{kind:'twoTurnMovePrepared',actorId:'A-0',moveId:'dig',semiInvulnerable:'underground'});assert.deepEqual(state.own[0].battlePresentation,{semiInvulnerable:'underground',moveId:'dig'});
 const runtime=new BattlePresentationRuntime(),enter=runtime.plan({stage:'impact',duration:420,events:[{kind:'twoTurnMovePrepared',actorId:'A-0',moveId:'dig',semiInvulnerable:'underground'}]},catalog);assert.ok(enter.cues.some(cue=>cue.primitive==='actor-vanish'));
 state=applyBattleEvent(state,{kind:'twoTurnMoveReleased',actorId:'A-0',moveId:'dig',semiInvulnerable:'underground'});assert.equal(state.own[0].battlePresentation,undefined);
 const exit=runtime.plan({stage:'impact',duration:420,events:[{kind:'twoTurnMoveAborted',actorId:'A-0',moveId:'fly',semiInvulnerable:'airborne'}]},catalog);assert.ok(exit.cues.some(cue=>cue.primitive==='actor-emerge'));
});

test('R3-96 public projection exposes only battle-visible semi-invulnerability and reveals real opponent identity when Illusion breaks',()=>{
 const unit=(actorId,speciesId)=>({actorId,baseSpeciesId:speciesId,speciesId,name:speciesId==='zoroark'?'Zoroark':'Ditto',spriteKey:speciesId,types:speciesId==='zoroark'?['dark']:['normal'],hp:100,maxHp:100,status:null,volatiles:{},itemState:null,buildSnapshot:{moveIds:[],abilityId:null,itemId:null}}),a=unit('A-0','ditto'),b=unit('B-0','zoroark');
 b.volatiles['two-turn-move']={moveId:'fly',semiInvulnerable:'airborne'};
 const battle={id:'r3-96',format:'single',phase:'COMMAND',phaseRevision:1,turn:1,result:null,megaLimit:1,megaUsed:{A:0,B:0},field:{},sides:{A:{active:['A-0'],roster:[a],conditions:{}},B:{active:['B-0'],roster:[b],conditions:{}}},events:[]};
 const snap=v3BattleSnapshot(battle);assert.deepEqual(snap.opponent[0].battlePresentation,{semiInvulnerable:'airborne',moveId:'fly'});assert.equal(snap.opponent[0].volatiles,undefined);
 const view=v3BattleView({battleV3:{id:'r3-96',phase:'COMMAND',mode:'single',difficulty:'normal',battle,lastEvents:[{kind:'illusionBroken',actorId:'B-0',abilityId:'illusion'}],opponentRoster:[]}});const event=view.events[0];assert.equal(event.revealedSpeciesId,'zoroark');assert.equal(event.revealedSpriteKey,'zoroark');assert.deepEqual(event.revealedTypes,['dark']);
});

test('R3-96 CSS contains dedicated special actor and semi-invulnerable presentation states',async()=>{
 const css=await readFile(new URL('../public/v3-battle-arena.css',import.meta.url),'utf8');for(const name of ['actor-morph','actor-shatter','actor-break','actor-vanish','actor-emerge','actor-faint','actor-mega'])assert.match(css,new RegExp(`presentation-${name}`),name);for(const mode of ['underground','underwater','airborne','vanished'])assert.match(css,new RegExp(`semi-${mode}`),mode);
});
