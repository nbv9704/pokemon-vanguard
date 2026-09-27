import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['follow-me','rage-powder','tackle'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='double'){const count=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`redirect-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:1,eventSequence:0,events:[],result:null,activeCount:count,sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>.999};
const action=(side,actorId,moveId,target)=>({kind:'move',side,actorId,moveId,target});

test('r3-redirection:single fails without an ally after spending PP',()=>{
 for(const moveId of ['follow-me','rage-powder']){const result=resolveMove(fixture('single'),action('A','a1',moveId),runtime);assert.equal(result.battle.sides.A.roster[0].pp[moveId],19);assert.equal(result.battle.sides.A.roster[0].volatiles.redirection,undefined);assert.equal(result.events.at(-1).reason,'requiresMultipleActive');}
});

test('r3-redirection:double Follow Me redirects one opposing single-target move',()=>{
 const redirected=resolveMove(fixture(),action('A','a1','follow-me'),runtime),result=resolveMove(redirected.battle,action('B','b1','tackle',{side:'A',slot:1}),runtime);
 assert.ok(result.battle.sides.A.roster[0].hp<200);assert.equal(result.battle.sides.A.roster[1].hp,200);assert.equal(redirected.events.at(-1).kind,'redirectionApplied');
});

test('Rage Powder redirects normal attackers but Grass attackers ignore it',()=>{
 let redirected=resolveMove(fixture(),action('A','a1','rage-powder'),runtime),result=resolveMove(redirected.battle,action('B','b1','tackle',{side:'A',slot:1}),runtime);assert.ok(result.battle.sides.A.roster[0].hp<200);assert.equal(result.battle.sides.A.roster[1].hp,200);
 const grass=fixture();grass.sides.B.roster[0].types=['grass'];redirected=resolveMove(grass,action('A','a1','rage-powder'),runtime);result=resolveMove(redirected.battle,action('B','b1','tackle',{side:'A',slot:1}),runtime);assert.equal(result.battle.sides.A.roster[0].hp,200);assert.ok(result.battle.sides.A.roster[1].hp<200);
});

test('the most recently resolved redirect wins and redirection expires at end turn',()=>{
 let battle=resolveMove(fixture(),action('A','a1','follow-me'),runtime).battle;battle=resolveMove(battle,action('A','a2','follow-me'),runtime).battle;
 const result=resolveMove(battle,action('B','b1','tackle',{side:'A',slot:0}),runtime);assert.equal(result.battle.sides.A.roster[0].hp,200);assert.ok(result.battle.sides.A.roster[1].hp<200);
 battle.phase='END_TURN';const ended=resolveMechanicsEndTurn(battle).battle;assert.equal(ended.sides.A.roster[0].volatiles.redirection,undefined);assert.equal(ended.sides.A.roster[1].volatiles.redirection,undefined);
});
