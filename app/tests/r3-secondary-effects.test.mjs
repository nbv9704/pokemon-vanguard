import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const selected=['waterfall','crunch','liquidation','ice-punch','body-slam','rock-slide','water-pulse','ice-fang','bulldoze','aerial-ace'];
const moves=Object.fromEntries(allMoves.filter(move=>selected.includes(move.id)).map(move=>[move.id,move]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(Object.values(moves).map(move=>[move.id,move.maxPP||16]));
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:pp(),status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`secondary-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:31,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,speed:100,priority:0});
const sequence=(...values)=>{let index=0;return {nextRandom(){return values[index++]??.999;},calls(){return index;}};};
const effects=id=>compilePassiveEffects({abilityId:id,manifests});

for(const format of ['single','double'])test(`r3-secondary-effects:${format} damaging secondary effects resolve only after successful damage`,()=>{
 const battle=fixture(format),runtime=sequence(.999,.999,0),result=resolveMove(battle,action('waterfall'),runtime),target=result.battle.sides.B.roster[0];
 assert.ok(target.hp<320);assert.equal(target.volatiles.flinch?.id,'flinch');assert.ok(result.events.some(event=>event.kind==='volatileApplied'&&event.volatile==='flinch'));
 const failed=resolveMove(fixture(format),action('waterfall'),sequence(.999,.999,.999));assert.equal(failed.battle.sides.B.roster[0].volatiles.flinch,undefined);
});

test('major-status secondaries reuse intrinsic immunity rules',()=>{
 let battle=fixture(),result=resolveMove(battle,action('body-slam'),sequence(.999,.999,0));assert.equal(result.battle.sides.B.roster[0].status.id,'paralysis');
 battle=fixture();battle.sides.B.roster[0].types=['electric'];result=resolveMove(battle,action('body-slam'),sequence(.999,.999,0));assert.equal(result.battle.sides.B.roster[0].status,null);assert.ok(result.events.some(event=>event.kind==='statusFailed'&&event.reason==='typeImmune'));
});

test('stat-stage secondaries and multiple independent Ice Fang secondaries are deterministic',()=>{
 let result=resolveMove(fixture(),action('crunch'),sequence(.999,.999,0));assert.equal(result.battle.sides.B.roster[0].stages.def,-1);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.secondary===true));
 result=resolveMove(fixture(),action('ice-fang'),sequence(.1,.999,.999,0,0));const target=result.battle.sides.B.roster[0];assert.equal(target.status.id,'freeze');assert.equal(target.volatiles.flinch?.id,'flinch');
});

test('Rock Slide rolls its secondary independently for each damaged spread target',()=>{
 const battle=fixture('double'),runtime=sequence(.1,.1,.999,.999,.999,.999,.1,.9),result=resolveMove(battle,action('rock-slide'),runtime);
 assert.equal(result.events.filter(event=>event.kind==='damage').length,2);assert.equal(result.battle.sides.B.roster[0].volatiles.flinch?.id,'flinch');assert.equal(result.battle.sides.B.roster[1].volatiles.flinch,undefined);
});

test('Bulldoze treats all-adjacent damage as spread and applies its 100% Speed drop only to damaged targets',()=>{
 const battle=fixture('double'),result=resolveMove(battle,action('bulldoze'),sequence(.999,.999,.999,.999,.999,.999));
 const damages=result.events.filter(event=>event.kind==='damage');assert.equal(damages.length,3);assert.ok(damages.every(event=>event.breakdown.spread===.75));
 assert.equal(result.battle.sides.A.roster[0].stages.spe,0);assert.equal(result.battle.sides.A.roster[1].stages.spe,-1);assert.equal(result.battle.sides.B.roster[0].stages.spe,-1);assert.equal(result.battle.sides.B.roster[1].stages.spe,-1);
});

test('Sheer Force boosts moves with secondaries and suppresses every secondary effect',()=>{
 const battle=fixture();battle.sides.A.roster[0].types=['water'];battle.sides.A.roster[0].passiveEffects=effects('sheer-force');
 const boosted=resolveMove(battle,action('waterfall'),sequence(.999,.999,0)),boostedDamage=boosted.events.find(event=>event.kind==='damage');
 const plainBattle=fixture();plainBattle.sides.A.roster[0].types=['water'];const plain=resolveMove(plainBattle,action('waterfall'),sequence(.999,.999,0)),plainDamage=plain.events.find(event=>event.kind==='damage');
 assert.ok(boostedDamage.amount>plainDamage.amount);assert.deepEqual(boostedDamage.breakdown.abilityPowerModifiers.map(entry=>entry.sourceId),['sheer-force']);assert.equal(boosted.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.equal(plain.battle.sides.B.roster[0].volatiles.flinch?.id,'flinch');
 assert.ok(boosted.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='sheer-force'&&event.suppressedSecondaries===1));
});

test('Sheer Force suppresses guaranteed and multiple secondaries but does not boost moves without them',()=>{
 let battle=fixture('double');battle.sides.A.roster[0].passiveEffects=effects('sheer-force');let result=resolveMove(battle,action('bulldoze'),sequence(.999,.999,.999,.999,.999,.999));assert.equal(result.battle.sides.A.roster[1].stages.spe,0);assert.equal(result.battle.sides.B.roster[0].stages.spe,0);assert.ok(result.events.filter(event=>event.kind==='damage').every(event=>event.breakdown.abilityPowerModifiers[0]?.sourceId==='sheer-force'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('sheer-force');result=resolveMove(battle,action('ice-fang'),sequence(.1,.999,.999,0,0));assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.suppressedSecondaries===2));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('sheer-force');result=resolveMove(battle,action('aerial-ace'),sequence(.999,.999));const damage=result.events.find(event=>event.kind==='damage');assert.equal(damage.breakdown.abilityPowerModifiers.length,0);assert.ok(!result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='sheer-force'));
});

test('secondary RNG is not consumed when the damaging hit is blocked by immunity',()=>{
 const battle=fixture();battle.sides.B.roster[0].types=['ghost'];const runtime=sequence(.25),result=resolveMove(battle,action('body-slam'),runtime);assert.equal(runtime.calls(),0);assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.events.find(event=>event.kind==='damage').effectiveness,0);
});
