import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const moves={
 'aerial-ace':{id:'aerial-ace',type:'flying',category:'physical',power:60,accuracy:null},
 tackle:{id:'tackle',type:'normal',category:'physical',power:40,accuracy:100}
};
const unit=(actorId,types=['normal'])=>({actorId,types,hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:100,spd:100,spe:100},pp:{'aerial-ace':20,tackle:20},status:null,volatiles:{},stages:{atk:0,def:0,spa:0,spd:0,spe:0}});
function fixture(format='single'){
 const count=format==='single'?1:2,a=[unit('a1',['flying']),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`damage-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:1,eventSequence:0,events:[],result:null,activeCount:count,sides:{A:{active:a.slice(0,count).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,count).map(entry=>entry.actorId),roster:b}}};
}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>.999};

test('r3-direct-damage:aerial-ace-single always-hit damage is deterministic and immutable',()=>{
 const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'aerial-ace',target:{side:'B',slot:0}},runtime);
 assert.equal(JSON.stringify(battle),before);assert.deepEqual(result.events.map(event=>event.kind),['moveStarted','ppSpent','damage']);
 assert.equal(result.events[2].breakdown.randomRoll,100);assert.equal(result.battle.sides.B.roster[0].hp,151);assert.equal(result.battle.sides.A.roster[0].pp['aerial-ace'],19);
});

test('r3-direct-damage:aerial-ace-double-ally can target an adjacent ally',()=>{
 const battle=fixture('double'),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'aerial-ace',target:{side:'A',slot:1}},runtime);
 assert.equal(result.battle.sides.A.roster[1].hp,151);assert.equal(result.battle.sides.B.roster[0].hp,200);
});

test('r3-direct-damage:tackle-single-immunity emits zero damage against Ghost',()=>{
 const battle=fixture();battle.sides.B.roster[0].types=['ghost'];
 const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},runtime);
 assert.equal(result.events[2].amount,0);assert.equal(result.events[2].effectiveness,0);assert.equal(result.events[2].breakdown.randomApplied,false);assert.equal(result.battle.sides.B.roster[0].hp,200);
});

test('r3-direct-damage:tackle-double-redirection follows active redirection',()=>{
 const battle=fixture('double');battle.sides.B.roster[1].volatiles.redirection={active:true,order:2};
 const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},runtime);
 assert.equal(result.battle.sides.B.roster[0].hp,200);assert.equal(result.events[2].targetId,'b2');assert.ok(result.battle.sides.B.roster[1].hp<200);
});

test('move action stops after PP validation fails',()=>{
 const battle=fixture();battle.sides.A.roster[0].pp.tackle=0;
 const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},runtime);
 assert.deepEqual(result.events.map(event=>event.kind),['moveStarted','moveFailed']);assert.equal(result.events[1].reason,'noPP');assert.equal(result.battle.sides.B.roster[0].hp,200);
});

test('accuracy and evasion stages affect direct damage while always-hit moves bypass them',()=>{
 const tackleBattle=fixture();tackleBattle.sides.A.roster[0].stages.accuracy=-1;tackleBattle.sides.B.roster[0].stages.evasion=1;
 const missed=resolveMove(tackleBattle,{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},{nextRandom:()=>.99});
 assert.deepEqual(missed.events.map(event=>event.kind),['moveStarted','ppSpent','moveMissed']);assert.equal(missed.events[2].effectiveAccuracy,60);assert.equal(missed.battle.sides.B.roster[0].hp,200);
 const aerialBattle=fixture();aerialBattle.sides.A.roster[0].stages.accuracy=-6;aerialBattle.sides.B.roster[0].stages.evasion=6;
 const hit=resolveMove(aerialBattle,{kind:'move',side:'A',actorId:'a1',moveId:'aerial-ace',target:{side:'B',slot:0}},{nextRandom:()=>.999});
 assert.equal(hit.events.at(-1).kind,'damage');assert.ok(hit.battle.sides.B.roster[0].hp<200);
});

test('direct damage applies Attack and Defense stages while critical hits bypass adverse stages',()=>{
 const boosted=fixture();boosted.sides.A.roster[0].stages.atk=2;const raised=resolveMove(boosted,{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},runtime);
 const neutral=resolveMove(fixture(),{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},runtime);assert.ok(raised.events.at(-1).amount>neutral.events.at(-1).amount);
 const criticalBattle=fixture();criticalBattle.sides.A.roster[0].stages.atk=-6;criticalBattle.sides.B.roster[0].stages.def=6;const rolls=[0,.999],critical=resolveMove(criticalBattle,{kind:'move',side:'A',actorId:'a1',moveId:'tackle',target:{side:'B',slot:0}},{nextRandom:()=>rolls.shift()});assert.equal(critical.events.at(-1).breakdown.critical,1.5);assert.equal(critical.events.at(-1).breakdown.base,23);
});
