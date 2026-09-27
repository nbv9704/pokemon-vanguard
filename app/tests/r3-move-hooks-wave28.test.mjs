import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyForcedSwitches,applyMechanicsSwitch,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,heldItemId,resolveEntryHazards,resolveMechanicsEndTurn,unitIsGrounded} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['block','mean-look','spirit-shackle','ingrain','fairy-lock','aqua-ring','salt-cure','magnet-rise','mortal-spin','tidy-up','sticky-web','trick','switcheroo','fake-out','first-impression','kowtow-cleave'];
const ids=[...promoted],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const validateAction=createMoveChoiceValidator({moves,manifests:manifests.moves});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:3200,maxHp:3200,stats:{hp:3200,atk:220,def:180,spa:210,spd:170,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`wave28-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:28,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0},side='A',actorId='a1')=>({kind:'move',side,actorId,moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const evidence={single:['r3-move-hooks-wave28:single'],double:['r3-move-hooks-wave28:double']};
const runtime={nextRandom:()=>.5};
function setAbility(unit,id){unit.buildSnapshot.abilityId=id;unit.activeAbilityId=id;unit.passiveEffects=[...compilePassiveEffects({abilityId:id,manifests}),...unit.passiveEffects.filter(x=>x.sourceKind==='item')];}
function setItem(unit,id){unit.buildSnapshot.itemId=id;unit.itemState=createHeldItemState(id);unit.passiveEffects=[...unit.passiveEffects.filter(x=>x.sourceKind!=='item'),...compilePassiveEffects({itemId:id,manifests})];}
function endTurn(battle){const next=structuredClone(battle);next.phase='END_TURN';return resolveMechanicsEndTurn(next,[],{manifests});}

test('r3-move-hooks-wave28:single promotes 16 moves across five shared-mechanics families',()=>{
 assert.equal(promoted.length,16);
 for(const id of promoted){assert.ok(manifests.moves[id],`${id}: manifest`);assert.deepEqual(manifests.moves[id].testEvidence,evidence,`${id}: evidence`);assert.equal(manifests.moves[id].handlers[0].id,'spend-pp');}
 assert.equal(manifests.moves['fake-out'].priority,3);assert.equal(manifests.moves['first-impression'].priority,2);assert.equal(manifests.moves['kowtow-cleave'].tags.includes('slicing'),true);
});

test('Block and Mean Look trap through a shared status effect, reflect through Magic Bounce, and release when the source leaves',()=>{
 for(const moveId of ['block','mean-look']){
  let battle=fixture(),result=resolveMove(battle,action(moveId),runtime),switchAction={kind:'switch',side:'B',actorId:'b1',toId:'b3'};
  assert.equal(result.battle.sides.B.roster[0].volatiles.trapped?.sourceId,moveId);assert.equal(validateAction(result.battle,switchAction).code,'TRAPPED_SWITCH_BLOCKED');
  const ghost=structuredClone(result.battle);ghost.sides.B.roster[0].types=['ghost'];assert.equal(validateAction(ghost,switchAction).ok,true);
  const sourceOut=applyMechanicsSwitch(result.battle,'A','a1','a3',{manifests});assert.equal(validateAction(sourceOut.battle,switchAction).ok,true);
  battle=fixture();setAbility(battle.sides.B.roster[0],'magic-bounce');result=resolveMove(battle,action(moveId),runtime);assert.equal(result.battle.sides.A.roster[0].volatiles.trapped?.sourceActorId,'b1');assert.equal(result.battle.sides.B.roster[0].volatiles.trapped,undefined);
 }
});

test('Spirit Shackle traps only after real HP damage and does not trap through Substitute',()=>{
 let base=fixture();base.sides.B.roster[0].types=['fire'];let result=resolveMove(base,action('spirit-shackle'),runtime);assert.equal(result.battle.sides.B.roster[0].volatiles.trapped?.sourceId,'spirit-shackle');
 const battle=fixture();battle.sides.B.roster[0].types=['fire'];battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:1000,maxHp:1000};result=resolveMove(battle,action('spirit-shackle'),runtime);assert.ok(result.events.some(e=>e.kind==='substituteDamaged'));assert.equal(result.battle.sides.B.roster[0].volatiles.trapped,undefined);
});

test('Ingrain and Aqua Ring heal each end turn, Big Root boosts the shared healing path, and Ingrain blocks manual and forced switching',()=>{
 let battle=fixture();battle.sides.A.roster[0].hp=1000;setItem(battle.sides.A.roster[0],'big-root');let result=resolveMove(battle,action('ingrain',{side:'A',slot:0}),runtime);let residual=endTurn(result.battle);assert.equal(residual.battle.sides.A.roster[0].hp,1259);assert.equal(validateAction(result.battle,{kind:'switch',side:'A',actorId:'a1',toId:'a3'}).code,'INGRAIN_SWITCH_BLOCKED');const forced=applyForcedSwitches(result.battle,{actorId:'b1',targetIds:['a1'],moveId:'roar'},runtime);assert.equal(forced.succeeded,false);assert.ok(forced.events.some(e=>e.reason==='ingrain'));
 battle=fixture();battle.sides.A.roster[0].hp=1000;setItem(battle.sides.A.roster[0],'big-root');result=resolveMove(battle,action('aqua-ring',{side:'A',slot:0}),runtime);residual=endTurn(result.battle);assert.equal(residual.battle.sides.A.roster[0].hp,1259);
});

test('Salt Cure uses Champions residual fractions and Magic Guard suppresses the indirect chip',()=>{
 let battle=fixture();let result=resolveMove(battle,action('salt-cure'),runtime),hp=result.battle.sides.B.roster[0].hp,residual=endTurn(result.battle);assert.equal(residual.battle.sides.B.roster[0].hp,hp-200);
 battle=fixture();battle.sides.B.roster[0].types=['water'];result=resolveMove(battle,action('salt-cure'),runtime);hp=result.battle.sides.B.roster[0].hp;residual=endTurn(result.battle);assert.equal(residual.battle.sides.B.roster[0].hp,hp-400);
 battle=fixture();setAbility(battle.sides.B.roster[0],'magic-guard');result=resolveMove(battle,action('salt-cure'),runtime);hp=result.battle.sides.B.roster[0].hp;residual=endTurn(result.battle);assert.equal(residual.battle.sides.B.roster[0].hp,hp);assert.ok(residual.battle.sides.B.roster[0].volatiles['salt-cure']);
});

test('Magnet Rise makes the user ungrounded for a timed five-turn volatile',()=>{
 const result=resolveMove(fixture(),action('magnet-rise',{side:'A',slot:0}),runtime),actor=result.battle.sides.A.roster[0];assert.equal(actor.volatiles['magnet-rise'].endTurnTimer,5);assert.equal(unitIsGrounded(actor,result.battle),false);const residual=endTurn(result.battle);assert.equal(residual.battle.sides.A.roster[0].volatiles['magnet-rise'].endTurnTimer,4);
});

test('Fairy Lock blocks all switches during the next turn only, including forced switches',()=>{
 const result=resolveMove(fixture(),action('fairy-lock',{side:'A',slot:0}),runtime);assert.equal(validateAction(result.battle,{kind:'switch',side:'B',actorId:'b1',toId:'b3'}).ok,true);
 const after=endTurn(result.battle);assert.equal(after.battle.turn,2);assert.equal(validateAction(after.battle,{kind:'switch',side:'B',actorId:'b1',toId:'b3'}).code,'FAIRY_LOCK_SWITCH_BLOCKED');const forced=applyForcedSwitches(after.battle,{actorId:'a1',targetIds:['b1'],moveId:'roar'},runtime);assert.equal(forced.succeeded,false);assert.ok(forced.events.some(e=>e.reason==='fairy-lock'));const expired=endTurn(after.battle);assert.equal(expired.battle.field.fairyLock,undefined);
});

test('Sticky Web lowers grounded entrants, respects Contrary, and does not affect Flying entrants',()=>{
 let battle=resolveMove(fixture(),action('sticky-web'),runtime).battle;let switched=applyMechanicsSwitch(battle,'B','b1','b3',{manifests});let entry=resolveEntryHazards(switched.battle,switched.events,{manifests,moves});assert.equal(entry.battle.sides.B.roster[2].stages.spe,-1);
 battle=resolveMove(fixture(),action('sticky-web'),runtime).battle;setAbility(battle.sides.B.roster[2],'contrary');switched=applyMechanicsSwitch(battle,'B','b1','b3',{manifests});entry=resolveEntryHazards(switched.battle,switched.events,{manifests,moves});assert.equal(entry.battle.sides.B.roster[2].stages.spe,1);
 battle=resolveMove(fixture(),action('sticky-web'),runtime).battle;battle.sides.B.roster[2].types=['flying'];switched=applyMechanicsSwitch(battle,'B','b1','b3',{manifests});entry=resolveEntryHazards(switched.battle,switched.events,{manifests,moves});assert.equal(entry.battle.sides.B.roster[2].stages.spe,0);
});

test('Tidy Up clears hazards and active Substitutes on both sides before boosting Attack and Speed',()=>{
 const battle=fixture('double');battle.sides.A.conditions={'stealth-rock':{id:'stealth-rock',layers:1},'sticky-web':{id:'sticky-web',layers:1}};battle.sides.B.conditions={spikes:{id:'spikes',layers:2},'toxic-spikes':{id:'toxic-spikes',layers:1}};for(const side of ['A','B'])for(const id of battle.sides[side].active)battle.sides[side].roster.find(u=>u.actorId===id).volatiles.substitute={id:'substitute',hp:400,maxHp:400};const result=resolveMove(battle,action('tidy-up',{side:'A',slot:0}),runtime);assert.deepEqual(result.battle.sides.A.conditions,{});assert.deepEqual(result.battle.sides.B.conditions,{});for(const side of ['A','B'])for(const id of result.battle.sides[side].active)assert.equal(result.battle.sides[side].roster.find(u=>u.actorId===id).volatiles.substitute,undefined);assert.equal(result.battle.sides.A.roster[0].stages.atk,1);assert.equal(result.battle.sides.A.roster[0].stages.spe,1);
});

test('Mortal Spin poisons opposing hit targets and clears the user binding, Leech Seed, and own hazards',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].volatiles.bound={id:'bound',sourceId:'bind',sourceActorId:'b1',trapsSwitch:true};battle.sides.A.roster[0].volatiles['leech-seed']={id:'leech-seed',sourceSide:'B',sourceSlot:0};battle.sides.A.conditions={spikes:{id:'spikes',layers:1},'sticky-web':{id:'sticky-web',layers:1}};const result=resolveMove(battle,action('mortal-spin'),runtime);assert.equal(result.battle.sides.A.roster[0].volatiles.bound,undefined);assert.equal(result.battle.sides.A.roster[0].volatiles['leech-seed'],undefined);assert.deepEqual(result.battle.sides.A.conditions,{});assert.equal(result.battle.sides.B.roster[0].status?.id,'poison');assert.equal(result.battle.sides.B.roster[1].status?.id,'poison');
});

test('Trick and Switcheroo swap item state, are blocked by Substitute, and respect target Sticky Hold',()=>{
 for(const moveId of ['trick','switcheroo']){
  let battle=fixture();setItem(battle.sides.A.roster[0],'leftovers');setItem(battle.sides.B.roster[0],'life-orb');let result=resolveMove(battle,action(moveId),runtime);assert.equal(heldItemId(result.battle.sides.A.roster[0]),'life-orb');assert.equal(heldItemId(result.battle.sides.B.roster[0]),'leftovers');assert.ok(result.events.some(e=>e.kind==='itemsSwapped'));
  battle=fixture();setItem(battle.sides.A.roster[0],'leftovers');setItem(battle.sides.B.roster[0],'life-orb');battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:400,maxHp:400};result=resolveMove(battle,action(moveId),runtime);assert.equal(heldItemId(result.battle.sides.A.roster[0]),'leftovers');assert.equal(heldItemId(result.battle.sides.B.roster[0]),'life-orb');
  battle=fixture();setItem(battle.sides.A.roster[0],'leftovers');setItem(battle.sides.B.roster[0],'life-orb');setAbility(battle.sides.B.roster[0],'sticky-hold');result=resolveMove(battle,action(moveId),runtime);assert.equal(heldItemId(result.battle.sides.A.roster[0]),'leftovers');assert.equal(heldItemId(result.battle.sides.B.roster[0]),'life-orb');assert.ok(result.events.some(e=>e.kind==='itemSwapBlocked'&&e.abilityId==='sticky-hold'));
 }
});

test('Fake Out and First Impression work only on the first active turn; a switch-in is eligible on the following turn',()=>{
 for(const moveId of ['fake-out','first-impression']){let result=resolveMove(fixture(),action(moveId),runtime);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId===moveId));if(moveId==='fake-out')assert.ok(result.battle.sides.B.roster[0].volatiles.flinch);let stale=fixture();stale.turn=2;result=resolveMove(stale,action(moveId),runtime);assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='freshEntryRequired'));}
 let battle=fixture(),switched=applyMechanicsSwitch(battle,'A','a1','a3',{manifests});switched.battle.turn=2;switched.battle.phase='RESOLVE';const result=resolveMove(switched.battle,action('first-impression',{side:'B',slot:0},'A','a3'),runtime);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='first-impression'));
});

test('Kowtow Cleave is accuracy-independent and runs as a slicing contact move',()=>{
 const result=resolveMove(fixture(),action('kowtow-cleave'),{nextRandom:()=>.999999});assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='kowtow-cleave'));assert.equal(result.events.some(e=>e.kind==='moveMissed'),false);assert.equal(manifests.moves['kowtow-cleave'].contact,true);assert.ok(manifests.moves['kowtow-cleave'].tags.includes('slicing'));
});

test('r3-move-hooks-wave28:double persistent effects and selected-slot item swaps stay scoped in Double',()=>{
 const battle=fixture('double');setItem(battle.sides.A.roster[0],'leftovers');setItem(battle.sides.B.roster[1],'life-orb');const swapped=resolveMove(battle,action('trick',{side:'B',slot:1}),runtime);assert.equal(heldItemId(swapped.battle.sides.B.roster[0]),null);assert.equal(heldItemId(swapped.battle.sides.B.roster[1]),'leftovers');assert.equal(heldItemId(swapped.battle.sides.A.roster[0]),'life-orb');const trapBattle=fixture('double');trapBattle.sides.B.roster[1].types=['fire'];const trapped=resolveMove(trapBattle,action('spirit-shackle',{side:'B',slot:1}),runtime);assert.equal(trapped.battle.sides.B.roster[0].volatiles.trapped,undefined);assert.equal(trapped.battle.sides.B.roster[1].volatiles.trapped?.sourceId,'spirit-shackle');
});
