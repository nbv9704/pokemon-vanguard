import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyHazard,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveEntryHazards} from '../mechanics-v3/index.mjs';
import {applyReplacements,applySwitch,completeEntry,resolveActionQueue,resumeActionQueue} from '../rules-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['spikes','stealth-rock','toxic-spikes'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{spikes:20,'stealth-rock':20,'toxic-spikes':20},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3'),unit('a4')],b=[unit('b1'),unit('b2'),unit('b3'),unit('b4')];
 return {id:`hazards-${format}`,rulesVersion:'r3',catalogVersion:'fixture',format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:19,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});

function setHazard(battle,actorId,hazard){return applyHazard(battle,{actorId,moveId:hazard,hazard}).battle;}

test('r3-hazards:single Spikes stacks to three layers and Stealth Rock is single-layer',()=>{
 const base=fixture(),before=structuredClone(base);
 let result=resolveMove(base,{kind:'move',side:'A',actorId:'a1',moveId:'spikes'},{});assert.deepEqual(base,before);assert.equal(result.battle.sides.B.conditions.spikes.layers,1);assert.equal(result.events.at(-1).side,'B');
 result=resolveMove(result.battle,{kind:'move',side:'A',actorId:'a1',moveId:'spikes'},{});assert.equal(result.battle.sides.B.conditions.spikes.layers,2);
 result=resolveMove(result.battle,{kind:'move',side:'A',actorId:'a1',moveId:'spikes'},{});assert.equal(result.battle.sides.B.conditions.spikes.layers,3);
 result=resolveMove(result.battle,{kind:'move',side:'A',actorId:'a1',moveId:'spikes'},{});assert.equal(result.events.at(-1).reason,'hazardMaxLayers');assert.equal(result.battle.sides.B.conditions.spikes.layers,3);
 let rock=resolveMove(fixture(),{kind:'move',side:'A',actorId:'a1',moveId:'stealth-rock'},{});assert.equal(rock.battle.sides.B.conditions['stealth-rock'].layers,1);
 rock=resolveMove(rock.battle,{kind:'move',side:'A',actorId:'a1',moveId:'stealth-rock'},{});assert.equal(rock.events.at(-1).reason,'hazardMaxLayers');assert.equal(rock.battle.sides.B.conditions['stealth-rock'].layers,1);
});



test('Toxic Spikes stacks to two layers, poisons grounded entrants, and is absorbed by grounded Poison types',()=>{
 let battle=fixture();
 let result=resolveMove(battle,{kind:'move',side:'B',actorId:'b1',moveId:'toxic-spikes'},{});assert.equal(result.battle.sides.A.conditions['toxic-spikes'].layers,1);
 result=resolveMove(result.battle,{kind:'move',side:'B',actorId:'b1',moveId:'toxic-spikes'},{});assert.equal(result.battle.sides.A.conditions['toxic-spikes'].layers,2);
 result=resolveMove(result.battle,{kind:'move',side:'B',actorId:'b1',moveId:'toxic-spikes'},{});assert.equal(result.events.at(-1).reason,'hazardMaxLayers');assert.equal(result.battle.sides.A.conditions['toxic-spikes'].layers,2);

 let oneLayer=setHazard(fixture(),'b1','toxic-spikes');
 let entered=resolveEntryHazards(oneLayer,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(entered.battle.sides.A.roster[1].status.id,'poison');assert.ok(entered.events.some(event=>event.kind==='hazardTriggered'&&event.status==='poison'));
 let twoLayers=setHazard(oneLayer,'b1','toxic-spikes');
 entered=resolveEntryHazards(twoLayers,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(entered.battle.sides.A.roster[1].status.id,'bad-poison');assert.ok(entered.events.some(event=>event.kind==='hazardTriggered'&&event.status==='bad-poison'));

 const poison=fixture();poison.sides.A.roster[1].types=['bug','poison'];let poisoned=setHazard(poison,'b1','toxic-spikes');poisoned=setHazard(poisoned,'b1','toxic-spikes');entered=resolveEntryHazards(poisoned,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(entered.battle.sides.A.conditions['toxic-spikes'],undefined);assert.equal(entered.battle.sides.A.roster[1].status,null);assert.ok(entered.events.some(event=>event.kind==='hazardRemoved'&&event.reason==='poison-type-absorption'));
});

test('Toxic Spikes respects grounding, Steel immunity, Misty Terrain, and stable creation order',()=>{
 const flying=fixture();flying.sides.A.roster[1].types=['poison','flying'];let battle=setHazard(flying,'b1','toxic-spikes');let result=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.ok(result.battle.sides.A.conditions['toxic-spikes']);assert.equal(result.battle.sides.A.roster[1].status,null);assert.equal(result.events.some(event=>event.kind==='hazardRemoved'),false);
 const steel=fixture();steel.sides.A.roster[1].types=['steel'];battle=setHazard(steel,'b1','toxic-spikes');result=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(result.battle.sides.A.roster[1].status,null);assert.ok(result.events.some(event=>event.kind==='statusFailed'&&event.reason==='typeImmune'));
 const misty=fixture();misty.field.terrain={id:'misty',remaining:5};battle=setHazard(misty,'b1','toxic-spikes');result=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(result.battle.sides.A.roster[1].status,null);assert.ok(result.events.some(event=>event.kind==='statusFailed'&&event.reason==='terrainBlocked'));
 let ordered=fixture();ordered=setHazard(ordered,'b1','toxic-spikes');ordered=setHazard(ordered,'b1','stealth-rock');ordered.sides.A.roster[1].hp=10;result=resolveEntryHazards(ordered,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.deepEqual(result.events.filter(event=>event.kind==='hazardTriggered').map(event=>event.hazard),['toxic-spikes','stealth-rock']);assert.equal(result.battle.sides.A.roster[1].status.id,'poison');assert.equal(result.battle.sides.A.roster[1].hp,0);
});

test('entry hazards use layer math, Rock effectiveness, and grounded checks',()=>{
 let battle=fixture();battle=setHazard(battle,'b1','stealth-rock');battle=setHazard(battle,'b1','spikes');
 const grounded=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(grounded.battle.sides.A.roster[1].hp,120);assert.deepEqual(grounded.events.filter(event=>event.kind==='hazardTriggered').map(event=>[event.hazard,event.amount]),[['stealth-rock',20],['spikes',20]]);
 const flying=fixture();flying.sides.A.roster[1].types=['fire','flying'];let withRock=setHazard(flying,'b1','stealth-rock');withRock=setHazard(withRock,'b1','spikes');const hit=resolveEntryHazards(withRock,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.equal(hit.battle.sides.A.roster[1].hp,80);assert.deepEqual(hit.events.filter(event=>event.kind==='hazardTriggered').map(event=>event.hazard),['stealth-rock']);assert.equal(hit.events.find(event=>event.kind==='hazardTriggered').effectiveness,4);
});

test('entry hazards resolve in stable creation order and stop after the entrant faints',()=>{
 let spikesFirst=fixture();spikesFirst=setHazard(spikesFirst,'b1','spikes');spikesFirst=setHazard(spikesFirst,'b1','stealth-rock');spikesFirst.sides.A.roster[1].hp=20;
 let result=resolveEntryHazards(spikesFirst,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.deepEqual(result.events.filter(event=>event.kind==='hazardTriggered').map(event=>event.hazard),['spikes']);
 let rockFirst=fixture();rockFirst=setHazard(rockFirst,'b1','stealth-rock');rockFirst=setHazard(rockFirst,'b1','spikes');rockFirst.sides.A.roster[1].hp=20;
 result=resolveEntryHazards(rockFirst,[{kind:'switchIn',actorId:'a2',side:'A',slot:0}]);assert.deepEqual(result.events.filter(event=>event.kind==='hazardTriggered').map(event=>event.hazard),['stealth-rock']);
});

test('r3-hazards:double affects only the switching slot with damage and Toxic Spikes status',()=>{
 let battle=fixture('double');battle=setHazard(battle,'b1','spikes');battle=setHazard(battle,'b1','toxic-spikes');battle=applySwitch(battle,'A','a1','a3').battle;
 const result=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'a3',side:'A',slot:0}]);assert.equal(result.battle.sides.A.roster[2].hp,140);assert.equal(result.battle.sides.A.roster[2].status.id,'poison');assert.equal(result.battle.sides.A.roster[1].hp,160);assert.equal(result.battle.sides.A.roster[1].status,null);assert.equal(result.events.filter(event=>event.kind==='damage').length,1);
});

test('real hazard entry KO suspends a turn and a healthy replacement resumes the pending queue',()=>{
 let battle=fixture();battle=setHazard(battle,'b1','stealth-rock');battle.sides.A.roster[1].hp=10;const seen=[];
 const actions=[{kind:'switch',side:'A',actorId:'a1',toId:'a2',priority:6,speed:100},{kind:'move',side:'B',actorId:'b1',moveId:'late-hit',priority:0,speed:90,target:{side:'A',slot:0}}];
 const handlers={switch:(state,action)=>applySwitch(state,action.side,action.actorId,action.toId),entry:(state,events)=>resolveEntryHazards(state,events),move:(state,action)=>{seen.push(action.actorId);return {battle:state,events:[{kind:'pendingMoveResolved',actorId:action.actorId}]};}};
 const first=resolveActionQueue(battle,actions,handlers);assert.equal(first.ok,true);assert.equal(first.suspended,true);assert.equal(first.battle.phase,'REPLACE');assert.equal(first.battle.sides.A.roster[1].hp,0);assert.equal(seen.length,0);
 const replaced=applyReplacements(first.battle,{A:[{slot:0,actorId:'a3'}],B:[]});const hazards=resolveEntryHazards(replaced.battle,replaced.events),entered=completeEntry(hazards.battle,hazards.events);assert.equal(entered.battle.phase,'RESOLVE');
 const resumed=resumeActionQueue(entered.battle,handlers);assert.equal(resumed.ok,true);assert.equal(resumed.battle.phase,'END_TURN');assert.deepEqual(seen,['b1']);
});



test('Toxic Spikes persists through a hazard-KO replacement chain and applies again to the healthy replacement',()=>{
 let battle=fixture();battle.phase='REPLACE';battle.pendingResolution={switchPending:[],megaPending:[],movePending:[],executionOrder:[],rngState:19,trickRoom:false};battle.sides.A.roster[0].hp=0;battle=setHazard(battle,'b1','toxic-spikes');battle=setHazard(battle,'b1','toxic-spikes');battle=setHazard(battle,'b1','stealth-rock');battle.sides.A.roster[1].hp=10;
 const first=applyReplacements(battle,{A:[{slot:0,actorId:'a2'}],B:[]}),firstHazards=resolveEntryHazards(first.battle,first.events),firstEntry=completeEntry(firstHazards.battle,firstHazards.events);assert.equal(firstEntry.battle.phase,'REPLACE');assert.equal(firstEntry.battle.sides.A.roster[1].hp,0);assert.equal(firstEntry.battle.sides.A.roster[1].status.id,'bad-poison');assert.ok(firstEntry.battle.sides.A.conditions['toxic-spikes']);
 const second=applyReplacements(firstEntry.battle,{A:[{slot:0,actorId:'a3'}],B:[]}),secondHazards=resolveEntryHazards(second.battle,second.events),secondEntry=completeEntry(secondHazards.battle,secondHazards.events);assert.equal(secondEntry.battle.phase,'RESOLVE');assert.equal(secondEntry.battle.sides.A.roster[2].status.id,'bad-poison');assert.equal(secondEntry.battle.sides.A.roster[2].hp,140);
});

test('replacement entry can be KOed by hazards and request another replacement without advancing the turn',()=>{
 let battle=fixture();battle.phase='REPLACE';battle.pendingResolution={switchPending:[],megaPending:[],movePending:[],executionOrder:[],rngState:19,trickRoom:false};battle.sides.A.roster[0].hp=0;battle=setHazard(battle,'b1','stealth-rock');battle.sides.A.roster[1].hp=10;battle.sides.A.roster[2].hp=160;
 const first=applyReplacements(battle,{A:[{slot:0,actorId:'a2'}],B:[]});assert.equal(first.ok,true);const firstHazards=resolveEntryHazards(first.battle,first.events),firstEntry=completeEntry(firstHazards.battle,firstHazards.events);assert.equal(firstEntry.battle.phase,'REPLACE');assert.equal(firstEntry.battle.turn,1);assert.equal(firstEntry.events.some(event=>event.kind==='entryReplacementRequired'),true);
 const second=applyReplacements(firstEntry.battle,{A:[{slot:0,actorId:'a3'}],B:[]});const secondHazards=resolveEntryHazards(second.battle,second.events),secondEntry=completeEntry(secondHazards.battle,secondHazards.events);assert.equal(secondEntry.battle.phase,'RESOLVE');assert.equal(secondEntry.battle.turn,1);assert.equal(secondEntry.battle.sides.A.roster[2].hp,140);
});
