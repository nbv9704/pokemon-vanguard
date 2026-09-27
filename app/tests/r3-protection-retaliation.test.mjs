import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['spiky-shield','kings-shield','baneful-bunker','feint','wide-guard','tackle','eruption','baby-doll-eyes'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const count=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`retaliation-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:1,eventSequence:0,events:[],result:null,activeCount:count,sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>.999};
const action=(side,actorId,moveId,target)=>({kind:'move',side,actorId,moveId,target});

test('r3-protection-retaliation:single Spiky Shield damages a contact attacker by one eighth',()=>{
 const guarded=resolveMove(fixture(),action('A','a1','spiky-shield'),runtime),result=resolveMove(guarded.battle,action('B','b1','tackle',{side:'A',slot:0}),runtime);
 assert.equal(result.battle.sides.A.roster[0].hp,200);assert.equal(result.battle.sides.B.roster[0].hp,175);assert.deepEqual(result.events.slice(-2).map(event=>event.kind),['moveBlocked','damage']);assert.equal(result.events.at(-1).source,'protection');
});

test('non-contact moves are blocked without triggering shield retaliation',()=>{
 const guarded=resolveMove(fixture(),action('A','a1','spiky-shield'),runtime),result=resolveMove(guarded.battle,action('B','b1','eruption'),runtime);
 assert.equal(result.battle.sides.B.roster[0].hp,200);assert.equal(result.events.filter(event=>event.kind==='damage').length,0);
});

test("King's Shield lowers contact Attack but permits status moves",()=>{
 let guarded=resolveMove(fixture(),action('A','a1','kings-shield'),runtime),contact=resolveMove(guarded.battle,action('B','b1','tackle',{side:'A',slot:0}),runtime);
 assert.equal(contact.battle.sides.B.roster[0].stages.atk,-1);assert.equal(contact.battle.sides.A.roster[0].hp,200);
 guarded=resolveMove(fixture(),action('A','a1','kings-shield'),runtime);const status=resolveMove(guarded.battle,action('B','b1','baby-doll-eyes',{side:'A',slot:0}),runtime);
 assert.equal(status.events.some(event=>event.kind==='moveBlocked'),false);assert.equal(status.battle.sides.A.roster[0].stages.atk,-1);
});

test('Baneful Bunker poisons contact attackers and respects type immunity',()=>{
 let guarded=resolveMove(fixture(),action('A','a1','baneful-bunker'),runtime),result=resolveMove(guarded.battle,action('B','b1','tackle',{side:'A',slot:0}),runtime);assert.equal(result.battle.sides.B.roster[0].status.id,'poison');
 const immune=fixture();immune.sides.B.roster[0].types=['poison'];guarded=resolveMove(immune,action('A','a1','baneful-bunker'),runtime);result=resolveMove(guarded.battle,action('B','b1','tackle',{side:'A',slot:0}),runtime);assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.events.find(event=>event.kind==='statusFailed').reason,'typeImmune');
});

test('r3-break-protection:single Feint removes personal protection before damage',()=>{
 const guarded=resolveMove(fixture(),action('A','a1','spiky-shield'),runtime),result=resolveMove(guarded.battle,action('B','b1','feint',{side:'A',slot:0}),runtime);
 assert.ok(result.battle.sides.A.roster[0].hp<200);assert.equal(result.battle.sides.B.roster[0].hp,200);assert.equal(result.battle.sides.A.roster[0].volatiles.protect,undefined);assert.deepEqual(result.events.filter(event=>['protectionBroken','damage'].includes(event.kind)).map(event=>event.kind),['protectionBroken','damage']);
});

test('r3-protection-retaliation:double retaliates only against the contact source',()=>{
 const guarded=resolveMove(fixture('double'),action('A','a1','baneful-bunker'),runtime),result=resolveMove(guarded.battle,action('B','b2','tackle',{side:'A',slot:0}),runtime);
 assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.battle.sides.B.roster[1].status.id,'poison');
});

test('r3-break-protection:double Feint removes a side guard for later spread moves',()=>{
 let battle=resolveMove(fixture('double'),action('A','a1','wide-guard'),runtime).battle;
 const broken=resolveMove(battle,action('B','b1','feint',{side:'A',slot:0}),runtime);assert.equal(broken.battle.sides.A.conditions['wide-guard'],undefined);assert.deepEqual(broken.events.find(event=>event.kind==='protectionBroken').removed,['wide-guard']);
 const spread=resolveMove(broken.battle,action('B','b2','eruption'),runtime);assert.ok(spread.battle.sides.A.roster[0].hp<200);assert.ok(spread.battle.sides.A.roster[1].hp<200);
});
