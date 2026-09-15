import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 HANDLER_DEFINITIONS,
 applyDamageHit,
 applyMechanicsSwitch,
 applySubstitute,
 compilePassiveEffects,
 createHeldItemState,
 createHookRegistry,
 createMoveActionHandler,
 resolveEntryAbilities,
 resolveMechanicsEndTurn,
 validateMechanicManifest
} from '../mechanics-v3/index.mjs';
import {projectV3BattleForAi,v3BattleSnapshot,v3BattleView} from '../server/v3-battle-view.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promotedAbilities=['illusion','imposter','hunger-switch','zero-to-hero'];
const promotedMoves=['transform','aura-wheel'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const points=()=>({hp:32,atk:32,def:2,spa:0,spd:0,spe:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,speciesId:'fixture',baseSpeciesId:'fixture',name:actorId,spriteKey:'fixture',types:['normal'],hp:240,maxHp:240,stats:{hp:240,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16,transform:16,'aura-wheel':16},maxPp:{hit:16,transform:16,'aura-wheel':16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),buildSnapshot:{abilityId:null,itemId:null,moveIds:['hit'],natureId:'serious',statPoints:points()},...overrides});
function setAbility(mon,id,itemId=null){mon.activeAbilityId=id;mon.buildSnapshot.abilityId=id;mon.buildSnapshot.itemId=itemId;mon.passiveEffects=effects(id,itemId);mon.itemState=createHeldItemState(itemId);return mon;}
function fixture(format='single'){const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`ability-wave17-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};}
const move=(id='hit',type='normal',category='physical',power=80,accuracy=100)=>({id,name:id,type,category,power,accuracy,maxPP:16,contact:category==='physical'});
const mechanics=(overrides={})=>({targetMode:'adjacentFoe',redirectable:true,priority:0,contact:true,tags:[],handlers:[],...overrides});
const runtime={nextRandom:()=>0.99};

for(const format of ['single','double'])test(`r3-ability-hooks-wave17:${format} validates transform/form mega-patch manifests`,()=>{
 for(const id of promotedAbilities)assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);
 for(const id of promotedMoves)assert.deepEqual(validateMechanicManifest(manifests.moves[id],'moves'),[],id);
});

test('Transform copies current combat profile, stages, moves and Ability while preserving HP and held item',()=>{
 const battle=fixture(),source=battle.sides.A.roster[0],target=battle.sides.B.roster[0];source.hp=137;source.maxHp=240;source.stats.hp=240;source.itemState=createHeldItemState('choice-scarf');source.buildSnapshot.itemId='choice-scarf';source.passiveEffects=compilePassiveEffects({itemId:'choice-scarf',manifests});source.buildSnapshot.moveIds=['transform'];source.pp={transform:16};source.maxPp={transform:16};
 target.speciesId='morpeko';target.name='Morpeko';target.spriteKey='morpeko';target.types=['electric','dark'];target.stats={hp:180,atk:190,def:100,spa:90,spd:100,spe:170};target.stages={...stages(),atk:2,spe:1};target.pp={hit:11,'aura-wheel':9};target.maxPp={hit:16,'aura-wheel':16};setAbility(target,'hunger-switch');
 const resolver=createMoveActionHandler({moves:{transform:move('transform','normal','status',null,null)},manifests:{transform:manifests.moves.transform},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),result=resolver(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime),changed=result.battle.sides.A.roster[0];
 assert.equal(changed.speciesId,'morpeko');assert.deepEqual(changed.types,['electric','dark']);assert.equal(changed.hp,137);assert.equal(changed.maxHp,240);assert.equal(changed.stats.atk,190);assert.equal(changed.stages.atk,2);assert.deepEqual(changed.buildSnapshot.moveIds,['hit','aura-wheel']);assert.deepEqual(changed.pp,{hit:5,'aura-wheel':5});assert.equal(changed.activeAbilityId,'hunger-switch');assert.equal(changed.itemState.heldItemId,'choice-scarf');
});

test('Transform activates copied Ability start semantics when the Ability changes',()=>{
 const battle=fixture(),source=battle.sides.A.roster[0],target=battle.sides.B.roster[0];source.buildSnapshot.moveIds=['transform'];source.pp={transform:16};source.maxPp={transform:16};setAbility(source,'limber');target.pp={hit:16};target.maxPp={hit:16};setAbility(target,'intimidate');const resolver=createMoveActionHandler({moves:{transform:move('transform','normal','status',null,null)},manifests:{transform:manifests.moves.transform},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),result=resolver(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime);assert.equal(result.battle.sides.A.roster[0].activeAbilityId,'intimidate');assert.equal(result.battle.sides.B.roster[0].stages.atk,-1);assert.ok(result.events.some(e=>e.kind==='statStageChanged'&&e.abilityId==='intimidate'&&e.trigger==='transform'));
});

test('Transform state restores on switch-out before the normal stage reset',()=>{
 let battle=fixture(),source=battle.sides.A.roster[0],target=battle.sides.B.roster[0];source.speciesId='ditto';source.baseSpeciesId='ditto';source.name='Ditto';source.buildSnapshot.moveIds=['transform'];source.pp={transform:16};source.maxPp={transform:16};setAbility(source,'limber');target.speciesId='morpeko';target.pp={'aura-wheel':9};target.maxPp={'aura-wheel':16};setAbility(target,'hunger-switch');
 const resolver=createMoveActionHandler({moves:{transform:move('transform','normal','status',null,null)},manifests:{transform:manifests.moves.transform},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});battle=resolver(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime).battle;
 const switched=applyMechanicsSwitch(battle,'A','a1','a2',{manifests});assert.equal(switched.ok,true);const ditto=switched.battle.sides.A.roster[0];assert.equal(ditto.speciesId,'ditto');assert.equal(ditto.activeAbilityId,'limber');assert.deepEqual(ditto.buildSnapshot.moveIds,['transform']);assert.deepEqual(ditto.stages,stages());assert.equal(ditto.transformState,undefined);
});

test('Transform fails against Substitute, an active Illusion, or an already transformed target',()=>{
 const makeResolver=()=>createMoveActionHandler({moves:{transform:move('transform','normal','status',null,null)},manifests:{transform:manifests.moves.transform},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
 let battle=fixture();battle.sides.A.roster[0].buildSnapshot.moveIds=['transform'];battle.sides.A.roster[0].pp={transform:16};battle=applySubstitute(battle,{actorId:'b1',moveId:'substitute'}).battle;let result=makeResolver()(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime);assert.ok(result.events.some(e=>e.kind==='transformFailed'&&e.reason==='targetSubstitute'));
 battle=fixture();battle.sides.A.roster[0].buildSnapshot.moveIds=['transform'];battle.sides.A.roster[0].pp={transform:16};battle.sides.B.roster[0].illusionState={abilityId:'illusion',speciesId:'b3'};result=makeResolver()(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime);assert.ok(result.events.some(e=>e.reason==='targetIllusion'));
 battle=fixture();battle.sides.A.roster[0].buildSnapshot.moveIds=['transform'];battle.sides.A.roster[0].pp={transform:16};battle.sides.B.roster[0].transformState={original:{speciesId:'fixture'}};result=makeResolver()(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime);assert.ok(result.events.some(e=>e.reason==='targetTransformed'));
});

test('Imposter transforms on entry and in Double targets the opposing slot it faces',()=>{
 let battle=fixture('double');setAbility(battle.sides.A.roster[1],'imposter');battle.sides.B.roster[0].speciesId='left-target';battle.sides.B.roster[1].speciesId='right-target';battle.sides.B.roster[0].pp={hit:8};battle.sides.B.roster[1].pp={hit:8};
 const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',slot:1,actorId:'a2'}],{manifests,moves:{hit:move()}}),imposter=result.battle.sides.A.roster[1];assert.equal(imposter.speciesId,'right-target');assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='imposter'&&e.targetId==='b2'));
});

test('Imposter does not transform in Double when no opposing Pokemon occupies the facing slot',()=>{
 const battle=fixture('double');setAbility(battle.sides.A.roster[1],'imposter');battle.sides.B.active[1]=null;const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',slot:1,actorId:'a2'}],{manifests,moves:{hit:move()}});assert.equal(result.battle.sides.A.roster[1].transformState,undefined);assert.equal(result.battle.sides.A.roster[1].activeAbilityId,'imposter');
});

test('Illusion exposes last living teammate appearance without changing real combat typing or stats',()=>{
 const battle=fixture();const zoroark=battle.sides.B.roster[0];zoroark.speciesId='zoroark';zoroark.name='Zoroark';zoroark.spriteKey='zoroark';zoroark.types=['dark'];zoroark.stats.atk=177;setAbility(zoroark,'illusion');const last=battle.sides.B.roster[2];last.speciesId='palafin';last.name='Palafin';last.spriteKey='palafin';last.types=['water'];
 const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'B',slot:0,actorId:'b1'}],{manifests,moves:{hit:move()}}),actual=result.battle.sides.B.roster[0],view=v3BattleSnapshot(result.battle).opponent[0];assert.equal(actual.speciesId,'zoroark');assert.deepEqual(actual.types,['dark']);assert.equal(actual.stats.atk,177);assert.equal(view.speciesId,'palafin');assert.deepEqual(view.types,['water']);
});

test('AI projection sees the Illusion appearance and not the hidden player Ability state',()=>{
 const battle=fixture();setAbility(battle.sides.A.roster[0],'illusion');battle.sides.A.roster[2].speciesId='palafin';battle.sides.A.roster[2].name='Palafin';battle.sides.A.roster[2].types=['water'];const entered=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',slot:0,actorId:'a1'}],{manifests,moves:{hit:move()}}),ai=projectV3BattleForAi(entered.battle),projected=ai.sides.A.roster[0];assert.equal(projected.speciesId,'palafin');assert.deepEqual(projected.types,['water']);assert.equal(projected.activeAbilityId,null);assert.equal(projected.illusionState,undefined);
});

test('opponent Illusion appearance is projected without leaking the hidden Ability event',()=>{
 const battle=fixture();setAbility(battle.sides.B.roster[0],'illusion');battle.sides.B.roster[2].speciesId='palafin';battle.sides.B.roster[2].name='Palafin';const entered=resolveEntryAbilities(battle,[{kind:'switchIn',side:'B',slot:0,actorId:'b1'}],{manifests,moves:{hit:move()}}),view=v3BattleView({battleV3:{id:'view',phase:'COMMAND',mode:'single',difficulty:'normal',battle:entered.battle,lastEvents:entered.events,opponentRoster:[]}});assert.equal(view.snapshot.opponent[0].speciesId,'palafin');assert.equal(view.events.some(e=>e.abilityId==='illusion'||e.kind==='illusionStarted'),false);
});

test('Illusion survives Substitute absorption but breaks when direct move damage reaches the holder',()=>{
 let battle=fixture();setAbility(battle.sides.B.roster[0],'illusion');battle.sides.B.roster[0].types=['dark'];battle.sides.B.roster[2].speciesId='palafin';battle=resolveEntryAbilities(battle,[{kind:'switchIn',side:'B',slot:0,actorId:'b1'}],{manifests,moves:{hit:move()}}).battle;battle=applySubstitute(battle,{actorId:'b1',moveId:'substitute'}).battle;let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move(),mechanics:mechanics()},runtime);assert.ok(result.battle.sides.B.roster[0].illusionState);delete result.battle.sides.B.roster[0].volatiles.substitute;result=applyDamageHit(result.battle,{actorId:'a1',targetId:'b1',move:move(),mechanics:mechanics()},runtime);assert.equal(result.battle.sides.B.roster[0].illusionState,undefined);assert.ok(result.events.some(e=>e.kind==='illusionBroken'));
});


test('Illusion also breaks when fixed move damage reaches the holder',()=>{
 let battle=fixture();setAbility(battle.sides.B.roster[0],'illusion');battle.sides.B.roster[0].types=['dark'];battle.sides.B.roster[2].speciesId='palafin';battle=resolveEntryAbilities(battle,[{kind:'switchIn',side:'B',slot:0,actorId:'b1'}],{manifests,moves:{hit:move()}}).battle;const attacker=battle.sides.A.roster[0];attacker.buildSnapshot.moveIds=['night-shade'];attacker.pp={'night-shade':16};attacker.maxPp={'night-shade':16};const resolver=createMoveActionHandler({moves:{'night-shade':move('night-shade','ghost','special',null,100)},manifests:{'night-shade':manifests.moves['night-shade']},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),result=resolver(battle,{kind:'move',side:'A',actorId:'a1',moveId:'night-shade',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0,abilityManifests:manifests});assert.equal(result.battle.sides.B.roster[0].illusionState,undefined);assert.ok(result.events.some(e=>e.kind==='illusionBroken'));
});

test('Hunger Switch alternates Morpeko form at each completed end turn',()=>{
 let battle=fixture();const morpeko=battle.sides.A.roster[0];morpeko.speciesId='morpeko';morpeko.baseSpeciesId='morpeko';morpeko.name='Morpeko';morpeko.types=['electric','dark'];setAbility(morpeko,'hunger-switch');battle.phase='END_TURN';let result=resolveMechanicsEndTurn(battle,[],{manifests});assert.equal(result.battle.sides.A.roster[0].speciesId,'morpeko-hangry');result.battle.phase='END_TURN';result=resolveMechanicsEndTurn(result.battle,[],{manifests});assert.equal(result.battle.sides.A.roster[0].speciesId,'morpeko');
});

test('Aura Wheel is Electric in Full Belly, Dark in Hangry, and raises Speed only after damage',()=>{
 const resolveFor=battle=>createMoveActionHandler({moves:{'aura-wheel':move('aura-wheel','electric','physical',110,100)},manifests:{'aura-wheel':manifests.moves['aura-wheel']},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)})(battle,{kind:'move',side:'A',actorId:'a1',moveId:'aura-wheel',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0});
 let battle=fixture(),morpeko=battle.sides.A.roster[0];morpeko.speciesId='morpeko';morpeko.buildSnapshot.moveIds=['aura-wheel'];morpeko.pp={'aura-wheel':16};battle.sides.B.roster[0].types=['water'];let result=resolveFor(battle);assert.ok(result.events.some(e=>e.kind==='damage'&&e.effectiveness===2));assert.equal(result.battle.sides.A.roster[0].stages.spe,1);
 battle=fixture();morpeko=battle.sides.A.roster[0];morpeko.speciesId='morpeko-hangry';morpeko.buildSnapshot.moveIds=['aura-wheel'];morpeko.pp={'aura-wheel':16};battle.sides.B.roster[0].types=['water'];result=resolveFor(battle);assert.ok(result.events.some(e=>e.kind==='moveTypeChanged'&&e.toType==='dark'));assert.ok(result.events.some(e=>e.kind==='damage'&&e.effectiveness===1));assert.equal(result.battle.sides.A.roster[0].stages.spe,1);
 battle=fixture();battle.sides.A.roster[0].speciesId='ditto';battle.sides.A.roster[0].buildSnapshot.moveIds=['aura-wheel'];battle.sides.A.roster[0].pp={'aura-wheel':16};result=resolveFor(battle);assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='wrongForm'));assert.equal(result.battle.sides.A.roster[0].stages.spe,0);
});

test('a transformed user with copied Hunger Switch changes Morpeko form and keeps Aura Wheel form semantics',()=>{
 let battle=fixture();const ditto=battle.sides.A.roster[0],morpeko=battle.sides.B.roster[0];ditto.speciesId='ditto';ditto.buildSnapshot.moveIds=['transform'];ditto.pp={transform:16};morpeko.speciesId='morpeko';morpeko.types=['electric','dark'];morpeko.pp={'aura-wheel':8};morpeko.maxPp={'aura-wheel':16};setAbility(morpeko,'hunger-switch');const transform=createMoveActionHandler({moves:{transform:move('transform','normal','status',null,null)},manifests:{transform:manifests.moves.transform},abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});battle=transform(battle,{kind:'move',side:'A',actorId:'a1',moveId:'transform',target:{side:'B',slot:0},priority:0,speed:100},runtime).battle;battle.phase='END_TURN';battle=resolveMechanicsEndTurn(battle,[],{manifests}).battle;assert.equal(battle.sides.A.roster[0].speciesId,'morpeko-hangry');assert.equal(battle.sides.A.roster[0].activeAbilityId,'hunger-switch');
});

test('Zero to Hero changes Palafin on switch-out, preserves damage taken, and remains Hero on re-entry',()=>{
 let battle=fixture(),palafin=battle.sides.A.roster[0];palafin.speciesId='palafin';palafin.baseSpeciesId='palafin';palafin.name='Palafin';palafin.types=['water'];palafin.stats={hp:207,atk:134,def:110,spa:87,spd:100,spe:120};palafin.maxHp=207;palafin.hp=157;setAbility(palafin,'zero-to-hero');let switched=applyMechanicsSwitch(battle,'A','a1','a2',{manifests});assert.equal(switched.ok,true);palafin=switched.battle.sides.A.roster[0];assert.equal(palafin.speciesId,'palafin-hero');assert.equal(palafin.maxHp-palafin.hp,50);assert.ok(palafin.stats.atk>134);switched=applyMechanicsSwitch(switched.battle,'A','a2','a1',{manifests});assert.equal(switched.ok,true);assert.equal(switched.battle.sides.A.roster[0].speciesId,'palafin-hero');
});
