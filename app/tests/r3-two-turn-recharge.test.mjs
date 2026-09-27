import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,resolveRechargeAction} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['solar-beam','solar-blade','hydro-cannon','frenzy-plant','blast-burn','hyper-beam','giga-impact','tackle'];
const moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp={...Object.fromEntries(ids.map(id=>[id,moves[id]?.maxPP||20]))};
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:220,maxHp:220,stats:{hp:220,atk:120,def:100,spa:120,spd:100,spe:100},pp:{...pp},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`charge-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:23,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const validator=createMoveChoiceValidator({moves,manifests:manifests.moves});
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,speed:100,priority:0});
const seeded={nextRandom:()=>0.5};

for(const format of ['single','double'])test(`r3-two-turn-recharge:${format} Solar Beam charges, locks target, spends PP once, then releases`,()=>{
 let battle=fixture(format),beforeHp=battle.sides.B.roster[0].hp,first=resolveMove(battle,action('solar-beam'),seeded);battle=first.battle;
 assert.equal(battle.sides.A.roster[0].pp['solar-beam'],moves['solar-beam'].maxPP-1);assert.equal(battle.sides.B.roster[0].hp,beforeHp);assert.equal(battle.sides.A.roster[0].volatiles['two-turn-move']?.moveId,'solar-beam');assert.ok(first.events.some(event=>event.kind==='twoTurnMovePrepared'));
 assert.equal(validator(battle,action('tackle')).code,'TWO_TURN_MOVE_REQUIRED');assert.equal(validator(battle,{kind:'switch',side:'A',actorId:'a1',toId:'a2'}).code,'TWO_TURN_MOVE_REQUIRED');assert.equal(validator(battle,action('solar-beam',{side:'B',slot:format==='double'?1:0})).ok,format==='single');
 const second=resolveMove(battle,action('solar-beam'),seeded);battle=second.battle;assert.equal(battle.sides.A.roster[0].pp['solar-beam'],moves['solar-beam'].maxPP-1);assert.equal(battle.sides.A.roster[0].volatiles['two-turn-move'],undefined);assert.ok(battle.sides.B.roster[0].hp<beforeHp);assert.ok(second.events.some(event=>event.kind==='twoTurnMoveReleased'));assert.ok(second.events.some(event=>event.kind==='ppSpendSkipped'));
});

test('Solar moves skip charge in sun and halve released power in rain',()=>{
 let battle=fixture();battle.field.weather={id:'sun',remaining:4};let result=resolveMove(battle,action('solar-beam'),seeded);assert.equal(result.battle.sides.A.roster[0].volatiles['two-turn-move'],undefined);assert.ok(result.events.some(event=>event.kind==='twoTurnChargeSkipped'));
 battle=fixture();battle.field.weather={id:'rain',remaining:4};result=resolveMove(battle,action('solar-blade'),seeded);assert.ok(result.battle.sides.A.roster[0].volatiles['two-turn-move']);result=resolveMove(result.battle,action('solar-blade'),seeded);const modified=result.events.find(event=>event.kind==='movePowerModified');assert.equal(modified.power,62);assert.equal(modified.reason,'rain');
});

test('an interrupted release clears the two-turn commitment instead of preserving it',()=>{
 let battle=resolveMove(fixture(),action('solar-beam'),seeded).battle;battle.sides.A.roster[0].volatiles.flinch={id:'flinch'};const result=resolveMove(battle,action('solar-beam'),seeded);assert.equal(result.battle.sides.A.roster[0].volatiles['two-turn-move'],undefined);assert.ok(result.events.some(event=>event.kind==='twoTurnMoveAborted'&&event.reason==='flinch'));assert.ok(!result.events.some(event=>event.kind==='damage'));
});

test('successful recharge move commits the user to a recharge action and recharge consumes no PP',()=>{
 let battle=fixture(),beforePp=battle.sides.A.roster[0].pp['hydro-cannon'],used=resolveMove(battle,action('hydro-cannon'),seeded);battle=used.battle;assert.equal(battle.sides.A.roster[0].pp['hydro-cannon'],beforePp-1);assert.equal(battle.sides.A.roster[0].volatiles['must-recharge']?.moveId,'hydro-cannon');assert.ok(used.events.some(event=>event.kind==='rechargeRequired'));
 assert.equal(validator(battle,action('tackle')).code,'MUST_RECHARGE');assert.equal(validator(battle,{kind:'switch',side:'A',actorId:'a1',toId:'a2'}).code,'MUST_RECHARGE');const recharge={kind:'recharge',side:'A',actorId:'a1',speed:100,priority:0};assert.equal(validator(battle,recharge).ok,true);
 const rested=resolveRechargeAction(battle,recharge);assert.equal(rested.battle.sides.A.roster[0].volatiles['must-recharge'],undefined);assert.equal(rested.battle.sides.A.roster[0].pp['hydro-cannon'],beforePp-1);assert.equal(rested.events[0].kind,'rechargeTurn');
});

test('misses and immunities do not create a recharge commitment',()=>{
 let battle=fixture(),miss=resolveMove(battle,action('hydro-cannon'),{nextRandom:()=>0.99});assert.equal(miss.battle.sides.A.roster[0].volatiles['must-recharge'],undefined);assert.ok(miss.events.some(event=>event.kind==='moveMissed'));
 battle=fixture();battle.sides.B.roster[0].types=['ghost'];const immune=resolveMove(battle,action('hyper-beam'),seeded);assert.equal(immune.battle.sides.A.roster[0].volatiles['must-recharge'],undefined);assert.ok(immune.events.some(event=>event.kind==='damage'&&event.amount===0));
});
