import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,consumeHeldBerry,createHeldItemState,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,heldItemId} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['belch','bug-bite','pluck','recycle','teatime','laser-focus','lock-on','throat-chop','helping-hand','meteor-beam','electro-shot','sky-attack','raging-bull','flare-blitz','final-gambit','endeavor'];
const support=['dynamic-punch','boomburst','kowtow-cleave'];
const ids=[...promoted,...support],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const registry=createHookRegistry(HANDLER_DEFINITIONS),resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry}),validateAction=createMoveChoiceValidator({moves,manifests:manifests.moves});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:3200,maxHp:3200,stats:{hp:3200,atk:220,def:180,spa:210,spd:170,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null,moveIds:ids},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`wave29-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:29,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0},side='A',actorId='a1')=>({kind:'move',side,actorId,moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const evidence={single:['r3-move-hooks-wave29:single'],double:['r3-move-hooks-wave29:double']};
const runtime={nextRandom:()=>.5};
function sequence(values,fallback=.99){let i=0;return {nextRandom:()=>values[i++]??fallback};}
function setAbility(unit,id){unit.buildSnapshot.abilityId=id;unit.activeAbilityId=id;unit.passiveEffects=[...compilePassiveEffects({abilityId:id,manifests}),...unit.passiveEffects.filter(x=>x.sourceKind==='item')];}
function setItem(unit,id){unit.buildSnapshot.itemId=id;unit.itemState=createHeldItemState(id);unit.passiveEffects=[...unit.passiveEffects.filter(x=>x.sourceKind!=='item'),...compilePassiveEffects({itemId:id,manifests})];}

test('r3-move-hooks-wave29:single promotes 16 moves across six mechanics families',()=>{
 assert.equal(promoted.length,16);for(const id of promoted){assert.ok(manifests.moves[id],`${id}: manifest`);assert.deepEqual(manifests.moves[id].testEvidence,evidence,`${id}: evidence`);}
 assert.equal(manifests.moves['helping-hand'].priority,5);assert.equal(manifests.moves['flare-blitz'].thawsUser,true);assert.equal(manifests.moves['sky-attack'].criticalRatioStages,1);
});

test('Belch requires a Berry to have been consumed and remains enabled after the item is gone',()=>{
 let battle=fixture(),result=resolveMove(battle,action('belch'),runtime);assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='berryNotConsumed'));assert.equal(result.battle.sides.A.roster[0].pp.belch,11);
 battle=fixture();setItem(battle.sides.A.roster[0],'oran-berry');battle.sides.A.roster[0].hp=2000;const eaten=consumeHeldBerry(battle,{holderId:'a1',reason:'test',ignoreBerrySuppression:true});assert.equal(eaten.battle.sides.A.roster[0].itemState.consumedBerryEver,true);result=resolveMove(eaten.battle,action('belch'),runtime);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='belch'));
});

test('Bug Bite and Pluck eat the target Berry, apply its effect to the user, and bypass Unnerve forced-eat suppression',()=>{
 for(const moveId of ['bug-bite','pluck']){const battle=fixture();battle.sides.A.roster[0].hp=1000;setItem(battle.sides.B.roster[0],'sitrus-berry');setAbility(battle.sides.B.roster[0],'unnerve');const result=resolveMove(battle,action(moveId),runtime);assert.equal(heldItemId(result.battle.sides.B.roster[0]),null);assert.equal(result.battle.sides.A.roster[0].hp>1000,true);assert.equal(result.battle.sides.A.roster[0].itemState.consumedBerryEver,true);assert.equal(result.events.some(e=>e.kind==='itemActivationBlocked'),false);}
});

test('Recycle restores the most recently consumed item and Teatime forces active Berries through Unnerve',()=>{
 let battle=fixture();setItem(battle.sides.A.roster[0],'oran-berry');battle.sides.A.roster[0].hp=2000;let eaten=consumeHeldBerry(battle,{holderId:'a1',reason:'test',ignoreBerrySuppression:true});assert.equal(heldItemId(eaten.battle.sides.A.roster[0]),null);let result=resolveMove(eaten.battle,action('recycle',{side:'A',slot:0}),runtime);assert.equal(heldItemId(result.battle.sides.A.roster[0]),'oran-berry');assert.ok(result.events.some(e=>e.kind==='itemRecycled'));
 battle=fixture('double');for(const side of ['A','B'])for(const actorId of battle.sides[side].active){const u=battle.sides[side].roster.find(x=>x.actorId===actorId);u.hp=2000;setItem(u,'oran-berry');}setAbility(battle.sides.B.roster[0],'unnerve');result=resolveMove(battle,action('teatime',{scope:'field'}),runtime);for(const side of ['A','B'])for(const actorId of result.battle.sides[side].active)assert.equal(heldItemId(result.battle.sides[side].roster.find(x=>x.actorId===actorId)),null);assert.equal(result.events.some(e=>e.kind==='itemActivationBlocked'),false);
});

test('Laser Focus guarantees the next damaging move is critical and is consumed by that move',()=>{
 let battle=fixture(),result=resolveMove(battle,action('laser-focus',{side:'A',slot:0}),runtime);assert.equal(result.battle.sides.A.roster[0].volatiles['laser-focus']?.alwaysCritical,true);result=resolveMove(result.battle,action('kowtow-cleave'),runtime);const hit=result.events.find(e=>e.kind==='damage'&&e.moveId==='kowtow-cleave');assert.equal(hit.breakdown.critical,1.5);assert.equal(result.battle.sides.A.roster[0].volatiles['laser-focus'],undefined);
});

test('Lock-On can acquire a semi-invulnerable target and makes the next attack hit that exact target',()=>{
 let battle=fixture();battle.sides.B.roster[0].volatiles['two-turn-move']={id:'two-turn-move',moveId:'fly',startedTurn:1,semiInvulnerable:'airborne',target:{side:'A',slot:0}};let result=resolveMove(battle,action('lock-on'),runtime);assert.equal(result.battle.sides.A.roster[0].volatiles['target-lock']?.targetActorId,'b1');result=resolveMove(result.battle,action('dynamic-punch'),runtime);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='dynamic-punch'));assert.equal(result.events.some(e=>e.kind==='moveMissed'),false);assert.equal(result.battle.sides.A.roster[0].volatiles['target-lock'],undefined);
});

test('Throat Chop blocks sound-tagged moves at both choice validation and action execution',()=>{
 const result=resolveMove(fixture(),action('throat-chop'),runtime);assert.equal(result.battle.sides.B.roster[0].volatiles['sound-blocked']?.blockedMoveTags?.includes('sound'),true);const soundAction=action('boomburst',{side:'A',slot:0},'B','b1');assert.equal(validateAction(result.battle,soundAction).code,'MOVE_TAG_BLOCKED');const attempted=resolveMove(result.battle,soundAction,runtime);assert.ok(attempted.events.some(e=>e.kind==='actionPrevented'&&e.reason==='MOVE_TAG_BLOCKED'));
});

test('Helping Hand boosts an ally next damaging move by 1.5x and consumes the transient boost',()=>{
 const base=fixture('double'),baseHit=resolveMove(base,action('kowtow-cleave',{side:'B',slot:0},'A','a2'),runtime).events.find(e=>e.kind==='damage'&&e.moveId==='kowtow-cleave').amount;let battle=fixture('double'),helped=resolveMove(battle,action('helping-hand',{side:'A',slot:1}),runtime);assert.equal(helped.battle.sides.A.roster[1].volatiles['helping-hand']?.damageMultiplier,1.5);const boosted=resolveMove(helped.battle,action('kowtow-cleave',{side:'B',slot:0},'A','a2'),runtime),boostHit=boosted.events.find(e=>e.kind==='damage'&&e.moveId==='kowtow-cleave').amount;assert.equal(boostHit>baseHit,true);assert.equal(boosted.battle.sides.A.roster[1].volatiles['helping-hand'],undefined);
});

test('Meteor Beam boosts SpA on its charge turn only and attacks on release',()=>{
 let result=resolveMove(fixture(),action('meteor-beam'),runtime);assert.equal(result.battle.sides.A.roster[0].stages.spa,1);assert.ok(result.battle.sides.A.roster[0].volatiles['two-turn-move']);assert.equal(result.events.some(e=>e.kind==='damage'),false);result=resolveMove(result.battle,action('meteor-beam'),runtime);assert.equal(result.battle.sides.A.roster[0].stages.spa,1);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='meteor-beam'));
});

test('Electro Shot boosts SpA and skips charging in rain, while Sky Attack uses charge + high crit + flinch',()=>{
 let battle=fixture();battle.field.weather={id:'rain',remaining:5};let result=resolveMove(battle,action('electro-shot'),runtime);assert.equal(result.battle.sides.A.roster[0].stages.spa,1);assert.equal(result.battle.sides.A.roster[0].volatiles['two-turn-move'],undefined);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='electro-shot'));
 result=resolveMove(fixture(),action('sky-attack'),sequence([.1,.5,.1]));assert.ok(result.battle.sides.A.roster[0].volatiles['two-turn-move']);result=resolveMove(result.battle,action('sky-attack'),sequence([.1,.1,.5,.1]));const hit=result.events.find(e=>e.kind==='damage'&&e.moveId==='sky-attack');assert.equal(hit.breakdown.critical,1.5);assert.ok(result.battle.sides.B.roster[0].volatiles.flinch);
});

test('Raging Bull uses Tauros form typing and breaks Reflect, Light Screen, and Aurora Veil together',()=>{
 const battle=fixture();battle.sides.A.roster[0].speciesId='tauros-paldea-aqua-breed';battle.sides.A.roster[0].types=['fighting','water'];battle.sides.B.conditions={reflect:{id:'reflect',remaining:5},'light-screen':{id:'light-screen',remaining:5},'aurora-veil':{id:'aurora-veil',remaining:5}};const result=resolveMove(battle,action('raging-bull'),runtime);assert.deepEqual(result.battle.sides.B.conditions,{});assert.ok(result.events.some(e=>e.kind==='moveTypeChanged'&&e.toType==='water'));assert.equal(result.events.filter(e=>e.kind==='sideConditionEnded').length,3);
});

test('Flare Blitz thaws the user before the freeze gate, can burn, and applies one-third recoil',()=>{
 const battle=fixture();battle.sides.A.roster[0].status={id:'freeze'};const result=resolveMove(battle,action('flare-blitz'),sequence([.99,.99,.05]));assert.equal(result.battle.sides.A.roster[0].status,null);assert.ok(result.events.some(e=>e.kind==='statusCured'&&e.reason==='moveThaw'));assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');assert.ok(result.events.some(e=>e.kind==='damage'&&e.source==='recoil'));
});

test('Final Gambit deals current HP then faints the user, but immunity prevents the sacrifice',()=>{
 let battle=fixture();battle.sides.A.roster[0].hp=1000;let result=resolveMove(battle,action('final-gambit'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,2200);assert.equal(result.battle.sides.A.roster[0].hp,0);
 battle=fixture();battle.sides.A.roster[0].hp=1000;battle.sides.B.roster[0].types=['ghost'];result=resolveMove(battle,action('final-gambit'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,3200);assert.equal(result.battle.sides.A.roster[0].hp,1000);
});

test('r3-move-hooks-wave29:double Endeavor cuts only the selected target down to the user current HP',()=>{
 let battle=fixture('double');battle.sides.A.roster[0].hp=1000;let result=resolveMove(battle,action('endeavor',{side:'B',slot:1}),runtime);assert.equal(result.battle.sides.B.roster[0].hp,3200);assert.equal(result.battle.sides.B.roster[1].hp,1000);battle=fixture();battle.sides.A.roster[0].hp=1200;battle.sides.B.roster[0].hp=800;result=resolveMove(battle,action('endeavor'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,800);
});
