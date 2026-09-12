import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,effectiveAccuracy,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const allManifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const expected={
 'baby-doll-eyes':{accuracy:100,targetMode:'adjacentFoe',boosts:{atk:-1},priority:1},
 charm:{accuracy:100,targetMode:'adjacentFoe',boosts:{atk:-2},priority:0},
 coil:{accuracy:null,targetMode:'self',boosts:{atk:1,def:1,accuracy:1},priority:0},
 confide:{accuracy:null,targetMode:'adjacentFoe',boosts:{spa:-1},priority:0},
 'double-team':{accuracy:null,targetMode:'self',boosts:{evasion:1},priority:0},
 'fake-tears':{accuracy:100,targetMode:'adjacentFoe',boosts:{spd:-2},priority:0},
 'feather-dance':{accuracy:100,targetMode:'adjacentFoe',boosts:{atk:-2},priority:0},
 'noble-roar':{accuracy:100,targetMode:'adjacentFoe',boosts:{atk:-1,spa:-1},priority:0},
 'scary-face':{accuracy:100,targetMode:'adjacentFoe',boosts:{spe:-2},priority:0},
 screech:{accuracy:85,targetMode:'adjacentFoe',boosts:{def:-2},priority:0},
 'string-shot':{accuracy:95,targetMode:'allAdjacentFoes',boosts:{spe:-2},priority:0},
 'sweet-scent':{accuracy:100,targetMode:'allAdjacentFoes',boosts:{evasion:-2},priority:0}
};
const moves=Object.fromEntries(Object.entries(expected).map(([id,spec])=>[id,{id,type:'normal',category:'status',power:null,accuracy:spec.accuracy}]));
const pp=()=>Object.fromEntries(Object.keys(expected).map(id=>[id,20]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:100,def:100,spa:100,spd:100,spe:100},pp:pp(),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`accuracy-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}
const manifests=Object.fromEntries(Object.keys(expected).map(id=>[id,allManifests[id]]));
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});

test('accuracy stages use the reviewed three-based multipliers and clamp the combined stage',()=>{
 assert.equal(effectiveAccuracy(null,6,-6),null);assert.equal(effectiveAccuracy(85,0,0),85);
 assert.equal(effectiveAccuracy(85,1,0),100);assert.equal(effectiveAccuracy(85,0,1),63);
 assert.equal(effectiveAccuracy(85,-6,6),28);assert.equal(effectiveAccuracy(50,6,-6),100);
 assert.throws(()=>effectiveAccuracy(0),/move accuracy/);assert.throws(()=>effectiveAccuracy(100.5),/move accuracy/);
});

test('r3-accuracy-stages:self-single and self-double apply accuracy/evasion boosts only to the user',()=>{
 for(const format of ['single','double'])for(const moveId of ['coil','double-team']){
  const result=resolveMove(fixture(format),{kind:'move',side:'A',actorId:'a1',moveId,target:{side:'A',slot:0}},{});
  for(const [stat,delta] of Object.entries(expected[moveId].boosts))assert.equal(result.battle.sides.A.roster[0].stages[stat],delta,`${format}:${moveId}:${stat}`);
  assert.deepEqual(result.battle.sides.A.roster[1].stages,stages(),`${format}:${moveId}:reserve-or-ally`);
 }
});

test('r3-accuracy-stages:target-single applies every reviewed target debuff',()=>{
 const moveIds=Object.keys(expected).filter(id=>expected[id].targetMode==='adjacentFoe');
 for(const moveId of moveIds){
  const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId,target:{side:'B',slot:0}},{nextRandom:()=>0});
  assert.equal(JSON.stringify(battle),before,moveId);assert.equal(result.battle.sides.A.roster[0].pp[moveId],19,moveId);
  for(const [stat,delta] of Object.entries(expected[moveId].boosts))assert.equal(result.battle.sides.B.roster[0].stages[stat],delta,`${moveId}:${stat}`);
  assert.equal(allManifests[moveId].priority,expected[moveId].priority,`${moveId}:priority`);
 }
});

test('r3-accuracy-stages:target-double follows redirection and respects a seeded miss',()=>{
 const redirected=fixture('double');redirected.sides.B.roster[1].volatiles.redirection={active:true,order:1};
 const charm=resolveMove(redirected,{kind:'move',side:'A',actorId:'a1',moveId:'charm',target:{side:'B',slot:0}},{nextRandom:()=>0});
 assert.equal(charm.battle.sides.B.roster[0].stages.atk,0);assert.equal(charm.battle.sides.B.roster[1].stages.atk,-2);
 const missed=resolveMove(fixture('double'),{kind:'move',side:'A',actorId:'a1',moveId:'screech',target:{side:'B',slot:0}},{nextRandom:()=>.99});
 assert.deepEqual(missed.events.map(event=>event.kind),['moveStarted','ppSpent','moveMissed']);assert.equal(missed.events[2].effectiveAccuracy,85);assert.equal(missed.battle.sides.B.roster[0].stages.def,0);
});

test('r3-accuracy-stages:spread-single applies one target and spread-double rolls each foe independently',()=>{
 for(const moveId of ['string-shot','sweet-scent']){
  const single=resolveMove(fixture(),{kind:'move',side:'A',actorId:'a1',moveId},{nextRandom:()=>0});
  for(const [stat,delta] of Object.entries(expected[moveId].boosts))assert.equal(single.battle.sides.B.roster[0].stages[stat],delta,`${moveId}:single`);
 }
 const battle=fixture('double');battle.sides.B.roster[1].stages.evasion=6;const rolls=[.1,.9];
 const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'string-shot'},{nextRandom:()=>rolls.shift()});
 assert.equal(result.battle.sides.B.roster[0].stages.spe,-2);assert.equal(result.battle.sides.B.roster[1].stages.spe,0);
 assert.equal(result.events.find(event=>event.kind==='moveMissed').targetId,'b2');assert.equal(result.events.find(event=>event.kind==='moveMissed').effectiveAccuracy,31);
});

test('accuracy-stage command output is deterministic for the same seeded roll stream',()=>{
 const action={kind:'move',side:'A',actorId:'a1',moveId:'screech',target:{side:'B',slot:0}},run=()=>{const rolls=[.2];return resolveMove(fixture('double'),action,{nextRandom:()=>rolls.shift()});};
 assert.equal(JSON.stringify(run()),JSON.stringify(run()));
});
