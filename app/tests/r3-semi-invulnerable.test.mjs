import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,semiInvulnerabilityInteraction} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['dig','fly','dive','phantom-force','tackle','earthquake','magnitude','surf','whirlpool','hurricane','smack-down','gust','twister'];
const moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
moves.gust={id:'gust',name:'Gust',type:'flying',category:'special',power:40,accuracy:100,maxPP:56};moves.twister={id:'twister',name:'Twister',type:'dragon',category:'special',power:40,accuracy:100,maxPP:32};moves.magnitude={id:'magnitude',name:'Magnitude',type:'ground',category:'physical',power:70,accuracy:100,maxPP:48};
for(const id of ['earthquake','magnitude','surf','whirlpool','hurricane','smack-down','gust','twister'])manifests.moves[id]={id,targetMode:'adjacentFoe',priority:0,contact:false,handlers:[{id:'spend-pp',hook:'onTryMove',order:10},{id:'check-accuracy',hook:'onMove',order:90},{id:'deal-direct-damage',hook:'onMove',order:100}],testEvidence:{single:['fixture'],double:['fixture']}};

const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=Object.fromEntries(ids.filter(id=>moves[id]).map(id=>[id,moves[id].maxPP]));
const unit=(actorId,types=['normal'])=>({actorId,types,hp:420,maxHp:420,stats:{hp:420,atk:120,def:120,spa:120,spd:120,spe:100},pp:{...pp},status:null,volatiles:{},stages:stages(),passiveEffects:[]});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1',['grass']),unit('b2',['grass'])];
 return {id:`semi-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:41,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(side,actorId,moveId,target)=>({kind:'move',side,actorId,moveId,target,speed:100,priority:0});
const targetA={side:'A',slot:0},targetB={side:'B',slot:0},seeded={nextRandom:()=>0.5};
const prep=(battle,moveId)=>resolveMove(battle,action('B','b1',moveId,targetA),seeded).battle;
const hit=(battle,moveId,runtime=seeded)=>resolveMove(battle,action('A','a1',moveId,targetB),runtime);

for(const format of ['single','double'])test(`r3-semi-invulnerable:${format} two-turn states block ordinary attacks and release with one PP spend`,()=>{
 let battle=fixture(format),beforePp=battle.sides.B.roster[0].pp.dig,prepared=resolveMove(battle,action('B','b1','dig',targetA),seeded);battle=prepared.battle;
 const state=battle.sides.B.roster[0].volatiles['two-turn-move'];assert.equal(state.moveId,'dig');assert.equal(state.semiInvulnerable,'underground');assert.equal(battle.sides.B.roster[0].pp.dig,beforePp-1);assert.ok(prepared.events.some(event=>event.kind==='twoTurnMovePrepared'&&event.semiInvulnerable==='underground'));
 const blocked=hit(battle,'tackle');assert.equal(blocked.battle.sides.B.roster[0].hp,battle.sides.B.roster[0].hp);assert.ok(blocked.events.some(event=>event.kind==='moveMissed'&&event.reason==='semiInvulnerable'&&event.semiInvulnerable==='underground'));
 const released=resolveMove(battle,action('B','b1','dig',targetA),seeded);assert.equal(released.battle.sides.B.roster[0].volatiles['two-turn-move'],undefined);assert.equal(released.battle.sides.B.roster[0].pp.dig,beforePp-1);assert.ok(released.battle.sides.A.roster[0].hp<battle.sides.A.roster[0].hp);assert.ok(released.events.some(event=>event.kind==='twoTurnMoveReleased'&&event.semiInvulnerable==='underground'));
});

test('Dig and Dive exception moves hit through and receive their 2x semi-invulnerability modifier',()=>{
 for(const [twoTurn,attack] of [['dig','earthquake'],['dive','surf']]){
  const normal=hit(fixture(),attack).events.find(event=>event.kind==='damage').amount,battle=prep(fixture(),twoTurn),result=hit(battle,attack),damage=result.events.find(event=>event.kind==='damage');
  assert.ok(damage.amount>normal);assert.equal(damage.breakdown.semiInvulnerabilityModifier?.multiplier,2);assert.equal(damage.breakdown.semiInvulnerabilityModifier?.mode,twoTurn==='dig'?'underground':'underwater');assert.ok(!result.events.some(event=>event.kind==='moveMissed'&&event.reason==='semiInvulnerable'));
 }
});

test('Fly allows reviewed hit-through exceptions, doubles Gust/Twister, and Smack Down interrupts the commitment',()=>{
 let battle=prep(fixture(),'fly');assert.equal(semiInvulnerabilityInteraction(battle.sides.B.roster[0],'hurricane').blocked,false);const hurricane=hit(battle,'hurricane',{nextRandom:()=>0});assert.ok(hurricane.events.some(event=>event.kind==='damage'));
 const normalGust=hit(fixture(),'gust').events.find(event=>event.kind==='damage').amount,gust=hit(prep(fixture(),'fly'),'gust'),gustDamage=gust.events.find(event=>event.kind==='damage');assert.ok(gustDamage.amount>normalGust);assert.equal(gustDamage.breakdown.semiInvulnerabilityModifier?.multiplier,2);
 battle=prep(fixture(),'fly');const smack=hit(battle,'smack-down');assert.equal(smack.battle.sides.B.roster[0].volatiles['two-turn-move'],undefined);assert.ok(smack.events.some(event=>event.kind==='twoTurnMoveAborted'&&event.reason==='hitBySmackDown'));
});

test('Phantom Force remains unreachable while vanished and breaks Protect when it releases',()=>{
 let battle=prep(fixture(),'phantom-force'),blocked=hit(battle,'earthquake');assert.ok(blocked.events.some(event=>event.kind==='moveMissed'&&event.reason==='semiInvulnerable'&&event.semiInvulnerable==='vanished'));
 battle=fixture();battle=resolveMove(battle,action('A','a1','phantom-force',targetB),seeded).battle;battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true,endTurnTimer:1};const hp=battle.sides.B.roster[0].hp,result=resolveMove(battle,action('A','a1','phantom-force',targetB),seeded);assert.ok(result.battle.sides.B.roster[0].hp<hp);assert.equal(result.battle.sides.B.roster[0].volatiles.protect,undefined);assert.ok(result.events.some(event=>event.kind==='protectionBroken'));
});
