import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['rapid-spin','defog'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{'rapid-spin':20,defog:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3'),unit('a4')],b=[unit('b1'),unit('b2'),unit('b3'),unit('b4')];
 return {id:`cleanup-${format}`,rulesVersion:'r3',catalogVersion:'fixture',format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:19,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const runtime={nextRandom:()=>.99};

function hazard(id,layers=1,order=1){return {id,layers,order,sourceActorId:'b1',sourceMoveId:id};}

test('r3-hazard-cleanup:single Rapid Spin clears own hazards and Leech Seed only after a damaging hit, then raises Speed',()=>{
 const battle=fixture(),before=structuredClone(battle);battle.sides.A.conditions.spikes=hazard('spikes',3);battle.sides.A.conditions['toxic-spikes']=hazard('toxic-spikes',2,2);battle.sides.A.conditions['stealth-rock']=hazard('stealth-rock',1,3);battle.sides.A.roster[0].volatiles['leech-seed']={id:'leech-seed',sourceId:'leech-seed',sourceSide:'B',sourceSlot:0};
 const input=structuredClone(battle),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'rapid-spin',target:{side:'B',slot:0}},runtime);
 assert.deepEqual(battle,input);assert.equal(before.sides.A.conditions.spikes,undefined);
 assert.equal(result.battle.sides.A.conditions.spikes,undefined);assert.equal(result.battle.sides.A.conditions['toxic-spikes'],undefined);assert.equal(result.battle.sides.A.conditions['stealth-rock'],undefined);assert.equal(result.battle.sides.A.roster[0].volatiles['leech-seed'],undefined);assert.equal(result.battle.sides.A.roster[0].stages.spe,1);
 assert.deepEqual(result.events.filter(event=>event.kind==='hazardRemoved').map(event=>event.hazard),['spikes','toxic-spikes','stealth-rock']);assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.reason==='rapid-spin'));assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.stat==='spe'&&event.appliedDelta===1));
});

test('Rapid Spin does not clean hazards or boost Speed when Protect blocks it or Normal damage is immune',()=>{
 let battle=fixture();battle.sides.A.conditions.spikes=hazard('spikes');battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true,endTurnTimer:1};
 let result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'rapid-spin',target:{side:'B',slot:0}},runtime);assert.ok(result.battle.sides.A.conditions.spikes);assert.equal(result.battle.sides.A.roster[0].stages.spe,0);assert.equal(result.events.some(event=>event.kind==='hazardRemoved'),false);assert.ok(result.events.some(event=>event.kind==='moveBlocked'));
 battle=fixture();battle.sides.A.conditions.spikes=hazard('spikes');battle.sides.B.roster[0].types=['ghost'];result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'rapid-spin',target:{side:'B',slot:0}},runtime);assert.ok(result.battle.sides.A.conditions.spikes);assert.equal(result.battle.sides.A.roster[0].stages.spe,0);assert.equal(result.events.find(event=>event.kind==='damage').effectiveness,0);
});

test('r3-hazard-cleanup:double Defog lowers target Evasion, clears target screens, both-side hazards and terrain while preserving Tailwind',()=>{
 const battle=fixture('double');battle.field.terrain={id:'grassy',remaining:4,sourceActorId:'a1',sourceMoveId:'grassy-terrain'};battle.sides.A.conditions['stealth-rock']=hazard('stealth-rock');battle.sides.A.conditions['toxic-spikes']=hazard('toxic-spikes',2,2);battle.sides.B.conditions.spikes=hazard('spikes',2);battle.sides.B.conditions.reflect={id:'reflect',remaining:4};battle.sides.B.conditions['light-screen']={id:'light-screen',remaining:4};battle.sides.B.conditions.tailwind={id:'tailwind',remaining:3};
 const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'defog',target:{side:'B',slot:1}},{});
 assert.equal(result.battle.sides.B.roster[1].stages.evasion,-1);assert.equal(result.battle.sides.A.conditions['stealth-rock'],undefined);assert.equal(result.battle.sides.A.conditions['toxic-spikes'],undefined);assert.equal(result.battle.sides.B.conditions.spikes,undefined);assert.equal(result.battle.sides.B.conditions.reflect,undefined);assert.equal(result.battle.sides.B.conditions['light-screen'],undefined);assert.ok(result.battle.sides.B.conditions.tailwind);assert.equal(result.battle.field.terrain,undefined);
 assert.deepEqual(result.events.filter(event=>event.kind==='sideConditionEnded').map(event=>event.condition),['reflect','light-screen']);
 const removed=result.events.filter(event=>event.kind==='hazardRemoved').map(event=>`${event.side}:${event.hazard}`).sort();assert.deepEqual(removed,['A:stealth-rock','A:toxic-spikes','B:spikes']);assert.ok(result.events.some(event=>event.kind==='terrainEnded'&&event.reason==='defog'));
});

test('Defog still cleans the field at the Evasion floor, but Protect blocks the entire effect',()=>{
 let battle=fixture();battle.sides.B.roster[0].stages.evasion=-6;battle.sides.B.conditions.reflect={id:'reflect',remaining:5};battle.sides.A.conditions.spikes=hazard('spikes');battle.field.terrain={id:'misty',remaining:3};
 let result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'defog',target:{side:'B',slot:0}},{});assert.equal(result.battle.sides.B.roster[0].stages.evasion,-6);assert.equal(result.battle.sides.B.conditions.reflect,undefined);assert.equal(result.battle.sides.A.conditions.spikes,undefined);assert.equal(result.battle.field.terrain,undefined);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.reason==='stageLimit'));
 battle=fixture();battle.sides.B.conditions.reflect={id:'reflect',remaining:5};battle.sides.A.conditions.spikes=hazard('spikes');battle.field.terrain={id:'grassy',remaining:3};battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true,endTurnTimer:1};
 result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'defog',target:{side:'B',slot:0}},{});assert.ok(result.battle.sides.B.conditions.reflect);assert.ok(result.battle.sides.A.conditions.spikes);assert.equal(result.battle.field.terrain.id,'grassy');assert.equal(result.battle.sides.B.roster[0].stages.evasion,0);assert.ok(result.events.some(event=>event.kind==='moveBlocked'));
});
