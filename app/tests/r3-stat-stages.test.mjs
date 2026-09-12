import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const allManifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const expected={
 'acid-armor':{targetMode:'self',boosts:{def:2}},
 agility:{targetMode:'self',boosts:{spe:2}},
 amnesia:{targetMode:'self',boosts:{spd:2}},
 'aromatic-mist':{targetMode:'adjacentAlly',boosts:{spd:1}},
 'bulk-up':{targetMode:'self',boosts:{atk:1,def:1}},
 'calm-mind':{targetMode:'self',boosts:{spa:1,spd:1}},
 coaching:{targetMode:'adjacentAlly',boosts:{atk:1,def:1}},
 'cosmic-power':{targetMode:'self',boosts:{def:1,spd:1}},
 'cotton-guard':{targetMode:'self',boosts:{def:3}}
};
const moves=Object.fromEntries(Object.keys(expected).map(id=>[id,{id,type:'normal',category:'status',power:null,accuracy:null}]));
const pp=()=>Object.fromEntries(Object.keys(expected).map(id=>[id,20]));
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:100,def:100,spa:100,spd:100,spe:100},pp:pp(),status:null,volatiles:{},stages:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0}});
function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`stages-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}
const manifests=Object.fromEntries(Object.keys(expected).map(id=>[id,allManifests[id]]));
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});

test('r3-stat-stages:self-single applies every reviewed self boost and preserves its input',()=>{
 for(const [moveId,spec] of Object.entries(expected).filter(([,value])=>value.targetMode==='self')){
  const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId,target:{side:'A',slot:0}},{});
  assert.equal(JSON.stringify(battle),before,moveId);
  assert.equal(result.events[0].kind,'moveStarted',moveId);assert.equal(result.events[1].kind,'ppSpent',moveId);
  for(const [stat,delta] of Object.entries(spec.boosts))assert.equal(result.battle.sides.A.roster[0].stages[stat],delta,`${moveId}:${stat}`);
 }
});

test('r3-stat-stages:self-double applies a self boost without touching its ally',()=>{
 for(const [moveId,spec] of Object.entries(expected).filter(([,value])=>value.targetMode==='self')){
  const battle=fixture('double'),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId,target:{side:'A',slot:0}},{});
  for(const [stat,delta] of Object.entries(spec.boosts))assert.equal(result.battle.sides.A.roster[0].stages[stat],delta,`${moveId}:${stat}`);
  assert.deepEqual(result.battle.sides.A.roster[1].stages,{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0},moveId);
 }
});

test('r3-stat-stages:ally-single-failure spends PP then fails when no ally exists',()=>{
 for(const moveId of ['aromatic-mist','coaching']){
  const result=resolveMove(fixture(),{kind:'move',side:'A',actorId:'a1',moveId,target:{side:'A',slot:1}},{});
  assert.deepEqual(result.events.map(event=>event.kind),['moveStarted','ppSpent','moveFailed'],moveId);
  assert.equal(result.events[2].reason,'noTarget',moveId);assert.equal(result.battle.sides.A.roster[0].pp[moveId],19,moveId);
 }
});

test('r3-stat-stages:ally-double affects only the selected adjacent ally',()=>{
 for(const moveId of ['aromatic-mist','coaching']){
  const battle=fixture('double'),result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId,target:{side:'A',slot:1}},{});
  for(const [stat,delta] of Object.entries(expected[moveId].boosts))assert.equal(result.battle.sides.A.roster[1].stages[stat],delta,`${moveId}:${stat}`);
  assert.equal(result.battle.sides.A.roster[0].stages.atk,0,moveId);assert.equal(result.battle.sides.B.roster[0].stages.atk,0,moveId);
 }
});

test('stage changes clamp at both limits and report the applied delta',()=>{
 const high=fixture();high.sides.A.roster[0].stages.def=5;
 const raised=resolveMove(high,{kind:'move',side:'A',actorId:'a1',moveId:'cotton-guard',target:{side:'A',slot:0}},{}),event=raised.events.find(entry=>entry.kind==='statStageChanged');
 assert.equal(event.requestedDelta,3);assert.equal(event.appliedDelta,1);assert.equal(event.after,6);
 const capped=resolveMove(raised.battle,{kind:'move',side:'A',actorId:'a1',moveId:'cotton-guard',target:{side:'A',slot:0}},{}),cappedEvent=capped.events.find(entry=>entry.kind==='statStageChanged');
 assert.equal(cappedEvent.appliedDelta,0);assert.equal(cappedEvent.reason,'stageLimit');
});

test('the same stat-stage command produces a byte-identical replay result',()=>{
 const action={kind:'move',side:'A',actorId:'a1',moveId:'calm-mind',target:{side:'A',slot:0}};
 assert.equal(JSON.stringify(resolveMove(fixture('double'),action,{})),JSON.stringify(resolveMove(fixture('double'),action,{})));
});
