import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['body-press','psyshock','sacred-sword','darkest-lariat','scald','scorching-sands','thunder','matcha-gotcha','grav-apple','minimize','cotton-spore','soak','magic-powder','dire-claw','tri-attack','snore','sparkling-aria','guard-swap','power-swap'];
const ids=[...promoted],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1800,maxHp:1800,stats:{hp:1800,atk:180,def:150,spa:180,spd:150,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1',{types:['water']}),unit('b2',{types:['water']}),unit('b3')];
 return {id:`wave23-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:23,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0},extra={})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100,...extra});
const damageTo=(result,id='b1')=>result.events.find(event=>event.kind==='damage'&&event.targetId===id);
const evidence={single:['r3-move-hooks-wave23:single'],double:['r3-move-hooks-wave23:double']};
const setAbility=(battle,side,index,id)=>{const actor=battle.sides[side].roster[index];actor.buildSnapshot.abilityId=id;actor.passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const burn=()=>({id:'burn',sourceId:'fixture',turnsActive:0});

test('r3-move-hooks-wave23:single all 19 declarations use Wave 23 evidence and generic mechanics',()=>{
 assert.equal(promoted.length,19);assert.equal(new Set(promoted).size,19);
 for(const id of promoted){const manifest=manifests.moves[id];assert.ok(manifest,`${id}: manifest`);assert.deepEqual(manifest.testEvidence,evidence,`${id}: evidence`);assert.equal(manifest.handlers[0].id,'spend-pp',`${id}: spends PP`);}
 assert.deepEqual(manifests.moves['body-press'].damageProfile,{offensiveStat:'def'});
 assert.deepEqual(manifests.moves.psyshock.damageProfile,{defensiveStat:'def'});
 assert.equal(manifests.moves['sacred-sword'].handlers.find(entry=>entry.id==='check-accuracy').params.ignoreTargetEvasion,true);
 assert.deepEqual(manifests.moves['magic-powder'].tags,['powder']);assert.equal(manifests.moves.snore.sleepUsable,true);
 assert.equal(manifests.moves['guard-swap'].bypassSubstitute,true);assert.equal(manifests.moves['power-swap'].bypassSubstitute,true);
 assert.equal(manifests.moves['sparkling-aria'].secondaryEffects[0].kind,'cure-major-status');
 assert.equal(manifests.moves['parting-shot'],undefined,'reflected pivot remains fail-closed');
});

test('damage profiles cover Body Press, Psyshock, Sacred Sword, and Darkest Lariat without move-id branches',()=>{
 let battle=fixture();battle.sides.A.roster[0].stats.def=260;let base=resolveMove(battle,action('body-press'),{nextRandom:()=>.999});assert.equal(damageTo(base).breakdown.damageProfile.offensiveStat,'def');
 battle=fixture();battle.sides.A.roster[0].stats.def=260;battle.sides.A.roster[0].stages.def=2;let boosted=resolveMove(battle,action('body-press'),{nextRandom:()=>.999});assert.ok(damageTo(boosted).amount>damageTo(base).amount,'Defense stages drive Body Press');
 battle=fixture();battle.sides.B.roster[0].stats.def=70;battle.sides.B.roster[0].stats.spd=400;let result=resolveMove(battle,action('psyshock'),{nextRandom:()=>.999});assert.equal(damageTo(result).breakdown.damageProfile.defensiveStat,'def');assert.ok(damageTo(result).amount>0);
 const sacredPlain=resolveMove(fixture(),action('sacred-sword'),{nextRandom:()=>.999});battle=fixture();battle.sides.B.roster[0].stages.def=6;battle.sides.B.roster[0].stages.evasion=6;const sacredBoosted=resolveMove(battle,action('sacred-sword'),{nextRandom:()=>.999});assert.equal(damageTo(sacredBoosted).amount,damageTo(sacredPlain).amount);assert.equal(sacredBoosted.events.some(event=>event.kind==='moveMissed'),false);
 const lariatPlain=resolveMove(fixture(),action('darkest-lariat'),{nextRandom:()=>.999});battle=fixture();battle.sides.B.roster[0].stages.def=6;const lariatBoosted=resolveMove(battle,action('darkest-lariat'),{nextRandom:()=>.999});assert.equal(damageTo(lariatBoosted).amount,damageTo(lariatPlain).amount);
});

test('burn/status composition covers Scald, Scorching Sands, rain Thunder, and Matcha Gotcha drain',()=>{
 for(const id of ['scald','scorching-sands']){const result=resolveMove(fixture(),action(id),{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status?.id,'burn',id);assert.ok(damageTo(result)?.amount>0,id);}
 let battle=fixture();battle.field.weather={id:'rain',remaining:5};battle.sides.A.roster[0].stages.accuracy=-6;battle.sides.B.roster[0].stages.evasion=6;let result=resolveMove(battle,action('thunder'),{nextRandom:()=>0});assert.ok(damageTo(result)?.amount>0);assert.equal(result.events.some(event=>event.kind==='moveMissed'),false);assert.equal(result.battle.sides.B.roster[0].status?.id,'paralysis');
 battle=fixture('double');battle.sides.A.roster[0].hp=800;result=resolveMove(battle,action('matcha-gotcha'),{nextRandom:()=>0});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId)),new Set(['b1','b2']));assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');assert.equal(result.battle.sides.B.roster[1].status?.id,'burn');assert.ok(result.battle.sides.A.roster[0].hp>800);assert.ok(result.events.some(event=>event.kind==='heal'));
});

test('stage primitives cover Grav Apple, Minimize, and Cotton Spore Grass immunity',()=>{
 let result=resolveMove(fixture(),action('grav-apple'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].stages.def,-1);
 result=resolveMove(fixture(),action('minimize',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stages.evasion,2);
 const battle=fixture('double');battle.sides.B.roster[0].types=['grass'];battle.sides.B.roster[1].types=['water'];result=resolveMove(battle,action('cotton-spore'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].stages.spe,0);assert.equal(result.battle.sides.B.roster[1].stages.spe,-2);assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.targetId==='b1'&&event.reason==='typeImmune'));
});

test('type replacement covers Soak, Magic Powder Grass immunity, and Magic Bounce reflection',()=>{
 let battle=fixture();battle.sides.B.roster[0].types=['fire','flying'];let result=resolveMove(battle,action('soak'),{nextRandom:()=>.999});assert.deepEqual(result.battle.sides.B.roster[0].types,['water']);assert.ok(result.events.some(event=>event.kind==='typesChanged'&&event.targetId==='b1'));
 battle=fixture();battle.sides.B.roster[0].types=['grass'];result=resolveMove(battle,action('magic-powder'),{nextRandom:()=>.999});assert.deepEqual(result.battle.sides.B.roster[0].types,['grass']);assert.ok(result.events.some(event=>event.kind==='typeChangeFailed'&&event.reason==='typeImmune'));
 battle=fixture();battle.sides.B.roster[0].types=['fire'];setAbility(battle,'B',0,'magic-bounce');result=resolveMove(battle,action('soak'),{nextRandom:()=>.999});assert.deepEqual(result.battle.sides.A.roster[0].types,['water']);assert.deepEqual(result.battle.sides.B.roster[0].types,['fire']);assert.ok(result.events.some(event=>event.kind==='moveReflected'&&event.moveId==='soak'));
});

test('random major-status secondaries cover Dire Claw and Tri Attack deterministically',()=>{
 let result=resolveMove(fixture(),action('dire-claw'),{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status?.id,'poison');assert.ok(damageTo(result)?.amount>0);
 result=resolveMove(fixture(),action('tri-attack'),{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');assert.ok(damageTo(result)?.amount>0);
});

test('Snore uses the real sleep gate, while Guard Swap and Power Swap bypass Substitute and exchange only declared stages',()=>{
 let battle=fixture(),before=battle.sides.A.roster[0].pp.snore,result=resolveMove(battle,action('snore'),{nextRandom:()=>0});assert.equal(result.events.some(event=>event.kind==='damage'),false);assert.equal(result.battle.sides.A.roster[0].pp.snore,before-1);assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='userStatusRequirement'));
 battle=fixture();battle.sides.A.roster[0].status={id:'sleep',sourceId:'fixture',turnsRemaining:2};battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};result=resolveMove(battle,action('snore'),{nextRandom:()=>0});assert.ok(damageTo(result)?.amount>0,'sound bypasses Substitute');assert.equal(result.battle.sides.A.roster[0].status?.turnsRemaining,1);assert.ok(result.events.some(event=>event.kind==='statusActionAllowed'&&event.status==='sleep'));assert.ok(result.battle.sides.B.roster[0].volatiles.flinch);
 battle=fixture();battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};battle.sides.A.roster[0].stages.def=2;battle.sides.A.roster[0].stages.spd=-1;battle.sides.B.roster[0].stages.def=-3;battle.sides.B.roster[0].stages.spd=4;result=resolveMove(battle,action('guard-swap'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stages.def,-3);assert.equal(result.battle.sides.A.roster[0].stages.spd,4);assert.equal(result.battle.sides.B.roster[0].stages.def,2);assert.equal(result.battle.sides.B.roster[0].stages.spd,-1);
 battle=fixture();battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};battle.sides.A.roster[0].stages.atk=5;battle.sides.A.roster[0].stages.spa=-2;battle.sides.B.roster[0].stages.atk=-4;battle.sides.B.roster[0].stages.spa=3;result=resolveMove(battle,action('power-swap'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stages.atk,-4);assert.equal(result.battle.sides.A.roster[0].stages.spa,3);assert.equal(result.battle.sides.B.roster[0].stages.atk,5);assert.equal(result.battle.sides.B.roster[0].stages.spa,-2);
});

test('Sparkling Aria burn cure composes with spread Shield Dust behavior and Sheer Force suppression',()=>{
 let battle=fixture('double');battle.sides.A.roster[1].status=burn();battle.sides.B.roster[0].status=burn();battle.sides.B.roster[1].status=burn();setAbility(battle,'B',0,'shield-dust');let result=resolveMove(battle,action('sparkling-aria'),{nextRandom:()=>.999});for(const [side,index] of [['A',1],['B',0],['B',1]])assert.equal(result.battle.sides[side].roster[index].status,null);assert.deepEqual(new Set(result.events.filter(event=>event.kind==='statusCured').map(event=>event.targetId)),new Set(['a2','b1','b2']));
 battle=fixture();battle.sides.B.roster[0].status=burn();setAbility(battle,'B',0,'shield-dust');result=resolveMove(battle,action('sparkling-aria'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');assert.ok(result.events.some(event=>event.kind==='secondaryEffectBlocked'&&event.targetId==='b1'));
 battle=fixture();battle.sides.B.roster[0].status=burn();setAbility(battle,'A',0,'sheer-force');result=resolveMove(battle,action('sparkling-aria'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');assert.equal(result.events.some(event=>event.kind==='statusCured'),false);assert.ok(damageTo(result).breakdown.abilityPowerModifiers.some(entry=>entry.sourceId==='sheer-force'));
});
