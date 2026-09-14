import test from 'node:test';
import assert from 'node:assert/strict';
import {activateHeldItem,applyDamageHit,applyMajorStatus,applyVolatileStatus,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,resolveMechanicsEndTurn,speedWithHeldItems} from '../mechanics-v3/index.mjs';
import {applySwitch} from '../rules-v3/lifecycle.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BattleUnit,mechanicCatalog} from '../server/v3-battle-factory.mjs';
import {projectV3BattleForAi,v3BattleSnapshot} from '../server/v3-battle-view.mjs';

const build=(speciesId,itemId,moveIds=null)=>{const species=v3Catalog.speciesById[speciesId],base=species.defaultBuild;return {buildId:`build-${speciesId}-${itemId}`,monId:`mon-${speciesId}`,name:`${species.name} Item Test`,natureId:base.natureId,statPoints:structuredClone(base.statPoints),moveIds:moveIds||[...base.moveIds],abilityId:base.abilityId,itemId};};
const mon=speciesId=>({monId:`mon-${speciesId}`,speciesId});
const makeUnit=(side,index,speciesId,itemId)=>createV3BattleUnit(side,index,build(speciesId,itemId),mon(speciesId),v3Catalog);
function fixture(format='single',itemId='focus-sash'){
 const count=format==='double'?2:1,a=[makeUnit('A',0,'infernape','none'),makeUnit('A',1,'blastoise','none')],b=[makeUnit('B',0,'primarina',itemId),makeUnit('B',1,'venusaur','none')];
 return {id:`item-runtime-${format}`,rulesVersion:v3Catalog.metadata.rulesVersion,catalogVersion:v3Catalog.metadata.catalogVersion,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:29,field:{},sides:{A:{active:a.slice(0,count).map(unit=>unit.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(unit=>unit.actorId),roster:b,conditions:{}}}};
}
const runtime={nextRandom:()=>.999};
const mechanics=mechanicCatalog(v3Catalog);
const resolveMove=createMoveActionHandler({moves:v3Catalog.movesById,manifests:mechanics.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});

for(const format of ['single','double'])test(`schema-3 ${format} factory persists held-item state and Focus Sash survival`,()=>{
 const battle=fixture(format,'focus-sash'),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];
 assert.equal(target.itemState.heldItemId,'focus-sash');assert.equal(target.itemState.revealed,false);assert.equal(target.passiveEffects.find(effect=>effect.kind==='item-survive-lethal-hit')?.sourceId,'focus-sash');
 actor.stats.atk=999;const move={...v3Catalog.movesById['giga-impact'],power:250,type:'normal'},result=applyDamageHit(battle,{actorId:actor.actorId,targetId:target.actorId,move},runtime),after=result.battle.sides.B.roster[0];
 assert.equal(after.hp,1);assert.equal(after.itemState.consumed,true);assert.equal(after.itemState.revealed,true);assert.ok(result.events.some(event=>event.kind==='itemConsumed'&&event.itemId==='focus-sash'));
 const restarted=JSON.parse(JSON.stringify(result.battle));assert.equal(restarted.sides.B.roster[0].itemState.consumed,true);assert.equal(restarted.sides.B.roster[0].itemState.activationCount,1);
});

test('schema-3 Sitrus Berry state survives JSON restart and cannot activate twice',()=>{
 const battle=fixture('single','sitrus-berry'),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];actor.stats.atk=80;target.hp=Math.floor(target.maxHp/2)+8;
 const move={...v3Catalog.movesById['body-slam'],power:40,type:'normal'},first=applyDamageHit(battle,{actorId:actor.actorId,targetId:target.actorId,move},runtime),consumed=first.battle.sides.B.roster[0];
 assert.equal(consumed.itemState.consumed,true);assert.equal(consumed.itemState.activationCount,1);assert.ok(first.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
 const restarted=JSON.parse(JSON.stringify(first.battle));restarted.sides.B.roster[0].hp=Math.floor(restarted.sides.B.roster[0].maxHp/2);const second=applyDamageHit(restarted,{actorId:actor.actorId,targetId:target.actorId,move},runtime);
 assert.equal(second.battle.sides.B.roster[0].itemState.activationCount,1);assert.ok(!second.events.some(event=>event.kind==='itemActivated'&&event.itemId==='sitrus-berry'));
});

test('schema-3 Leftovers runs through shared end-turn lifecycle and remains owned',()=>{
 const battle=fixture('single','leftovers'),target=battle.sides.B.roster[0];battle.phase='END_TURN';target.hp=target.maxHp-32;const before=target.hp,result=resolveMechanicsEndTurn(battle),after=result.battle.sides.B.roster[0];
 assert.equal(after.hp,before+Math.max(1,Math.floor(target.maxHp/16)));assert.equal(after.itemState.consumed,false);assert.equal(after.itemState.revealed,true);assert.ok(result.events.some(event=>event.kind==='itemActivated'&&event.itemId==='leftovers'));
});

test('opponent and AI views hide held items until the authoritative reveal event',()=>{
 let battle=fixture('single','focus-sash');let snapshot=v3BattleSnapshot(battle);assert.equal(snapshot.opponent[0].revealedItemId,undefined);
 const revealed=activateHeldItem(battle,{actorId:'B-0',itemId:'focus-sash',reason:'view-test',activationKey:'view-1'});battle=revealed.battle;snapshot=v3BattleSnapshot(battle);assert.equal(snapshot.opponent[0].revealedItemId,'focus-sash');assert.equal(snapshot.opponent[0].itemConsumed,false);
 const playerItem=makeUnit('A',0,'blastoise','sitrus-berry');battle={...fixture('single','none'),sides:{A:{active:['A-0'],roster:[playerItem],conditions:{}},B:fixture('single','none').sides.B}};
 let ai=projectV3BattleForAi(battle);assert.equal(ai.sides.A.roster[0].buildSnapshot.itemId,null);assert.equal(ai.sides.A.roster[0].itemState,null);
 const playerReveal=activateHeldItem(battle,{actorId:'A-0',itemId:'sitrus-berry',reason:'view-test',activationKey:'view-2'});ai=projectV3BattleForAi(playerReveal.battle);assert.equal(ai.sides.A.roster[0].buildSnapshot.itemId,'sitrus-berry');assert.equal(ai.sides.A.roster[0].itemState.revealed,true);
});


for(const format of ['single','double'])test(`schema-3 ${format} status-cure berry compiles and consumes through authoritative status application`,()=>{
 let battle=fixture(format,'cheri-berry'),target=battle.sides.B.roster[0];assert.equal(target.passiveEffects.find(effect=>effect.kind==='item-status-cure')?.sourceId,'cheri-berry');
 let result=applyMajorStatus(battle,{actorId:'A-0',targetId:'B-0',moveId:'thunder-wave-fixture',status:'paralysis'},runtime);target=result.battle.sides.B.roster[0];assert.equal(target.status,null);assert.equal(target.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='statusCured'&&event.itemId==='cheri-berry'));
 battle=fixture(format,'persim-berry');result=applyVolatileStatus(battle,{actorId:'A-0',targetId:'B-0',moveId:'confuse-ray-fixture',volatile:'confusion'},runtime);target=result.battle.sides.B.roster[0];assert.equal(target.volatiles.confusion,undefined);assert.equal(target.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.itemId==='persim-berry'));
});

for(const format of ['single','double'])test(`schema-3 ${format} White Herb compiles and consumes through an actual Charm stat drop`,()=>{
 const battle=fixture(format,'white-herb'),actor=makeUnit('A',0,'meganium','none');battle.sides.A.roster[0]=actor;battle.sides.A.active[0]=actor.actorId;const target=battle.sides.B.roster[0];target.stages.spa=1;assert.equal(target.passiveEffects.find(effect=>effect.kind==='item-negative-stage-reset')?.sourceId,'white-herb');
 const action={kind:'move',side:'A',actorId:'A-0',moveId:'charm',speed:actor.stats.spe,priority:0,target:{side:'B',slot:0}},result=resolveMove(battle,action,runtime),after=result.battle.sides.B.roster[0];
 assert.equal(after.stages.atk,0);assert.equal(after.stages.spa,1);assert.equal(after.itemState.consumed,true);assert.equal(after.itemState.activationCount,1);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.moveId==='charm'&&event.after<0));assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.itemId==='white-herb'&&event.after===0));
 const restarted=JSON.parse(JSON.stringify(result.battle));assert.equal(restarted.sides.B.roster[0].itemState.consumed,true);assert.equal(restarted.sides.B.roster[0].itemState.activationCount,1);
});

test('schema-3 Lum Berry clears simultaneous major status and confusion with one persisted receipt',()=>{
 const battle=fixture('single','lum-berry'),target=battle.sides.B.roster[0];target.volatiles.confusion={id:'confusion',timer:3};const result=applyMajorStatus(battle,{actorId:'A-0',targetId:'B-0',moveId:'will-o-wisp',status:'burn'},runtime),after=result.battle.sides.B.roster[0];
 assert.equal(after.status,null);assert.equal(after.volatiles.confusion,undefined);assert.equal(after.itemState.activationCount,1);assert.equal(after.itemState.consumed,true);const restarted=JSON.parse(JSON.stringify(result.battle));assert.equal(restarted.sides.B.roster[0].itemState.activationCount,1);assert.equal(restarted.sides.B.roster[0].itemState.consumed,true);
});


function postDamageFixture(format,{actorItem='none',actorAbility='torrent',actorMoves=['waterfall','rock-slide','bulldoze','ice-fang'],targetItem='none'}={}){
 const count=format==='double'?2:1,species=v3Catalog.speciesById.feraligatr,base=species.defaultBuild,customBuild={buildId:'post-damage-feraligatr',monId:'mon-feraligatr',name:'Feraligatr Post Damage',natureId:base.natureId,statPoints:structuredClone(base.statPoints),moveIds:[...actorMoves],abilityId:actorAbility,itemId:actorItem},actor=createV3BattleUnit('A',0,customBuild,mon('feraligatr'),v3Catalog),ally=makeUnit('A',1,'blastoise','none'),reserve=makeUnit('A',2,'venusaur','none'),target=makeUnit('B',0,'infernape',targetItem),targetAlly=makeUnit('B',1,'typhlosion','none');
 return {id:`post-damage-${format}`,rulesVersion:v3Catalog.metadata.rulesVersion,catalogVersion:v3Catalog.metadata.catalogVersion,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:41,field:{},sides:{A:{active:[actor,ally].slice(0,count).map(unit=>unit.actorId),roster:[actor,ally,reserve],conditions:{}},B:{active:[target,targetAlly].slice(0,count).map(unit=>unit.actorId),roster:[target,targetAlly],conditions:{}}}};
}

for(const format of ['single','double'])test(`schema-3 ${format} Life Orb compiles and auto-resolves recoil after an ordinary damaging move`,()=>{
 const battle=postDamageFixture(format,{actorItem:'life-orb',actorAbility:'torrent'}),actor=battle.sides.A.roster[0],before=actor.hp,action={kind:'move',side:'A',actorId:'A-0',moveId:'waterfall',speed:100,priority:0,target:{side:'B',slot:0}},result=resolveMove(battle,action,runtime),after=result.battle.sides.A.roster[0];
 assert.ok(actor.passiveEffects.some(effect=>effect.kind==='held-damage-boost'&&effect.sourceId==='life-orb'));
 assert.ok(actor.passiveEffects.some(effect=>effect.kind==='item-post-move-recoil'&&effect.sourceId==='life-orb'));
 assert.equal(before-after.hp,Math.max(1,Math.floor(actor.maxHp/10)));assert.equal(after.itemState.revealed,true);assert.ok(result.events.some(event=>event.kind==='itemActivated'&&event.itemId==='life-orb'));assert.ok(result.events.some(event=>event.kind==='damage'&&event.itemId==='life-orb'&&event.reason==='post-move-recoil'));
});

test('schema-3 Sheer Force keeps the Life Orb damage boost but suppresses its post-move recoil',()=>{
 const battle=postDamageFixture('single',{actorItem:'life-orb',actorAbility:'sheer-force'}),actor=battle.sides.A.roster[0],before=actor.hp,action={kind:'move',side:'A',actorId:'A-0',moveId:'waterfall',speed:100,priority:0,target:{side:'B',slot:0}},result=resolveMove(battle,action,{nextRandom:()=>.5}),damage=result.events.find(event=>event.kind==='damage'&&event.moveId==='waterfall'),after=result.battle.sides.A.roster[0];
 assert.ok(damage.breakdown.passiveModifiers.some(effect=>effect.sourceId==='life-orb'));assert.ok(damage.breakdown.abilityPowerModifiers.some(effect=>effect.sourceId==='sheer-force'));assert.equal(after.hp,before);assert.equal(after.itemState.revealed,false);assert.ok(!result.events.some(event=>event.itemId==='life-orb'));
});

test('schema-3 Rocky Helmet retaliates on contact through the shared damage pipeline',()=>{
 const battle=postDamageFixture('single',{actorItem:'none',actorAbility:'torrent',targetItem:'rocky-helmet'}),actor=battle.sides.A.roster[0],before=actor.hp,action={kind:'move',side:'A',actorId:'A-0',moveId:'waterfall',speed:100,priority:0,target:{side:'B',slot:0}},result=resolveMove(battle,action,runtime),after=result.battle.sides.A.roster[0],holder=result.battle.sides.B.roster[0];
 assert.equal(before-after.hp,Math.max(1,Math.floor(actor.maxHp/6)));assert.equal(holder.itemState.revealed,true);assert.equal(holder.itemState.consumed,false);assert.ok(result.events.some(event=>event.kind==='damage'&&event.itemId==='rocky-helmet'&&event.reason==='contact-retaliation'));
});

test('schema-3 Double Shell Bell heals once from aggregate Rock Slide damage',()=>{
 const battle=postDamageFixture('double',{actorItem:'shell-bell',actorAbility:'torrent'}),actor=battle.sides.A.roster[0];actor.hp=actor.maxHp-80;const before=actor.hp,action={kind:'move',side:'A',actorId:'A-0',moveId:'rock-slide',speed:100,priority:0,target:{side:'B',slot:0}},result=resolveMove(battle,action,{nextRandom:()=>.5}),damages=result.events.filter(event=>event.kind==='damage'&&event.actorId==='A-0'&&event.moveId==='rock-slide'),total=damages.reduce((sum,event)=>sum+event.amount,0),heal=Math.max(1,Math.floor(total/8)),after=result.battle.sides.A.roster[0];
 assert.equal(damages.length,2);assert.equal(after.hp,Math.min(actor.maxHp,before+heal));assert.equal(after.itemState.activationCount,1);assert.equal(after.itemState.revealed,true);assert.equal(result.events.filter(event=>event.kind==='heal'&&event.itemId==='shell-bell').length,1);
});

for(const format of ['single','double'])test(`schema-3 ${format} Choice Scarf compiles, locks the executed move, and stays hidden`,()=>{
 let battle=postDamageFixture(format,{actorItem:'choice-scarf',actorAbility:'torrent'}),actor=battle.sides.A.roster[0];actor.stats.spe=101;assert.equal(speedWithHeldItems(actor.stats.spe,actor,battle),151);assert.equal(actor.itemState.revealed,false);
 const action={kind:'move',side:'A',actorId:'A-0',moveId:'waterfall',speed:151,priority:0,target:{side:'B',slot:0}},result=resolveMove(battle,action,runtime),after=result.battle.sides.A.roster[0];assert.equal(after.volatiles['choice-lock'].moveId,'waterfall');assert.equal(after.itemState.revealed,false);assert.ok(!result.events.some(event=>event.kind.startsWith('item')));
 const validate=createMoveChoiceValidator({moves:v3Catalog.movesById,manifests:mechanics.moves});assert.deepEqual(validate(result.battle,{kind:'move',side:'A',actorId:'A-0',moveId:'waterfall'}),{ok:true});const blocked=validate(result.battle,{kind:'move',side:'A',actorId:'A-0',moveId:'bulldoze'});assert.equal(blocked.code,'CHOICE_LOCKED_MOVE_REQUIRED');assert.equal(blocked.requiredMoveId,'waterfall');
 const restarted=JSON.parse(JSON.stringify(result.battle));assert.equal(restarted.sides.A.roster[0].volatiles['choice-lock'].moveId,'waterfall');restarted.field.rooms={'magic-room':{id:'magic-room',remaining:3}};assert.deepEqual(validate(restarted,{kind:'move',side:'A',actorId:'A-0',moveId:'bulldoze'}),{ok:true});assert.equal(speedWithHeldItems(101,restarted.sides.A.roster[0],restarted),101);delete restarted.field.rooms;assert.equal(validate(restarted,{kind:'move',side:'A',actorId:'A-0',moveId:'bulldoze'}).code,'CHOICE_LOCKED_MOVE_REQUIRED');
 const reserve=restarted.sides.A.roster.find(unit=>!restarted.sides.A.active.includes(unit.actorId)),switched=applySwitch(restarted,'A','A-0',reserve.actorId);assert.equal(switched.ok,true);assert.deepEqual(switched.battle.sides.A.roster[0].volatiles,{});
});

for(const format of ['single','double'])test(`schema-3 ${format} Passho Berry consumes on the first super-effective Waterfall hit`,()=>{
 const plain=postDamageFixture(format,{actorItem:'none',actorAbility:'torrent',targetItem:'none'}),plainHit=applyDamageHit(plain,{actorId:'A-0',targetId:'B-0',move:v3Catalog.movesById.waterfall,mechanics:mechanics.moves.waterfall},runtime),battle=postDamageFixture(format,{actorItem:'none',actorAbility:'torrent',targetItem:'passho-berry'}),target=battle.sides.B.roster[0];assert.ok(target.passiveEffects.some(effect=>effect.kind==='item-resist-hit'&&effect.sourceId==='passho-berry'));
 const hit=applyDamageHit(battle,{actorId:'A-0',targetId:'B-0',move:v3Catalog.movesById.waterfall,mechanics:mechanics.moves.waterfall},runtime),after=hit.battle.sides.B.roster[0],damage=hit.events.find(event=>event.kind==='damage'&&event.moveId==='waterfall');assert.ok(hit.amount<plainHit.amount);assert.equal(after.itemState.consumed,true);assert.equal(after.itemState.revealed,true);assert.equal(damage.breakdown.itemResistance.sourceId,'passho-berry');
 const restarted=JSON.parse(JSON.stringify(hit.battle)),again=applyDamageHit(restarted,{actorId:'A-0',targetId:'B-0',move:v3Catalog.movesById.waterfall,mechanics:mechanics.moves.waterfall},runtime);assert.ok(!again.events.some(event=>event.itemId==='passho-berry'));
});

test('schema-3 Expert Belt and a newly promoted type booster compile through the active catalog',()=>{
 let battle=postDamageFixture('single',{actorItem:'expert-belt',actorAbility:'torrent',targetItem:'none'}),actor=battle.sides.A.roster[0];assert.ok(actor.passiveEffects.some(effect=>effect.kind==='held-damage-boost'&&effect.superEffective===true&&effect.sourceId==='expert-belt'));let boosted=applyDamageHit(battle,{actorId:'A-0',targetId:'B-0',move:v3Catalog.movesById.waterfall,mechanics:mechanics.moves.waterfall},runtime),damage=boosted.events.find(event=>event.kind==='damage'&&event.moveId==='waterfall');assert.ok(damage.breakdown.passiveModifiers.some(effect=>effect.sourceId==='expert-belt'));
 const darkBuild=build('feraligatr','black-glasses',['crunch','waterfall','bulldoze','ice-fang']),darkActor=createV3BattleUnit('A',0,darkBuild,mon('feraligatr'),v3Catalog);assert.ok(darkActor.passiveEffects.some(effect=>effect.kind==='held-damage-boost'&&effect.type==='dark'&&effect.multiplier===1.2));
});

test('schema-3 Wide Lens changes actual Sing accuracy while Magic Room suppresses the passive',()=>{
 const actor=createV3BattleUnit('A',0,build('primarina','wide-lens'),mon('primarina'),v3Catalog),target=makeUnit('B',0,'infernape','none'),base={id:'wide-lens-runtime',rulesVersion:v3Catalog.metadata.rulesVersion,catalogVersion:v3Catalog.metadata.catalogVersion,format:'single',level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:1,rngState:55,field:{},sides:{A:{active:['A-0'],roster:[actor],conditions:{}},B:{active:['B-0'],roster:[target],conditions:{}}}},action={kind:'move',side:'A',actorId:'A-0',moveId:'sing',speed:actor.stats.spe,priority:0,target:{side:'B',slot:0}},roll={nextRandom:()=>.57};
 let result=resolveMove(base,action,roll);assert.equal(result.battle.sides.B.roster[0].status?.id||result.battle.sides.B.roster[0].status,'sleep');assert.equal(result.battle.sides.A.roster[0].itemState.revealed,false);
 const suppressed=structuredClone(base);suppressed.field.rooms={'magic-room':{id:'magic-room',remaining:3}};result=resolveMove(suppressed,action,roll);assert.equal(result.battle.sides.B.roster[0].status,null);assert.ok(result.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===55));
});

test('schema-3 Oran Berry restores fixed HP through the factory-compiled threshold hook',()=>{
 const battle=fixture('single','oran-berry'),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];target.hp=Math.floor(target.maxHp/2)+3;actor.stats.atk=60;const attack={...v3Catalog.movesById['body-slam'],power:20},result=applyDamageHit(battle,{actorId:actor.actorId,targetId:target.actorId,move:attack,mechanics:mechanics.moves['body-slam']},runtime),heal=result.events.find(event=>event.kind==='heal'&&event.source==='oran-berry'),after=result.battle.sides.B.roster[0];assert.equal(heal?.amount,10);assert.equal(after.itemState.consumed,true);assert.equal(after.itemState.activationCount,1);
});


test('schema-3 Bright Powder affects actual command accuracy and Magic Room suppresses it',()=>{
 const actor=createV3BattleUnit('A',0,build('feraligatr','none',['body-slam','waterfall','bulldoze','ice-fang']),mon('feraligatr'),v3Catalog),target=makeUnit('B',0,'infernape','bright-powder'),base={id:'bright-powder-runtime',rulesVersion:v3Catalog.metadata.rulesVersion,catalogVersion:v3Catalog.metadata.catalogVersion,format:'single',level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:1,rngState:61,field:{},sides:{A:{active:['A-0'],roster:[actor],conditions:{}},B:{active:['B-0'],roster:[target],conditions:{}}}},action={kind:'move',side:'A',actorId:'A-0',moveId:'body-slam',speed:actor.stats.spe,priority:0,target:{side:'B',slot:0}},roll={nextRandom:()=>.95};
 let result=resolveMove(base,action,roll);assert.ok(result.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===90));assert.equal(result.battle.sides.B.roster[0].itemState.revealed,false);
 const suppressed=structuredClone(base);suppressed.field.rooms={'magic-room':{id:'magic-room',remaining:3}};result=resolveMove(suppressed,action,roll);assert.ok(result.events.some(event=>event.kind==='damage'&&event.moveId==='body-slam'));assert.equal(result.battle.sides.B.roster[0].itemState.revealed,false);
});

test('schema-3 Scope Lens raises the direct-damage critical chance without passive reveal',()=>{
 const battle=postDamageFixture('single',{actorItem:'scope-lens',actorAbility:'torrent',targetItem:'none'}),actor=battle.sides.A.roster[0],rolls=[.1,.999],result=applyDamageHit(battle,{actorId:'A-0',targetId:'B-0',move:v3Catalog.movesById.waterfall,mechanics:mechanics.moves.waterfall},{nextRandom:()=>rolls.shift()}),damage=result.events.find(event=>event.kind==='damage'&&event.moveId==='waterfall');assert.equal(damage.breakdown.critical,1.5);assert.equal(result.battle.sides.A.roster[0].itemState.revealed,false);assert.ok(actor.passiveEffects.some(effect=>effect.kind==='item-critical-ratio'&&effect.stages===1));
});

test('schema-3 Focus Band can preserve a non-full-HP holder and remains equipped after activation',()=>{
 const battle=fixture('single','focus-band'),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];target.hp=Math.floor(target.maxHp/2);actor.stats.atk=999;const rolls=[.999,.999,.05],move={...v3Catalog.movesById['giga-impact'],power:250,type:'normal'},result=applyDamageHit(battle,{actorId:actor.actorId,targetId:target.actorId,move,mechanics:mechanics.moves['giga-impact']},{nextRandom:()=>rolls.shift()}),after=result.battle.sides.B.roster[0];assert.equal(after.hp,1);assert.equal(after.itemState.revealed,true);assert.equal(after.itemState.consumed,false);assert.equal(after.itemState.activationCount,1);assert.ok(result.events.some(event=>event.kind==='itemActivated'&&event.itemId==='focus-band'));assert.ok(!result.events.some(event=>event.kind==='itemConsumed'&&event.itemId==='focus-band'));
});

test('schema-3 v21 lifecycle items compile through the promoted catalog and PP maxima are pinned',()=>{
 const expectations={
  'air-balloon':'item-airborne','big-root':'item-healing-boost','electric-seed':'item-terrain-seed','grassy-seed':'item-terrain-seed','misty-seed':'item-terrain-seed','psychic-seed':'item-terrain-seed','iron-ball':'item-speed-modifier','leppa-berry':'item-pp-restore','normal-gem':'item-one-shot-damage-boost','red-card':'item-force-attacker-switch','zoom-lens':'item-accuracy-after-target'
 };
 for(const [itemId,kind] of Object.entries(expectations)){const holder=makeUnit('B',0,'primarina',itemId);assert.ok(holder.passiveEffects.some(effect=>effect.kind===kind&&effect.sourceId===itemId),itemId);assert.ok(Object.values(holder.maxPp||{}).every(value=>Number.isInteger(value)&&value>0),`${itemId}:maxPp`);}
 const iron=makeUnit('B',0,'primarina','iron-ball');assert.ok(iron.passiveEffects.some(effect=>effect.kind==='item-grounding'&&effect.sourceId==='iron-ball'));
});
