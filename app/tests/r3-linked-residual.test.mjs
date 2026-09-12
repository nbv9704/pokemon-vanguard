import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySwitch} from '../rules-v3/lifecycle.mjs';
import {applyLinkedResiduals,applyVolatileStatus,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const moves={'leech-seed':{id:'leech-seed',type:'grass',category:'status',power:null,accuracy:90}};
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,types=['normal'])=>({actorId,types,hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{'leech-seed':20},status:null,volatiles:{},stages:stages()});

function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`linked-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:11,eventSequence:0,events:[],result:null,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}

const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId:'leech-seed',target});

test('r3-linked-residual:single records the source position after accuracy and PP gates',()=>{
 const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,action(),{nextRandom:()=>0}),state=result.battle.sides.B.roster[0].volatiles['leech-seed'];
 assert.equal(JSON.stringify(battle),before);assert.deepEqual({side:state.sourceSide,slot:state.sourceSlot},{side:'A',slot:0});assert.equal(result.battle.sides.A.roster[0].pp['leech-seed'],19);
});

test('Leech Seed misses normally and Grass targets are immune',()=>{
 const missed=resolveMove(fixture(),action(),{nextRandom:()=>.99});assert.equal(missed.events.at(-1).kind,'moveMissed');assert.equal(missed.battle.sides.B.roster[0].volatiles['leech-seed'],undefined);
 const immuneBattle=fixture();immuneBattle.sides.B.roster[0].types=['grass'];const immune=resolveMove(immuneBattle,action(),{nextRandom:()=>0});assert.equal(immune.events.at(-1).reason,'typeImmune');
});

test('linked residual drains one eighth max HP and heals only actual damage',()=>{
 const battle=seededFixture();battle.sides.A.roster[0].hp=100;const result=applyLinkedResiduals(battle);assert.equal(result.battle.sides.B.roster[0].hp,140);assert.equal(result.battle.sides.A.roster[0].hp,120);
 const low=seededFixture();low.sides.B.roster[0].hp=7;low.sides.A.roster[0].hp=100;const limited=applyLinkedResiduals(low);assert.equal(limited.battle.sides.B.roster[0].hp,0);assert.equal(limited.battle.sides.A.roster[0].hp,107);assert.deepEqual(limited.events.filter(event=>['damage','heal'].includes(event.kind)).map(event=>event.amount),[7,7]);
});

test('source slot replacement receives healing while an empty or fainted slot stops drain',()=>{
 const battle=seededFixture();battle.sides.A.roster[0].hp=100;const switched=applySwitch(battle,'A','a1','a2').battle;switched.sides.A.roster[1].hp=90;const replacement=applyLinkedResiduals(switched);assert.equal(replacement.battle.sides.A.roster[0].hp,100);assert.equal(replacement.battle.sides.A.roster[1].hp,110);
 const absent=seededFixture();absent.sides.A.roster[0].hp=0;const noDrain=applyLinkedResiduals(absent);assert.equal(noDrain.battle.sides.B.roster[0].hp,160);assert.deepEqual(noDrain.events,[]);
});

test('r3-linked-residual:double supports ally targeting and foe redirection',()=>{
 const ally=resolveMove(fixture('double'),action({side:'A',slot:1}),{nextRandom:()=>0});assert.equal(ally.battle.sides.A.roster[1].volatiles['leech-seed'].sourceSlot,0);
 const redirected=fixture('double');redirected.sides.B.roster[1].volatiles.redirection={active:true,order:1};const foe=resolveMove(redirected,action(),{nextRandom:()=>0});assert.equal(foe.battle.sides.B.roster[0].volatiles['leech-seed'],undefined);assert.equal(foe.battle.sides.B.roster[1].volatiles['leech-seed'].sourceSlot,0);
});

test('multiple seeded targets aggregate healing and respect the recipient HP cap',()=>{
 let battle=fixture('double');battle=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'fixture',volatile:'leech-seed'}).battle;battle=applyVolatileStatus(battle,{actorId:'a1',targetId:'b2',moveId:'fixture',volatile:'leech-seed'}).battle;battle.sides.A.roster[0].hp=130;
 const result=applyLinkedResiduals(battle);assert.equal(result.battle.sides.B.roster[0].hp,140);assert.equal(result.battle.sides.B.roster[1].hp,140);assert.equal(result.battle.sides.A.roster[0].hp,160);assert.equal(result.events.filter(event=>event.kind==='heal')[0].amount,30);
});

test('mechanics end turn resolves Leech Seed before poison and commits ordered events',()=>{
 const battle=seededFixture();battle.phase='END_TURN';battle.sides.A.roster[0].hp=100;battle.sides.A.roster[0].status={id:'poison'};const result=resolveMechanicsEndTurn(battle);
 assert.equal(result.ok,true);assert.equal(result.battle.sides.B.roster[0].hp,140);assert.equal(result.battle.sides.A.roster[0].hp,100);assert.deepEqual(result.events.filter(event=>['damage','heal'].includes(event.kind)).map(event=>event.source),['leech-seed-damage','leech-seed-heal','major-status-residual']);assert.ok(result.events.every(event=>event.id));
});

test('target switching clears the link and linked residual resolution is deterministic',()=>{
 const battle=seededFixture(),switched=applySwitch(battle,'B','b1','b2');assert.equal(switched.battle.sides.B.roster[0].volatiles['leech-seed'],undefined);
 const run=()=>{const state=seededFixture();state.sides.A.roster[0].hp=100;return applyLinkedResiduals(state);};assert.deepEqual(run(),run());
});

function seededFixture(){return applyVolatileStatus(fixture(),{actorId:'a1',targetId:'b1',moveId:'fixture',volatile:'leech-seed'}).battle;}
