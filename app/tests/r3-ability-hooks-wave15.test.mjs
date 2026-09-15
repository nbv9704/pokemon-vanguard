import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,
 applyLinkedResiduals,
 applyRecoilHandler,
 compilePassiveEffects,
 createHeldItemState,
 resolveAfterMoveItems,
 resolveContactAbilityResponses,
 resolveContactDamageItems,
 resolveEntryAbilities,
 resolveEntryHazards,
 resolveMechanicsEndTurn,
 resolveProtectionBlock,
 validateMechanicManifest
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['anticipation','magic-guard'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:240,maxHp:240,stats:{hp:240,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},maxPp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),buildSnapshot:{abilityId:null,itemId:null,moveIds:['hit']},...overrides});
function setAbility(mon,id,itemId=null){mon.activeAbilityId=id;mon.buildSnapshot.abilityId=id;mon.buildSnapshot.itemId=itemId;mon.passiveEffects=effects(id,itemId);mon.itemState=createHeldItemState(itemId);return mon;}
function fixture(format='single'){const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`ability-wave15-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};}
const move=(id='hit',type='normal',category='physical',power=80)=>({id,name:id,type,category,power,accuracy:100,maxPP:16,contact:true});
const mechanics=(overrides={})=>({targetMode:'adjacentFoe',redirectable:true,priority:0,contact:true,tags:[],handlers:[],...overrides});

for(const format of ['single','double'])test(`r3-ability-hooks-wave15:${format} compiles and validates promoted abilities`,()=>{for(const id of ids){assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);assert.ok(effects(id).length,id);}});

test('Anticipation senses an opposing super-effective damaging move on entry',()=>{const battle=fixture();setAbility(battle.sides.A.roster[0],'anticipation');battle.sides.A.roster[0].types=['fire'];battle.sides.B.roster[0].buildSnapshot.moveIds=['splash','water-hit'];const moves={splash:move('splash','water','status',null),'water-hit':move('water-hit','water','special',70)};const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',slot:0,actorId:'a1'}],{manifests,moves});const trigger=result.events.find(event=>event.abilityId==='anticipation');assert.equal(trigger?.targetId,'b1');assert.equal(trigger?.dangerousMoveId,'water-hit');assert.equal(trigger?.effectiveness,2);});

test('Anticipation stays silent for neutral, resisted, immune, and status moves',()=>{const battle=fixture('double');setAbility(battle.sides.A.roster[0],'anticipation');battle.sides.A.roster[0].types=['normal'];battle.sides.B.roster[0].buildSnapshot.moveIds=['status','neutral'];battle.sides.B.roster[1].buildSnapshot.moveIds=['ghost-hit'];const moves={status:move('status','fighting','status',null),neutral:move('neutral','normal','physical',70),'ghost-hit':move('ghost-hit','ghost','special',70)};const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',slot:0,actorId:'a1'}],{manifests,moves});assert.equal(result.events.some(event=>event.abilityId==='anticipation'),false);});



test('Anticipation senses an opposing OHKO move even without super-effective typing',()=>{const battle=fixture();setAbility(battle.sides.A.roster[0],'anticipation');battle.sides.A.roster[0].types=['normal'];battle.sides.B.roster[0].buildSnapshot.moveIds=['neutral-ohko'];const moves={'neutral-ohko':{...move('neutral-ohko','normal','physical',1),ohko:true}};const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',slot:0,actorId:'a1'}],{manifests,moves});const trigger=result.events.find(event=>event.abilityId==='anticipation');assert.equal(trigger?.dangerousMoveId,'neutral-ohko');assert.equal(trigger?.ohko,true);});

test('Magic Guard still takes direct move damage',()=>{const battle=fixture();setAbility(battle.sides.B.roster[0],'magic-guard');const result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('direct-hit','fighting','physical',80),mechanics:mechanics()},{nextRandom:()=>0.99});assert.ok(result.amount>0);assert.ok(result.battle.sides.B.roster[0].hp<240);assert.equal(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='magic-guard'),false);});

test('Magic Guard blocks burn, poison, sandstorm and Ability weather residual damage while status persists',()=>{const battle=fixture('double');setAbility(battle.sides.A.roster[0],'magic-guard');setAbility(battle.sides.A.roster[1],'magic-guard');battle.sides.A.roster[0].status={id:'burn'};battle.sides.A.roster[1].status={id:'bad-poison',toxicCounter:2};battle.field.weather={id:'sandstorm',remaining:3};const dry={sourceKind:'ability',sourceId:'fixture-dry',kind:'weather-residual-damage',order:40,weather:'sandstorm',numerator:1,denominator:8};battle.sides.A.roster[1].passiveEffects.push(dry);battle.phase='END_TURN';const result=resolveMechanicsEndTurn(battle);assert.equal(result.ok,true);assert.equal(result.battle.sides.A.roster[0].hp,240);assert.equal(result.battle.sides.A.roster[1].hp,240);assert.equal(result.battle.sides.A.roster[0].status.id,'burn');assert.equal(result.battle.sides.A.roster[1].status.toxicCounter,3);});

test('Magic Guard blocks Leech Seed damage and therefore prevents drain healing',()=>{const battle=fixture();setAbility(battle.sides.B.roster[0],'magic-guard');battle.sides.B.roster[0].volatiles['leech-seed']={id:'leech-seed',sourceSide:'A',sourceSlot:0};battle.sides.A.roster[0].hp=100;const result=applyLinkedResiduals(battle);assert.equal(result.battle.sides.B.roster[0].hp,240);assert.equal(result.battle.sides.A.roster[0].hp,100);assert.equal(result.events.some(event=>event.kind==='damage'),false);});

test('Magic Guard blocks damaging entry hazards but does not erase Toxic Spikes status semantics',()=>{const battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');battle.sides.A.conditions['stealth-rock']={id:'stealth-rock',layers:1,sourceActorId:'b1',sourceMoveId:'stealth-rock',order:1};battle.sides.A.conditions.spikes={id:'spikes',layers:1,sourceActorId:'b1',sourceMoveId:'spikes',order:2};battle.sides.A.conditions['toxic-spikes']={id:'toxic-spikes',layers:1,sourceActorId:'b1',sourceMoveId:'toxic-spikes',order:3};const result=resolveEntryHazards(battle,[{kind:'switchIn',side:'A',slot:0,actorId:'a1'}],{manifests});assert.equal(result.battle.sides.A.roster[0].hp,240);assert.equal(result.battle.sides.A.roster[0].status.id,'poison');assert.equal(result.events.filter(event=>event.kind==='abilityTriggered'&&event.abilityId==='magic-guard').length,2);});

test('Magic Guard blocks ordinary recoil but preserves the direct-damage Struggle exception',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');let result=applyRecoilHandler.run({battle,payload:{action:{actorId:'a1'},move:move('double-edge'),totalDamage:120},params:{numerator:1,denominator:3}});assert.equal(result.battle.sides.A.roster[0].hp,240);assert.equal(result.payload.recoilDamage,0);assert.ok(result.events.some(event=>event.abilityId==='magic-guard'));battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');result=applyRecoilHandler.run({battle,payload:{action:{actorId:'a1'},move:move('struggle'),totalDamage:120},params:{numerator:1,denominator:4}});assert.equal(result.battle.sides.A.roster[0].hp,210);});

test('Magic Guard blocks Rough Skin and Aftermath contact damage without suppressing non-damage contact effects',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');setAbility(battle.sides.B.roster[0],'rough-skin');let result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics(),damage:50},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,240);assert.ok(result.events.some(event=>event.abilityId==='rough-skin'));assert.ok(result.events.some(event=>event.abilityId==='magic-guard'));battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');setAbility(battle.sides.B.roster[0],'aftermath');battle.sides.B.roster[0].hp=0;result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics(),damage:50},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,240);});

test('Magic Guard blocks Rocky Helmet, Life Orb recoil, and Spiky Shield damage while activation provenance remains visible',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');battle.sides.B.roster[0].itemState=createHeldItemState('rocky-helmet');battle.sides.B.roster[0].passiveEffects=effects(null,'rocky-helmet');let result=resolveContactDamageItems(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics(),damage:40});assert.equal(result.battle.sides.A.roster[0].hp,240);assert.ok(result.events.some(event=>event.abilityId==='magic-guard'));battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard','life-orb');result=resolveAfterMoveItems(battle,{actorId:'a1',move:move(),mechanics:mechanics(),totalDamage:80});assert.equal(result.battle.sides.A.roster[0].hp,240);assert.ok(result.events.some(event=>event.abilityId==='magic-guard'));battle=fixture();setAbility(battle.sides.A.roster[0],'magic-guard');battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'spiky-shield',retaliation:'spiky-damage',blocksStatus:true};result=resolveProtectionBlock(battle,{targetRef:{actorId:'b1',side:'B'},actorId:'a1',move:move(),mechanics:mechanics()});assert.equal(result.battle.sides.A.roster[0].hp,240);assert.ok(result.events.some(event=>event.abilityId==='magic-guard'));});
