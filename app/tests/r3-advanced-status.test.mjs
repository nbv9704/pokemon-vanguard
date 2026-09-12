import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySwitch} from '../rules-v3/lifecycle.mjs';
import {applyMajorStatus,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,prepareMajorStatusEndTurn,resolveMajorStatusEndTurn,tryMajorStatusAction} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const specs={
 hypnosis:{type:'psychic',accuracy:60,status:'sleep'},
 sing:{type:'normal',accuracy:55,status:'sleep'},
 'sleep-powder':{type:'grass',accuracy:75,status:'sleep'},
 toxic:{type:'poison',accuracy:90,status:'bad-poison'}
};
const moves=Object.fromEntries(Object.entries(specs).map(([id,spec])=>[id,{id,type:spec.type,category:'status',power:null,accuracy:spec.accuracy}]));
const pp=()=>Object.fromEntries(Object.keys(specs).map(id=>[id,20]));
const unit=(actorId,types=['normal'])=>({actorId,types,hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:pp(),status:null,volatiles:{},stages:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0}});

function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`advanced-status-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,eventSequence:0,events:[],result:null,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}

const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(moveId,targetSlot=0)=>({kind:'move',side:'A',actorId:'a1',moveId,target:{side:'B',slot:targetSlot}});
const sequence=(...values)=>{let index=0;return ()=>values[Math.min(index++,values.length-1)];};

test('r3-advanced-status:single applies reviewed sleep and bad-poison moves deterministically',()=>{
 for(const [moveId,spec] of Object.entries(specs)){
  const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,action(moveId),{nextRandom:sequence(0,.99)}),status=result.battle.sides.B.roster[0].status;
  assert.equal(JSON.stringify(battle),before,moveId);assert.equal(status.id,spec.status,moveId);assert.equal(result.battle.sides.A.roster[0].pp[moveId],19,moveId);
  if(spec.status==='sleep')assert.equal(status.turnsRemaining,3,moveId);else assert.equal(status.toxicCounter,0,moveId);
 }
});

test('advanced statuses enforce type immunity and preserve an existing major status',()=>{
 const cases=[['sleep-powder',['grass']],['toxic',['poison']],['toxic',['steel']]];
 for(const [moveId,types] of cases){const battle=fixture();battle.sides.B.roster[0].types=types;const result=resolveMove(battle,action(moveId),{nextRandom:()=>0});assert.equal(result.events.at(-1).reason,'typeImmune',`${moveId}:${types}`);}
 const frozen=fixture();frozen.sides.B.roster[0].types=['ice'];const freezeResult=applyMajorStatus(frozen,{actorId:'a1',targetId:'b1',moveId:'freeze-fixture',status:'freeze'});assert.equal(freezeResult.events[0].reason,'typeImmune');
 const occupied=fixture();occupied.sides.B.roster[0].status={id:'sleep',turnsRemaining:1};const result=resolveMove(occupied,action('toxic'),{nextRandom:()=>0});assert.equal(result.events.at(-1).reason,'alreadyStatus');
});

test('r3-advanced-status:double applies after redirection and misses without mutation',()=>{
 const redirected=fixture('double');redirected.sides.B.roster[1].volatiles.redirection={active:true,order:1};
 const hit=resolveMove(redirected,action('hypnosis'),{nextRandom:sequence(0,0)});assert.equal(hit.battle.sides.B.roster[0].status,null);assert.equal(hit.battle.sides.B.roster[1].status.id,'sleep');
 const missed=resolveMove(fixture('double'),action('sing'),{nextRandom:()=>.99});assert.equal(missed.events.at(-1).kind,'moveMissed');assert.equal(missed.battle.sides.B.roster[0].status,null);
});

test('sleep blocks exactly its seeded duration, then wakes without losing PP on blocked turns',()=>{
 for(const [roll,blockedTurns] of [[0,1],[.34,2],[.99,3]]){
  let battle=fixture();battle.sides.A.roster[0].status=applyMajorStatus(battle,{actorId:'b1',targetId:'a1',moveId:'sleep-fixture',status:'sleep'},{nextRandom:()=>roll}).battle.sides.A.roster[0].status;
  for(let turn=0;turn<blockedTurns;turn++){
   const before=battle.sides.A.roster[0].pp.hypnosis,result=resolveMove(battle,action('hypnosis'),{nextRandom:()=>0});
   assert.equal(result.events[0].kind,'actionPrevented');assert.equal(result.battle.sides.A.roster[0].pp.hypnosis,before);battle=result.battle;
  }
  const awake=tryMajorStatusAction(battle,{actorId:'a1'},{nextRandom:()=>0});assert.equal(awake.cancelled,false);assert.equal(awake.battle.sides.A.roster[0].status,null);assert.equal(awake.events[0].kind,'statusCured');
 }
});

test('freeze uses the seeded twenty-percent thaw gate',()=>{
 const battle=applyMajorStatus(fixture(),{actorId:'b1',targetId:'a1',moveId:'freeze-fixture',status:'freeze'}).battle;
 const ppBefore=battle.sides.A.roster[0].pp.hypnosis,blocked=resolveMove(battle,action('hypnosis'),{nextRandom:()=>.2});assert.equal(blocked.events[0].kind,'actionPrevented');assert.equal(blocked.battle.sides.A.roster[0].pp.hypnosis,ppBefore);
 const frozen=tryMajorStatusAction(battle,{actorId:'a1'},{nextRandom:()=>.2});assert.equal(frozen.cancelled,true);assert.equal(frozen.battle.sides.A.roster[0].status.id,'freeze');
 const thawed=tryMajorStatusAction(battle,{actorId:'a1'},{nextRandom:()=>.199});assert.equal(thawed.cancelled,false);assert.equal(thawed.battle.sides.A.roster[0].status,null);assert.equal(thawed.events[0].kind,'statusCured');
});

test('bad poison escalates to the fifteenth damage step and switch-out resets its counter',()=>{
 let battle=fixture();battle.phase='END_TURN';battle.sides.A.roster[0].status={id:'bad-poison',toxicCounter:0};
 for(const expected of [10,20,30]){const prepared=prepareMajorStatusEndTurn(battle);assert.equal(-prepared.group.changes[0].delta,expected);battle=prepared.battle;}
 battle.sides.A.roster[0].status.toxicCounter=14;const capped=prepareMajorStatusEndTurn(battle);assert.equal(capped.battle.sides.A.roster[0].status.toxicCounter,15);assert.equal(capped.group.changes[0].delta,-150);
 const resolved=resolveMajorStatusEndTurn(fixtureWithToxic());assert.equal(resolved.ok,true);assert.equal(resolved.battle.sides.A.roster[0].hp,150);assert.equal(resolved.battle.sides.A.roster[0].status.toxicCounter,1);
 const switched=applySwitch(capped.battle,'A','a1','a2');assert.equal(switched.ok,true);assert.equal(switched.battle.sides.A.roster[0].status.toxicCounter,0);
});

test('Poison-type Toxic bypasses accuracy while other users still roll against it',()=>{
 const poisonUser=fixture();poisonUser.sides.A.roster[0].types=['poison'];const hit=resolveMove(poisonUser,action('toxic'),{nextRandom:()=>.99});assert.equal(hit.battle.sides.B.roster[0].status.id,'bad-poison');
 const missed=resolveMove(fixture(),action('toxic'),{nextRandom:()=>.99});assert.equal(missed.events.at(-1).kind,'moveMissed');assert.equal(missed.battle.sides.B.roster[0].status,null);
});

test('advanced status resolution is byte-identical for the same battle and roll stream',()=>{
 const run=()=>resolveMove(fixture('double'),action('hypnosis'),{nextRandom:sequence(.2,.6)});
 assert.deepEqual(run(),run());
});

function fixtureWithToxic(){const battle=fixture();battle.phase='END_TURN';battle.sides.A.roster[0].status={id:'bad-poison',toxicCounter:0};return battle;}
