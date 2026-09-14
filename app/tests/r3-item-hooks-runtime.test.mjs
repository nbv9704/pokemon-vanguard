import test from 'node:test';
import assert from 'node:assert/strict';
import {activateHeldItem,applyDamageHit,applyMajorStatus,applyVolatileStatus,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn} from '../mechanics-v3/index.mjs';
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

test('schema-3 Lum Berry clears simultaneous major status and confusion with one persisted receipt',()=>{
 const battle=fixture('single','lum-berry'),target=battle.sides.B.roster[0];target.volatiles.confusion={id:'confusion',timer:3};const result=applyMajorStatus(battle,{actorId:'A-0',targetId:'B-0',moveId:'will-o-wisp',status:'burn'},runtime),after=result.battle.sides.B.roster[0];
 assert.equal(after.status,null);assert.equal(after.volatiles.confusion,undefined);assert.equal(after.itemState.activationCount,1);assert.equal(after.itemState.consumed,true);const restarted=JSON.parse(JSON.stringify(result.battle));assert.equal(restarted.sides.B.roster[0].itemState.activationCount,1);assert.equal(restarted.sides.B.roster[0].itemState.consumed,true);
});


function postDamageFixture(format,{actorItem='none',actorAbility='torrent',actorMoves=['waterfall','rock-slide','bulldoze','ice-fang'],targetItem='none'}={}){
 const count=format==='double'?2:1,species=v3Catalog.speciesById.feraligatr,base=species.defaultBuild,customBuild={buildId:'post-damage-feraligatr',monId:'mon-feraligatr',name:'Feraligatr Post Damage',natureId:base.natureId,statPoints:structuredClone(base.statPoints),moveIds:[...actorMoves],abilityId:actorAbility,itemId:actorItem},actor=createV3BattleUnit('A',0,customBuild,mon('feraligatr'),v3Catalog),ally=makeUnit('A',1,'blastoise','none'),target=makeUnit('B',0,'infernape',targetItem),targetAlly=makeUnit('B',1,'typhlosion','none');
 return {id:`post-damage-${format}`,rulesVersion:v3Catalog.metadata.rulesVersion,catalogVersion:v3Catalog.metadata.catalogVersion,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:41,field:{},sides:{A:{active:[actor,ally].slice(0,count).map(unit=>unit.actorId),roster:[actor,ally],conditions:{}},B:{active:[target,targetAlly].slice(0,count).map(unit=>unit.actorId),roster:[target,targetAlly],conditions:{}}}};
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
