import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 abilityPowerModifiers,activateHeldItem,applySecondaryEffects,applyStatStagesHandler,applyVolatileStatus,compilePassiveEffects,createHeldItemState,effectiveWeatherId,modifyMoveByAbility,
 resolveAfterMoveAbilityState,resolveBeforeMoveAbilityState,resolveContactAbilityResponses,resolveDamageResponseAbilities,resolveEndTurnAbilityStageBoosts,
 resolveEntryAbilities,resolveSwitchOutAbilities,resolveTargetAbilityBlock,spendPpHandler,tryMajorStatusAction,validateMechanicManifest,weatherDamageModifier,weatherResidualDamageGroup
} from '../mechanics-v3/index.mjs';
import {selectRedirection} from '../rules-v3/redirection.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['aftermath','analytic','cheek-pouch','cloud-nine','cursed-body','early-bird','electromorphosis','frisk','mirror-armor','moody','oblivious','overcoat','pressure','protean','stalwart','supreme-overlord'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:300,maxHp:300,stats:{hp:300,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16,shock:16},maxPp:{hit:16,shock:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave11-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const move=(id='hit',type='normal',category='physical',power=80)=>({id,name:id,type,category,power,accuracy:100,maxPP:16,contact:false});
const mechanics=(overrides={})=>({targetMode:'adjacentFoe',redirectable:true,priority:0,contact:false,tags:[],handlers:[],...overrides});

for(const format of ['single','double'])test(`r3-ability-hooks-wave11:${format} compiles and validates all promoted abilities`,()=>{
 for(const id of ids){assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceId===id&&effect.sourceKind==='ability'),id);}
});

test('Aftermath only retaliates after a contact KO and uses one quarter attacker max HP',()=>{
 let battle=fixture(),attacker=battle.sides.A.roster[0],holder=battle.sides.B.roster[0];holder.passiveEffects=effects('aftermath');holder.hp=0;
 let result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics({contact:true}),damage:100},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,225);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='aftermath'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('aftermath');result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics({contact:true}),damage:100},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,300);
});

test('Analytic gets its 1.3 power modifier when the selected target has already acted, independent of other actors',()=>{
 const battle=fixture('double'),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];actor.passiveEffects=effects('analytic');const base=move();
 assert.equal(abilityPowerModifiers(actor,base,mechanics(),{battle,target,runtime:{willMove:id=>id==='b2'}}).apply(100),130);
 assert.equal(abilityPowerModifiers(actor,base,mechanics(),{battle,target,runtime:{willMove:id=>id==='b1'||id==='b2'}}).apply(100),100);
});

test('Cheek Pouch heals one third max HP whenever its holder consumes a Berry',()=>{
 const battle=fixture(),actor=battle.sides.A.roster[0];actor.hp=120;actor.itemState=createHeldItemState('sitrus-berry');actor.passiveEffects=[...effects('cheek-pouch'),...effects(null,'sitrus-berry')];const result=activateHeldItem(battle,{actorId:'a1',itemId:'sitrus-berry',reason:'test',consume:true});assert.equal(result.battle.sides.A.roster[0].hp,220);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='cheek-pouch'));
});

test('Cloud Nine suppresses weather effects without deleting or pausing weather state',()=>{
 const battle=fixture();battle.field.weather={id:'sandstorm',remaining:3};battle.sides.A.roster[0].passiveEffects=effects('cloud-nine');assert.equal(effectiveWeatherId(battle),null);assert.equal(weatherDamageModifier({...battle,field:{weather:{id:'sun',remaining:3}}},'fire'),1);assert.deepEqual(weatherResidualDamageGroup(battle).changes,[]);assert.equal(battle.field.weather.remaining,3);
});

test('Cursed Body uses seeded RNG and disables the move that actually damaged the holder',()=>{
 const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('cursed-body');const result=resolveDamageResponseAbilities(battle,{actorId:'a1',targetId:'b1',move:move('hit'),damage:30,hpBefore:300,hpAfter:270},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].volatiles.disable.moveId,'hit');assert.ok(result.events.some(e=>e.abilityId==='cursed-body'));
});

test('Early Bird advances sleep recovery at twice the normal counter rate',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0];actor.passiveEffects=effects('early-bird');actor.status={id:'sleep',turnsRemaining:2};const result=tryMajorStatusAction(battle,{actorId:'a1'},{nextRandom:()=>0});assert.equal(result.cancelled,false);assert.equal(result.battle.sides.A.roster[0].status,null);
});

test('Electromorphosis arms on damage, doubles the next Electric attack, then consumes the charge',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('electromorphosis');let response=resolveDamageResponseAbilities(battle,{actorId:'a1',targetId:'b1',move:move('hit'),damage:20,hpBefore:300,hpAfter:280},{nextRandom:()=>0});let holder=response.battle.sides.B.roster[0];assert.ok(holder.abilityState['charge:electromorphosis']);assert.equal(abilityPowerModifiers(holder,move('shock','electric','special',80),mechanics(),{battle:response.battle,runtime:{}}).apply(80),160);const used=resolveAfterMoveAbilityState(response.battle,{actorId:'b1',move:move('shock','electric','special',80)});assert.equal(used.battle.sides.B.roster[0].abilityState['charge:electromorphosis'],undefined);
});

test('Frisk reveals every currently held opposing item on entry, including suppressed items',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].passiveEffects=effects('frisk');for(const foe of battle.sides.B.roster.slice(0,2)){foe.itemState=createHeldItemState('sitrus-berry');foe.passiveEffects=effects(null,'sitrus-berry');}battle.sides.B.roster[1].passiveEffects=[...effects('klutz'),...effects(null,'sitrus-berry')];const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',actorId:'a1'}]);assert.equal(result.battle.sides.B.roster[0].itemState.revealed,true);assert.equal(result.battle.sides.B.roster[1].itemState.revealed,true);assert.equal(result.events.filter(e=>e.kind==='itemRevealed').length,2);
});

test('Mirror Armor reflects primary, secondary, entry-Ability, and contact Ability stat drops',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('mirror-armor');let result=applyStatStagesHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:move('growl','normal','status',0),mechanics:mechanics()},params:{boosts:{atk:-1}}});assert.equal(result.battle.sides.B.roster[0].stages.atk,0);assert.equal(result.battle.sides.A.roster[0].stages.atk,-1);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='mirror-armor'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('mirror-armor');result=applySecondaryEffects(battle,{actorId:'a1',targetIds:['b1'],moveId:'hit',effects:[{kind:'stat-stages',chance:100,boosts:{def:-1}}]});assert.equal(result.battle.sides.B.roster[0].stages.def,0);assert.equal(result.battle.sides.A.roster[0].stages.def,-1);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('intimidate');battle.sides.B.roster[0].passiveEffects=effects('mirror-armor');result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',actorId:'a1'}]);assert.equal(result.battle.sides.B.roster[0].stages.atk,0);assert.equal(result.battle.sides.A.roster[0].stages.atk,-1);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('mirror-armor');battle.sides.B.roster[0].passiveEffects=effects('gooey');result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics({contact:true}),damage:20},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].stages.spe,0);assert.equal(result.battle.sides.B.roster[0].stages.spe,-1);
 battle=fixture();battle.sides.A.roster[0].itemState=createHeldItemState('white-herb');battle.sides.A.roster[0].passiveEffects=effects(null,'white-herb');battle.sides.B.roster[0].passiveEffects=effects('mirror-armor');result=applyStatStagesHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:move('growl','normal','status',0),mechanics:mechanics()},params:{boosts:{atk:-1}}});assert.equal(result.battle.sides.A.roster[0].stages.atk,0);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);
});

test('Moody deterministically raises one combat stat by two and lowers a different one by one',()=>{
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('moody');const result=resolveEndTurnAbilityStageBoosts(battle),values=result.battle.sides.A.roster[0].stages,raised=Object.entries(values).filter(([k,v])=>['atk','def','spa','spd','spe'].includes(k)&&v===2),lowered=Object.entries(values).filter(([k,v])=>['atk','def','spa','spd','spe'].includes(k)&&v===-1);assert.equal(raised.length,1);assert.equal(lowered.length,1);assert.notEqual(raised[0][0],lowered[0][0]);assert.equal(values.accuracy,0);assert.equal(values.evasion,0);
});

test('Oblivious behaviorally blocks Taunt and Intimidate through existing generic immunity contracts',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('oblivious');let result=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'taunt',volatile:'taunt'});assert.equal(result.battle.sides.B.roster[0].volatiles.taunt,undefined);assert.ok(result.events.some(e=>e.kind==='volatileFailed'&&e.reason==='abilityBlocked'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('intimidate');battle.sides.B.roster[0].passiveEffects=effects('oblivious');result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',actorId:'a1'}]);assert.equal(result.battle.sides.B.roster[0].stages.atk,0);assert.ok(result.events.some(e=>e.kind==='statStageBlocked'&&e.sourceAbilityId==='oblivious'));
});

test('Overcoat blocks powder-tagged moves and ignores Rage Powder redirection',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].passiveEffects=effects('overcoat');battle.sides.B.roster[1].volatiles.redirection={id:'redirection',kind:'rage-powder',active:true,order:1};const blocked=resolveTargetAbilityBlock(battle,{actorId:'b1',targetId:'a1',move:move('spore','grass','status',0),mechanics:mechanics({tags:['powder']})});assert.equal(blocked.blocked,true);const redirect=selectRedirection(battle,{side:'A',actorId:'a1',targetMode:'adjacentFoe',selected:{side:'B',slot:0,actorId:'b1'}});assert.equal(redirect,null);
});

test('Pressure stacks PP cost across opposing targeted holders',()=>{
 const battle=fixture('double');for(const foe of battle.sides.B.roster.slice(0,2))foe.passiveEffects=effects('pressure');const payload={action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:move('hit'),mechanics:mechanics({targetMode:'allAdjacentFoes',redirectable:false})};const result=spendPpHandler.run({battle,payload});assert.equal(result.battle.sides.A.roster[0].pp.hit,13);assert.equal(result.events.filter(e=>e.kind==='abilityTriggered'&&e.abilityId==='pressure').length,2);
});

test('Protean changes to the move type once per switch and restores original typing on switch-out',()=>{
 let battle=fixture();battle.sides.A.roster[0].types=['water','dark'];battle.sides.A.roster[0].passiveEffects=effects('protean');let first=resolveBeforeMoveAbilityState(battle,{actorId:'a1',move:move('shock','electric','special')});assert.deepEqual(first.battle.sides.A.roster[0].types,['electric']);let second=resolveBeforeMoveAbilityState(first.battle,{actorId:'a1',move:move('hit','normal')});assert.deepEqual(second.battle.sides.A.roster[0].types,['electric']);const out=resolveSwitchOutAbilities(second.battle,{actorId:'a1'});assert.deepEqual(out.battle.sides.A.roster[0].types,['water','dark']);assert.equal(out.battle.sides.A.roster[0].abilityState['type-change:protean'],undefined);
});

test('Stalwart disables move redirection through shared mechanics metadata',()=>{
 const actor=unit('a1',{passiveEffects:effects('stalwart')}),modified=modifyMoveByAbility(actor,move(),mechanics({redirectable:true}));assert.equal(modified.mechanics.redirectable,false);assert.ok(modified.applied.some(e=>e.kind==='redirection-bypass'));
});

test('Supreme Overlord snapshots fainted allies on entry and scales move power up to its cap',()=>{
 const battle=fixture();battle.sides.A.roster.push(unit('a3',{hp:0}),unit('a4',{hp:0}),unit('a5',{hp:0}));battle.sides.A.roster[0].passiveEffects=effects('supreme-overlord');const entered=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',actorId:'a1'}]),actor=entered.battle.sides.A.roster[0];assert.equal(actor.abilityState['fainted-allies:supreme-overlord'].count,3);assert.equal(abilityPowerModifiers(actor,move(),mechanics(),{battle:entered.battle,runtime:{}}).apply(100),130);
});
