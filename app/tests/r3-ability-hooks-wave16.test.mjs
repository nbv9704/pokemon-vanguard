import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 HANDLER_DEFINITIONS,
 applyDamageHit,
 applyMajorStatus,
 applyMechanicsSwitch,
 applySubstitute,
 compilePassiveEffects,
 createHeldItemState,
 createHookRegistry,
 createMoveActionHandler,
 modifyMoveByAbility,
 opponentAbilitiesIgnoredFor,
 resolveFieldTypeAbilities,
 resolvePreMoveFormAbilities,
 sideConditionDamageModifiers,
 validateMechanicManifest
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promotedAbilities=['mold-breaker','magic-bounce','infiltrator','forecast','mimicry','disguise','stance-change'];
const promotedMoves=['substitute','safeguard'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const points=()=>({hp:32,atk:32,def:2,spa:0,spd:0,spe:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,speciesId:'fixture',baseSpeciesId:'fixture',name:actorId,types:['normal'],hp:240,maxHp:240,stats:{hp:240,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16,'will-o-wisp':24,'stealth-rock':32,'string-shot':40,substitute:12,safeguard:20,'kings-shield':12},maxPp:{hit:16,'will-o-wisp':24,'stealth-rock':32,'string-shot':40,substitute:12,safeguard:20,'kings-shield':12},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),buildSnapshot:{abilityId:null,itemId:null,moveIds:['hit'],natureId:'serious',statPoints:points()},...overrides});
function setAbility(mon,id,itemId=null){mon.activeAbilityId=id;mon.buildSnapshot.abilityId=id;mon.buildSnapshot.itemId=itemId;mon.passiveEffects=effects(id,itemId);mon.itemState=createHeldItemState(itemId);return mon;}
function fixture(format='single'){const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`ability-wave16-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};}
const move=(id='hit',type='normal',category='physical',power=80,accuracy=100)=>({id,name:id,type,category,power,accuracy,maxPP:16,contact:category==='physical'});
const mechanics=(overrides={})=>({targetMode:'adjacentFoe',redirectable:true,priority:0,contact:true,tags:[],handlers:[],...overrides});
const runtime={nextRandom:()=>0.99};

for(const format of ['single','double'])test(`r3-ability-hooks-wave16:${format} validates mega-patch manifests`,()=>{
 for(const id of promotedAbilities)assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);
 for(const id of promotedMoves)assert.deepEqual(validateMechanicManifest(manifests.moves[id],'moves'),[],id);
});

test('Substitute costs one quarter max HP and absorbs direct damage before the user',()=>{let battle=fixture();const created=applySubstitute(battle,{actorId:'b1',moveId:'substitute'});battle=created.battle;assert.equal(battle.sides.B.roster[0].hp,180);assert.equal(battle.sides.B.roster[0].volatiles.substitute.hp,60);const result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('hit','normal','physical',80),mechanics:mechanics()},runtime);assert.equal(result.substituteAbsorbed,true);assert.equal(result.battle.sides.B.roster[0].hp,180);assert.ok(result.events.some(e=>e.kind==='substituteDamaged'));});

test('sound-tagged moves bypass Substitute while ordinary status moves are blocked by it',()=>{let battle=fixture();battle=applySubstitute(battle,{actorId:'b1',moveId:'substitute'}).battle;const sound=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('sound-hit','normal','special',80),mechanics:mechanics({contact:false,tags:['sound']})},runtime);assert.ok(sound.amount>0);assert.ok(sound.battle.sides.B.roster[0].hp<180);});

test('Infiltrator bypasses Substitute, Reflect, Light Screen and Safeguard through one shared primitive',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'infiltrator');battle=applySubstitute(battle,{actorId:'b1',moveId:'substitute'}).battle;battle.sides.B.conditions.reflect={id:'reflect',remaining:5};battle.sides.B.conditions.safeguard={id:'safeguard',remaining:5};const actor=battle.sides.A.roster[0];const direct=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('hit','normal','physical',80),mechanics:mechanics()},runtime);assert.equal(direct.substituteAbsorbed,undefined);assert.ok(direct.battle.sides.B.roster[0].hp<180);assert.equal(sideConditionDamageModifiers(battle,battle.sides.B.roster[0],move(),false,actor).values.length,0);const status=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'toxic',status:'poison'},runtime);assert.equal(status.battle.sides.B.roster[0].status?.id,'poison');});

test('Safeguard blocks opposing major status without Infiltrator but not self status',()=>{let battle=fixture();battle.sides.B.conditions.safeguard={id:'safeguard',remaining:5};let result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'toxic',status:'poison'},runtime);assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.events[0].reason,'safeguard');result=applyMajorStatus(battle,{actorId:'b1',targetId:'b1',moveId:'self-status',status:'poison'},runtime);assert.equal(result.battle.sides.B.roster[0].status?.id,'poison');});

test('Magic Bounce reflects a targeted non-attacking status move without charging reflector PP',()=>{const battle=fixture();setAbility(battle.sides.B.roster[0],'magic-bounce');const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMove=move('will-o-wisp','fire','status',null,85),resolve=createMoveActionHandler({moves:{'will-o-wisp':catalogMove},manifests:{'will-o-wisp':manifests.moves['will-o-wisp']},abilityManifests:manifests,registry});const beforeA=battle.sides.A.roster[0].pp['will-o-wisp'],beforeB=battle.sides.B.roster[0].pp['will-o-wisp'];const result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'will-o-wisp',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].status?.id,'burn');assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.battle.sides.A.roster[0].pp['will-o-wisp'],beforeA-1);assert.equal(result.battle.sides.B.roster[0].pp['will-o-wisp'],beforeB);assert.ok(result.events.some(e=>e.kind==='moveReflected'&&e.abilityId==='magic-bounce'));});

test('Substitute blocks an opposing status move through the full resolver while Infiltrator bypasses it',()=>{
 let battle=fixture();
 battle=applySubstitute(battle,{actorId:'b1',moveId:'substitute'}).battle;
 const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMove=move('will-o-wisp','fire','status',null,85),resolve=createMoveActionHandler({moves:{'will-o-wisp':catalogMove},manifests:{'will-o-wisp':manifests.moves['will-o-wisp']},abilityManifests:manifests,registry});
 let result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'will-o-wisp',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0});
 assert.equal(result.battle.sides.B.roster[0].status,null);
 assert.ok(result.events.some(e=>e.reason==='substitute'));
 battle=fixture();setAbility(battle.sides.A.roster[0],'infiltrator');battle=applySubstitute(battle,{actorId:'b1',moveId:'substitute'}).battle;
 result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'will-o-wisp',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0});
 assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');
});

test('Mold Breaker suppresses Magic Bounce so the original target receives the status move',()=>{
 const battle=fixture();setAbility(battle.sides.A.roster[0],'mold-breaker');setAbility(battle.sides.B.roster[0],'magic-bounce');
 const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMove=move('will-o-wisp','fire','status',null,85),resolve=createMoveActionHandler({moves:{'will-o-wisp':catalogMove},manifests:{'will-o-wisp':manifests.moves['will-o-wisp']},abilityManifests:manifests,registry});
 const result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'will-o-wisp',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0});
 assert.equal(result.battle.sides.A.roster[0].status,null);
 assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');
 assert.equal(result.events.some(e=>e.kind==='moveReflected'),false);
});

test('Magic Bounce reflects foe-side hazards back to the original side exactly once',()=>{const battle=fixture();setAbility(battle.sides.B.roster[0],'magic-bounce');const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMove=move('stealth-rock','rock','status',null,null),resolve=createMoveActionHandler({moves:{'stealth-rock':catalogMove},manifests:{'stealth-rock':manifests.moves['stealth-rock']},abilityManifests:manifests,registry});const result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'stealth-rock',priority:0,speed:100},runtime);assert.ok(result.battle.sides.A.conditions['stealth-rock']);assert.equal(result.battle.sides.B.conditions['stealth-rock'],undefined);assert.equal(result.events.filter(e=>e.kind==='moveReflected').length,1);});


test('Magic Bounce reflects each spread-status target independently while non-bouncers are still affected',()=>{
 const battle=fixture('double');setAbility(battle.sides.B.roster[0],'magic-bounce');
 const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMove=move('string-shot','bug','status',null,95),resolve=createMoveActionHandler({moves:{'string-shot':catalogMove},manifests:{'string-shot':manifests.moves['string-shot']},abilityManifests:manifests,registry});
 const result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'string-shot',priority:0,speed:100},{nextRandom:()=>0});
 assert.equal(result.battle.sides.A.roster[0].stages.spe,-2);
 assert.equal(result.battle.sides.B.roster[0].stages.spe,0);
 assert.equal(result.battle.sides.B.roster[1].stages.spe,-2);
 assert.equal(result.events.filter(e=>e.kind==='moveReflected'&&e.abilityId==='magic-bounce').length,1);
});

test('a spread status move reflected by Magic Bounce performs its own accuracy check',()=>{
 const battle=fixture('double');setAbility(battle.sides.B.roster[0],'magic-bounce');
 const rolls=[0,0.99,0];const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMove=move('string-shot','bug','status',null,95),resolve=createMoveActionHandler({moves:{'string-shot':catalogMove},manifests:{'string-shot':manifests.moves['string-shot']},abilityManifests:manifests,registry});
 const result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'string-shot',priority:0,speed:100},{nextRandom:()=>rolls.shift()??0});
 assert.equal(result.battle.sides.A.roster[0].stages.spe,0);
 assert.equal(result.battle.sides.B.roster[0].stages.spe,0);
 assert.equal(result.battle.sides.B.roster[1].stages.spe,-2);
 assert.ok(result.events.some(e=>e.kind==='moveMissed'&&e.reflected===true&&e.actorId==='b1'&&e.targetId==='a1'));
});

test('Mold Breaker bypasses Levitate and target defensive Ability modifiers while preserving item semantics',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'mold-breaker');setAbility(battle.sides.B.roster[0],'levitate');let modified=modifyMoveByAbility(battle.sides.A.roster[0],move('ground-hit','ground','physical',80),mechanics()).mechanics;let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('ground-hit','ground','physical',80),mechanics:modified},runtime);assert.ok(result.amount>0);battle=fixture();setAbility(battle.sides.A.roster[0],'mold-breaker');setAbility(battle.sides.B.roster[0],'multiscale');modified=modifyMoveByAbility(battle.sides.A.roster[0],move('hit'),mechanics()).mechanics;const bypassed=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('hit'),mechanics:modified},runtime);battle=fixture();setAbility(battle.sides.B.roster[0],'multiscale');const reduced=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('hit'),mechanics:mechanics()},runtime);assert.ok(bypassed.amount>reduced.amount);});

test('Mold Breaker bypasses target status immunity and Sturdy',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'mold-breaker');setAbility(battle.sides.B.roster[0],'limber');const mod=modifyMoveByAbility(battle.sides.A.roster[0],move('thunder-wave','electric','status',null),mechanics()).mechanics;const status=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'thunder-wave',status:'paralysis',ignoreTargetAbility:opponentAbilitiesIgnoredFor(battle,'a1','b1',mod)},runtime);assert.equal(status.battle.sides.B.roster[0].status?.id,'paralysis');battle=fixture();setAbility(battle.sides.A.roster[0],'mold-breaker');setAbility(battle.sides.B.roster[0],'sturdy');battle.sides.B.roster[0].hp=1;battle.sides.B.roster[0].maxHp=1;battle.sides.B.roster[0].stats.hp=1;const heavy=move('heavy','fighting','physical',250),m=modifyMoveByAbility(battle.sides.A.roster[0],heavy,mechanics()).mechanics;const result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:heavy,mechanics:m},runtime);assert.equal(result.battle.sides.B.roster[0].hp,0);});

test('Forecast changes Castform identity and type with effective weather and restores Normal form when suppressed or gone',()=>{let battle=fixture('double');const castform=battle.sides.A.roster[0];castform.speciesId='castform';castform.baseSpeciesId='castform';castform.name='Castform';castform.spriteKey='castform';castform.types=['normal'];setAbility(castform,'forecast');battle.field.weather={id:'sun',remaining:5};let result=resolveFieldTypeAbilities(battle,{trigger:'test'}),changed=result.battle.sides.A.roster[0];assert.equal(changed.speciesId,'castform-sunny');assert.equal(changed.spriteKey,'castform-sunny');assert.deepEqual(changed.types,['fire']);battle=result.battle;setAbility(battle.sides.A.roster[1],'cloud-nine');result=resolveFieldTypeAbilities(battle,{trigger:'suppressed'});changed=result.battle.sides.A.roster[0];assert.equal(changed.speciesId,'castform');assert.deepEqual(changed.types,['normal']);delete result.battle.sides.A.roster[1].passiveEffects;delete result.battle.field.weather;result=resolveFieldTypeAbilities(result.battle,{trigger:'clear'});assert.equal(result.battle.sides.A.roster[0].speciesId,'castform');assert.deepEqual(result.battle.sides.A.roster[0].types,['normal']);});

test('Mimicry changes type with terrain and restores its captured base typing when terrain ends',()=>{let battle=fixture();setAbility(battle.sides.A.roster[0],'mimicry');battle.sides.A.roster[0].types=['ground','steel'];battle.field.terrain={id:'grassy',remaining:5};let result=resolveFieldTypeAbilities(battle,{trigger:'terrain'});assert.deepEqual(result.battle.sides.A.roster[0].types,['grass']);delete result.battle.field.terrain;result=resolveFieldTypeAbilities(result.battle,{trigger:'clear'});assert.deepEqual(result.battle.sides.A.roster[0].types,['ground','steel']);});

test('Disguise blocks only the first damaging hit, changes Mimikyu to Busted form, deals its break cost, and stays broken',()=>{let battle=fixture();const mimikyu=battle.sides.B.roster[0];mimikyu.speciesId='mimikyu';mimikyu.baseSpeciesId='mimikyu';mimikyu.name='Mimikyu';mimikyu.spriteKey='mimikyu';mimikyu.types=['ghost','fairy'];setAbility(mimikyu,'disguise');const hitMove=move('hit','steel','physical',80);let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:hitMove,mechanics:mechanics()},runtime);assert.equal(result.amount,0);assert.equal(result.disguiseShielded,true);assert.equal(result.battle.sides.B.roster[0].hp,210);assert.equal(result.battle.sides.B.roster[0].speciesId,'mimikyu-busted');assert.equal(result.battle.sides.B.roster[0].spriteKey,'mimikyu-busted');assert.ok(result.events.some(e=>e.kind==='disguiseBroken'));result=applyDamageHit(result.battle,{actorId:'a1',targetId:'b1',move:hitMove,mechanics:mechanics()},runtime);assert.ok(result.amount>0);assert.ok(result.battle.sides.B.roster[0].hp<210);});

test('Mold Breaker bypasses an intact Disguise without consuming its one-time shield',()=>{const battle=fixture();setAbility(battle.sides.A.roster[0],'mold-breaker');setAbility(battle.sides.B.roster[0],'disguise');const hitMove=move('hit','normal','physical',80),modified=modifyMoveByAbility(battle.sides.A.roster[0],hitMove,mechanics()).mechanics,result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:hitMove,mechanics:modified},runtime);assert.ok(result.amount>0);assert.equal(result.battle.sides.B.roster[0].abilityState['disguise:disguise'],undefined);});

test('a transformed user that copied Disguise does not receive the Disguise shield',()=>{const battle=fixture();const target=battle.sides.B.roster[0];target.speciesId='mimikyu';target.types=['ghost','fairy'];target.transformState={original:{speciesId:'ditto'}};setAbility(target,'disguise');const result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('hit','steel','physical',80),mechanics:mechanics()},runtime);assert.ok(result.amount>0);assert.equal(result.disguiseShielded,undefined);assert.equal(result.battle.sides.B.roster[0].abilityState['disguise:disguise'],undefined);});


test('a broken Disguise stays broken after switching out and back in',()=>{
 let battle=fixture();const mimikyu=battle.sides.B.roster[0];mimikyu.speciesId='mimikyu';mimikyu.baseSpeciesId='mimikyu';mimikyu.name='Mimikyu';mimikyu.spriteKey='mimikyu';mimikyu.types=['ghost','fairy'];setAbility(mimikyu,'disguise');const hitMove=move('hit','steel','physical',80);
 let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:hitMove,mechanics:mechanics()},runtime);assert.equal(result.disguiseShielded,true);battle=result.battle;
 let switched=applyMechanicsSwitch(battle,'B','b1','b2',{manifests});assert.equal(switched.ok,true);switched=applyMechanicsSwitch(switched.battle,'B','b2','b1',{manifests});assert.equal(switched.ok,true);
 result=applyDamageHit(switched.battle,{actorId:'a1',targetId:'b1',move:hitMove,mechanics:mechanics()},runtime);assert.ok(result.amount>0);assert.equal(result.disguiseShielded,undefined);
});

test('Stance Change swaps Aegislash stats before attacks and returns to Shield Forme for King’s Shield',()=>{let battle=fixture();const mon=battle.sides.A.roster[0];setAbility(mon,'stance-change');mon.speciesId='aegislash-shield';mon.baseSpeciesId='aegislash';mon.name='Aegislash (Shield)';mon.types=['steel','ghost'];mon.stats={hp:167,atk:102,def:162,spa:70,spd:160,spe:80};mon.maxHp=167;mon.hp=130;let result=resolvePreMoveFormAbilities(battle,{actorId:'a1',move:move('shadow-claw','ghost','physical',70)});let changed=result.battle.sides.A.roster[0];assert.equal(changed.speciesId,'aegislash-blade');assert.ok(changed.stats.atk>changed.stats.def);assert.equal(changed.maxHp-changed.hp,37);result=resolvePreMoveFormAbilities(result.battle,{actorId:'a1',move:move('kings-shield','steel','status',null,null)});changed=result.battle.sides.A.roster[0];assert.equal(changed.speciesId,'aegislash-shield');assert.ok(changed.stats.def>changed.stats.atk);assert.equal(changed.maxHp-changed.hp,37);});

test('Stance Change ignores called moves and transformed copies of Aegislash',()=>{let battle=fixture();const mon=battle.sides.A.roster[0];setAbility(mon,'stance-change');mon.speciesId='aegislash-shield';mon.baseSpeciesId='aegislash';mon.name='Aegislash (Shield)';mon.types=['steel','ghost'];let result=resolvePreMoveFormAbilities(battle,{actorId:'a1',move:move('shadow-claw','ghost','physical',70),calledBy:'sleep-talk'});assert.equal(result.battle.sides.A.roster[0].speciesId,'aegislash-shield');battle.sides.A.roster[0].transformState={original:{speciesId:'ditto'}};result=resolvePreMoveFormAbilities(battle,{actorId:'a1',move:move('shadow-claw','ghost','physical',70)});assert.equal(result.battle.sides.A.roster[0].speciesId,'aegislash-shield');});


test('Stance Change returns Aegislash to Shield Forme on switch-out while preserving damage taken',()=>{
 let battle=fixture();const mon=battle.sides.A.roster[0];setAbility(mon,'stance-change');mon.speciesId='aegislash-shield';mon.baseSpeciesId='aegislash';mon.name='Aegislash (Shield)';mon.types=['steel','ghost'];mon.stats={hp:167,atk:102,def:162,spa:70,spd:160,spe:80};mon.maxHp=167;mon.hp=130;
 battle=resolvePreMoveFormAbilities(battle,{actorId:'a1',move:move('shadow-claw','ghost','physical',70)}).battle;assert.equal(battle.sides.A.roster[0].speciesId,'aegislash-blade');
 const switched=applyMechanicsSwitch(battle,'A','a1','a2',{manifests});assert.equal(switched.ok,true);const benched=switched.battle.sides.A.roster[0];assert.equal(benched.speciesId,'aegislash-shield');assert.equal(benched.maxHp-benched.hp,37);
});
