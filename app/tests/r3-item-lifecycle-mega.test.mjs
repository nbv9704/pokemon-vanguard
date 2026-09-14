import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 accuracyWithHeldItems,applyDamageHit,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,criticalChanceWithHeldItems,
 HANDLER_DEFINITIONS,healingWithHeldItems,prepareOneShotMoveDamageItem,resolveEntryHazards,resolvePpRestoreItems,applyLinkedResiduals,
 prepareConsecutiveMoveItem,prepareTurnOrderItems,resolveFlinchItems,resolveReactiveSwitchItems,resolveTerrainSeedItems,resolveVolatileCureItems,speedWithHeldItems,statWithHeldItems,typeEffectivenessWithHeldItems,unitIsGrounded
} from '../mechanics-v3/index.mjs';
import {spendPpHandler} from '../mechanics-v3/handlers/spend-pp.mjs';
import {resolveActionQueue} from '../rules-v3/turn-engine.mjs';
import {applyDrainHandler} from '../mechanics-v3/handlers/apply-drain.mjs';
import {applyTerrainHandler} from '../mechanics-v3/handlers/apply-terrain.mjs';
import {checkAccuracyHandler} from '../mechanics-v3/handlers/check-accuracy.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stage=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const roll={nextRandom:()=>.999};
const move=(id,{type='normal',category='physical',power=70,accuracy=100,contact=true}={})=>({id,name:id,type,category,power,accuracy,priority:0,targetMode:'anyAdjacent',contact,tags:[]});
function unit(actorId,{itemId=null,speciesId='testmon',types=['normal'],hp=160,maxHp=160,spe=100,moveIds=['tackle']}={}){
 const pp=Object.fromEntries(moveIds.map(id=>[id,10])),maxPp=Object.fromEntries(moveIds.map(id=>[id,10]));
 return {actorId,baseSpeciesId:speciesId,speciesId,types,hp,maxHp,stats:{hp:maxHp,atk:150,def:110,spa:130,spd:110,spe},pp,maxPp,status:null,volatiles:{},stages:stage(),buildSnapshot:{itemId,moveIds},itemState:createHeldItemState(itemId),passiveEffects:compilePassiveEffects({itemId,manifests})};
}
function battle(format='single',{actorItem=null,targetItem=null,targetTypes=['normal'],field={},aReserves=1,bReserves=1}={}){
 const count=format==='double'?2:1,a=[unit('a1',{itemId:actorItem}),unit('a2'),unit('a3')],b=[unit('b1',{itemId:targetItem,types:targetTypes}),unit('b2'),unit('b3')];
 return {id:`lifecycle-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:7,field,sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a.slice(0,count+aReserves),conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b.slice(0,count+bReserves),conditions:{}}}};
}
const action=(moveId='tackle')=>({kind:'move',side:'A',actorId:'a1',moveId,speed:100,priority:0,target:{side:'B',slot:0}});
const mechanicsFor=id=>({id,targetMode:'anyAdjacent',priority:0,contact:true,handlers:[{id:'spend-pp',hook:'onTryMove',order:10},{id:'check-accuracy',hook:'onMove',order:90},{id:'deal-direct-damage',hook:'onMove',order:100}],testEvidence:{single:['r3-item-lifecycle:single'],double:['r3-item-lifecycle:double']}});

for(const format of ['single','double'])test(`r3-item-lifecycle:${format}`,()=>{
 const seedMap=[['electric-seed','electric','def'],['grassy-seed','grassy','def'],['misty-seed','misty','spd'],['psychic-seed','psychic','spd']];
 for(const [itemId,terrain,stat] of seedMap){const state=battle(format,{targetItem:itemId,field:{terrain:{id:terrain,remaining:5}}}),result=resolveTerrainSeedItems(state,{actorIds:['b1'],trigger:'test'}),holder=result.battle.sides.B.roster[0];assert.equal(holder.stages[stat],1);assert.equal(holder.itemState.consumed,true);assert.ok(result.events.some(e=>e.kind==='itemConsumed'&&e.itemId===itemId));}
 const zoom=battle(format,{actorItem:'zoom-lens'}),holder=zoom.sides.A.roster[0];assert.equal(accuracyWithHeldItems(50,holder,zoom,{target:zoom.sides.B.roster[0],targetWillMove:true}),50);assert.equal(accuracyWithHeldItems(50,holder,zoom,{target:zoom.sides.B.roster[0],targetWillMove:false}),59);
 const root=battle(format,{actorItem:'big-root'}),rootHolder=root.sides.A.roster[0];assert.equal(healingWithHeldItems(100,rootHolder,root,{source:'drain'}),129);assert.equal(healingWithHeldItems(100,rootHolder,root,{source:'leech-seed'}),129);
});

test('Air Balloon reveals on entry, ignores grounded hazards and Ground damage, then pops on a damaging hit',()=>{
 let state=battle('single',{targetItem:'air-balloon'});state.sides.B.conditions.spikes={id:'spikes',layers:3,order:1};state.sides.B.conditions['toxic-spikes']={id:'toxic-spikes',layers:2,order:2};
 let entry=resolveEntryHazards(state,[{kind:'switchIn',side:'B',actorId:'b1'}]),holder=entry.battle.sides.B.roster[0];assert.equal(holder.hp,160);assert.equal(holder.status,null);assert.equal(holder.itemState.revealed,true);assert.ok(entry.events.some(e=>e.kind==='itemRevealed'&&e.itemId==='air-balloon'));
 const ground=move('earthquake',{type:'ground',power:100,contact:false}),immune=applyDamageHit(entry.battle,{actorId:'a1',targetId:'b1',move:ground},roll);assert.equal(immune.amount,0);assert.equal(immune.battle.sides.B.roster[0].itemState.consumed,false);
 const hit=applyDamageHit(immune.battle,{actorId:'a1',targetId:'b1',move:move('tackle')},roll);assert.ok(hit.amount>0);assert.equal(hit.battle.sides.B.roster[0].itemState.consumed,true);assert.ok(hit.events.some(e=>e.kind==='itemConsumed'&&e.itemId==='air-balloon'));
 const after=applyDamageHit(hit.battle,{actorId:'a1',targetId:'b1',move:ground},roll);assert.ok(after.amount>0);
});

test('Iron Ball halves Speed, grounds Flying holders for hazards and Ground attacks, while Magic Room suppresses both effects',()=>{
 let state=battle('single',{targetItem:'iron-ball',targetTypes:['flying']});const holder=state.sides.B.roster[0];holder.stats.spe=101;state.sides.B.conditions.spikes={id:'spikes',layers:1,order:1};assert.equal(speedWithHeldItems(101,holder,state),50);assert.equal(unitIsGrounded(holder,state),true);assert.equal(typeEffectivenessWithHeldItems('ground',holder,state),1);
 const entry=resolveEntryHazards(state,[{kind:'switchIn',side:'B',actorId:'b1'}]);assert.ok(entry.battle.sides.B.roster[0].hp<160);
 const suppressed=structuredClone(state);suppressed.field.rooms={'magic-room':{id:'magic-room',remaining:3}};const suppressedHolder=suppressed.sides.B.roster[0];assert.equal(speedWithHeldItems(101,suppressedHolder,suppressed),101);assert.equal(unitIsGrounded(suppressedHolder,suppressed),false);assert.equal(typeEffectivenessWithHeldItems('ground',suppressedHolder,suppressed),0);
});

test('Leppa Berry restores 10 PP immediately at zero and remains dormant under Magic Room',()=>{
 let state=battle('single',{actorItem:'leppa-berry'}),holder=state.sides.A.roster[0];holder.pp.tackle=1;holder.maxPp.tackle=12;
 let spent=spendPpHandler.run({battle:state,payload:{action:action(),move:move('tackle')}}),after=spent.battle.sides.A.roster[0];assert.equal(after.pp.tackle,10);assert.equal(after.itemState.consumed,true);assert.ok(spent.events.some(e=>e.kind==='ppRestored'&&e.ppAfter===10));
 state=battle('single',{actorItem:'leppa-berry',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}});holder=state.sides.A.roster[0];holder.pp.tackle=1;holder.maxPp.tackle=12;spent=spendPpHandler.run({battle:state,payload:{action:action(),move:move('tackle')}});after=spent.battle.sides.A.roster[0];assert.equal(after.pp.tackle,0);assert.equal(after.itemState.consumed,false);delete spent.battle.field.rooms;const released=resolvePpRestoreItems(spent.battle,{actorIds:['a1'],trigger:'room-ended'});assert.equal(released.battle.sides.A.roster[0].pp.tackle,10);assert.equal(released.battle.sides.A.roster[0].itemState.consumed,true);
});

test('Big Root boosts actual drain recovery without revealing a persistent passive item',()=>{
 const state=battle('single',{actorItem:'big-root'}),actor=state.sides.A.roster[0];actor.hp=60;const basePayload={action:action('giga-drain'),move:move('giga-drain',{type:'grass',category:'special'}),totalDamage:80};const result=applyDrainHandler.run({battle:state,payload:basePayload,params:{numerator:1,denominator:2}}),after=result.battle.sides.A.roster[0];assert.equal(after.hp,111);assert.equal(result.events[0].amount,51);assert.equal(after.itemState.revealed,false);
});

test('Normal Gem is prepared only for a real hittable target and boosts one move before being consumed',()=>{
 const tackle=move('tackle'),mech=mechanicsFor('tackle'),registry=createHookRegistry(HANDLER_DEFINITIONS),resolve=createMoveActionHandler({moves:{tackle},manifests:{tackle:mech},registry});
 const plain=resolve(battle('single'),action(),roll),gem=resolve(battle('single',{actorItem:'normal-gem'}),action(),roll),plainDamage=plain.events.find(e=>e.kind==='damage').amount,gemDamage=gem.events.find(e=>e.kind==='damage').amount;assert.ok(gemDamage>plainDamage);assert.equal(gem.battle.sides.A.roster[0].itemState.consumed,true);assert.equal(gem.events.filter(e=>e.kind==='itemConsumed'&&e.itemId==='normal-gem').length,1);assert.equal(gem.events.find(e=>e.kind==='damage').breakdown.itemMovePowerModifier.sourceId,'normal-gem');
 let blocked=battle('single',{actorItem:'normal-gem'});blocked.sides.B.roster[0].types=['ghost'];const immune=resolve(blocked,action(),roll);assert.equal(immune.battle.sides.A.roster[0].itemState.consumed,false);
 const suppressed=battle('single',{actorItem:'normal-gem',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}}),suppressedResult=resolve(suppressed,action(),roll);assert.equal(suppressedResult.battle.sides.A.roster[0].itemState.consumed,false);
});

test('Red Card consumes after damage and forces the attacker to a seeded reserve, but not without a reserve or on native phazing',()=>{
 const state=battle('single',{targetItem:'red-card',aReserves:1}),result=resolveReactiveSwitchItems(state,{actorId:'a1',move:move('tackle'),mechanics:{handlers:[]},damagedTargetIds:['b1']},roll);assert.equal(result.battle.sides.A.active[0],'a2');assert.equal(result.battle.sides.B.roster[0].itemState.consumed,true);assert.ok(result.events.some(e=>e.kind==='forcedSwitch'&&e.itemId==='red-card'));
 const noReserve=battle('single',{targetItem:'red-card',aReserves:0}),noSwitch=resolveReactiveSwitchItems(noReserve,{actorId:'a1',move:move('tackle'),mechanics:{handlers:[]},damagedTargetIds:['b1']},roll);assert.equal(noSwitch.battle.sides.B.roster[0].itemState.consumed,false);
 const phazing=battle('single',{targetItem:'red-card'}),skipped=resolveReactiveSwitchItems(phazing,{actorId:'a1',move:move('dragon-tail',{type:'dragon'}),mechanics:{handlers:[{id:'apply-forced-switch'}]},damagedTargetIds:['b1']},roll);assert.equal(skipped.battle.sides.B.roster[0].itemState.consumed,false);
});

test('Magic Room suppresses all new item families without revealing or consuming them',()=>{
 const room={rooms:{'magic-room':{id:'magic-room',remaining:3}},terrain:{id:'electric',remaining:3}};
 let state=battle('single',{targetItem:'electric-seed',field:room}),seeds=resolveTerrainSeedItems(state,{actorIds:['b1']});assert.equal(seeds.battle.sides.B.roster[0].stages.def,0);assert.equal(seeds.battle.sides.B.roster[0].itemState.consumed,false);
 state=battle('single',{targetItem:'air-balloon',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}});const holder=state.sides.B.roster[0];assert.equal(typeEffectivenessWithHeldItems('ground',holder,state),1);const hit=applyDamageHit(state,{actorId:'a1',targetId:'b1',move:move('tackle')},roll);assert.equal(hit.battle.sides.B.roster[0].itemState.consumed,false);assert.equal(hit.battle.sides.B.roster[0].itemState.revealed,false);
});


test('terrain application wiring activates matching seeds and Zoom Lens uses pending-turn state rather than raw Speed',()=>{
 let state=battle('single',{targetItem:'grassy-seed'}),terrain=applyTerrainHandler.run({battle:state,payload:{action:action('grassy-terrain'),move:move('grassy-terrain',{category:'status',power:0}),mechanics:{}},params:{terrain:'grassy'}}),holder=terrain.battle.sides.B.roster[0];assert.equal(holder.stages.def,1);assert.equal(holder.itemState.consumed,true);
 state=battle('single',{actorItem:'zoom-lens'});const payload={action:action('zoom-test'),move:move('zoom-test',{accuracy:50}),mechanics:{targetMode:'anyAdjacent',redirectable:true}};
 let checked=checkAccuracyHandler.run({battle:state,payload,runtime:{willMove:()=>false,nextRandom:()=>.58}});assert.deepEqual(checked.payload.hitTargetIds,['b1']);
 checked=checkAccuracyHandler.run({battle:state,payload,runtime:{willMove:()=>true,nextRandom:()=>.58}});assert.deepEqual(checked.payload.hitTargetIds,[]);assert.equal(checked.events[0].effectiveAccuracy,50);
});

test('Big Root boosts Leech Seed recovery through linked-residual wiring',()=>{
 const state=battle('single',{actorItem:'big-root'}),source=state.sides.A.roster[0],target=state.sides.B.roster[0];source.hp=60;target.volatiles['leech-seed']={id:'leech-seed',sourceSide:'A',sourceSlot:0};const result=applyLinkedResiduals(state),heal=result.events.find(event=>event.kind==='heal'&&event.source==='leech-seed-heal');assert.equal(heal.amount,25);assert.equal(result.battle.sides.A.roster[0].hp,85);
});

test('Red Card is wired into the move pipeline before later switch effects',()=>{
 const tackle=move('tackle'),mech=mechanicsFor('tackle'),resolve=createMoveActionHandler({moves:{tackle},manifests:{tackle:mech},registry:createHookRegistry(HANDLER_DEFINITIONS)}),state=battle('single',{targetItem:'red-card',aReserves:1}),result=resolve(state,action(),roll);assert.equal(result.battle.sides.A.active[0],'a2');assert.equal(result.battle.sides.B.roster[0].itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='forcedSwitch'&&event.itemId==='red-card'&&event.triggerMoveId==='tackle'));
});

test('Light Ball doubles Pikachu Attack and Sp. Atk only, with Magic Room suppression',()=>{
 const state=battle('single',{actorItem:'light-ball'}),holder=state.sides.A.roster[0];holder.baseSpeciesId='pikachu';holder.speciesId='pikachu';
 assert.equal(statWithHeldItems(150,holder,'atk',state),300);assert.equal(statWithHeldItems(130,holder,'spa',state),260);
 holder.baseSpeciesId='raichu';holder.speciesId='raichu';assert.equal(statWithHeldItems(150,holder,'atk',state),150);
 holder.baseSpeciesId='pikachu';holder.speciesId='pikachu';state.field.rooms={'magic-room':{id:'magic-room',remaining:3}};assert.equal(statWithHeldItems(150,holder,'atk',state),150);
});

test('Leek grants exactly two critical-ratio stages only to Farfetchd/Sirfetchd and obeys Magic Room',()=>{
 const state=battle('single',{actorItem:'leek'}),holder=state.sides.A.roster[0];holder.baseSpeciesId='farfetchd';holder.speciesId='farfetchd';assert.equal(criticalChanceWithHeldItems(holder,state),.5);
 holder.baseSpeciesId='sirfetchd';holder.speciesId='sirfetchd';assert.equal(criticalChanceWithHeldItems(holder,state),.5);
 holder.baseSpeciesId='testmon';holder.speciesId='testmon';assert.equal(criticalChanceWithHeldItems(holder,state),1/24);
 holder.baseSpeciesId='farfetchd';holder.speciesId='farfetchd';state.field.rooms={'magic-room':{id:'magic-room',remaining:3}};assert.equal(criticalChanceWithHeldItems(holder,state),1/24);
});

test('Metronome boosts consecutive uses from the second use, caps at 2x, resets on move change, switch state and Magic Room',()=>{
 let state=battle('single',{actorItem:'metronome'}),result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('tackle')});assert.equal(result.multiplier,1);state=result.battle;
 result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('tackle')});assert.equal(result.multiplier,1.2);state=result.battle;
 for(let i=0;i<5;i++){result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('tackle')});state=result.battle;}assert.equal(result.multiplier,2);
 result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('scratch')});assert.equal(result.multiplier,1);state=result.battle;
 result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('protect',{category:'status',power:null,contact:false})});assert.equal(result.multiplier,1);state=result.battle;
 result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('scratch')});assert.equal(result.multiplier,1);state=result.battle;
 state.field.rooms={'magic-room':{id:'magic-room',remaining:3}};result=prepareConsecutiveMoveItem(state,{actorId:'a1',move:move('scratch')});assert.equal(result.multiplier,1);assert.equal(result.battle.sides.A.roster[0].volatiles['item-consecutive-move'],undefined);
});

test('Metronome multiplier is wired into real move damage without revealing the passive item',()=>{
 const tackle=move('tackle'),mech=mechanicsFor('tackle'),resolve=createMoveActionHandler({moves:{tackle},manifests:{tackle:mech},registry:createHookRegistry(HANDLER_DEFINITIONS)});let state=battle('single',{actorItem:'metronome'});state.sides.B.roster[0].hp=500;state.sides.B.roster[0].maxHp=500;state.sides.B.roster[0].stats.hp=500;
 const first=resolve(state,action(),roll),firstDamage=first.events.find(e=>e.kind==='damage').amount;state=first.battle;state.sides.B.roster[0].hp=500;
 const second=resolve(state,action(),roll),secondDamage=second.events.find(e=>e.kind==='damage').amount;assert.ok(secondDamage>firstDamage);assert.equal(second.events.find(e=>e.kind==='damage').breakdown.itemMovePowerModifier.sourceId,'metronome');assert.equal(second.battle.sides.A.roster[0].itemState.revealed,false);
});

test("King's Rock rolls one post-damage flinch only for moves without an existing flinch chance",()=>{
 let state=battle('single',{actorItem:'kings-rock'}),result=resolveFlinchItems(state,{actorId:'a1',move:move('tackle'),mechanics:{secondaryEffects:[]},damagedTargetIds:['b1']},{nextRandom:()=>.05});assert.ok(result.battle.sides.B.roster[0].volatiles.flinch);assert.ok(result.events.some(event=>event.kind==='volatileApplied'&&event.itemId==='kings-rock'));
 state=battle('single',{actorItem:'kings-rock'});result=resolveFlinchItems(state,{actorId:'a1',move:move('waterfall'),mechanics:{secondaryEffects:[{kind:'volatile-status',volatile:'flinch',chance:20}]},damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);
 state=battle('single',{actorItem:'kings-rock'});result=resolveFlinchItems(state,{actorId:'a1',move:move('crunch'),mechanics:{secondaryEffects:[{kind:'stat-stages',chance:20}],secondaryEffectsSuppressed:true},damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);
 state=battle('single',{actorItem:'kings-rock',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}});result=resolveFlinchItems(state,{actorId:'a1',move:move('tackle'),mechanics:{secondaryEffects:[]},damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);
});

test('Mental Herb consumes once and clears every supported restrictive volatile, including deferred Magic Room release',()=>{
 let state=battle('single',{actorItem:'mental-herb'}),holder=state.sides.A.roster[0];holder.volatiles={taunt:{id:'taunt'},encore:{id:'encore',moveId:'tackle'},disable:{id:'disable',moveId:'tackle'},torment:{id:'torment'},infatuation:{id:'infatuation'},'heal-block':{id:'heal-block'}};
 let cured=resolveVolatileCureItems(state,{actorIds:['a1'],trigger:'test'}),after=cured.battle.sides.A.roster[0];assert.equal(after.itemState.consumed,true);for(const id of ['taunt','encore','disable','torment','infatuation','heal-block'])assert.equal(after.volatiles[id],undefined);assert.equal(cured.events.filter(event=>event.kind==='itemConsumed'&&event.itemId==='mental-herb').length,1);
 state=battle('single',{actorItem:'mental-herb',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}});holder=state.sides.A.roster[0];holder.volatiles.taunt={id:'taunt'};cured=resolveVolatileCureItems(state,{actorIds:['a1'],trigger:'suppressed'});assert.ok(cured.battle.sides.A.roster[0].volatiles.taunt);assert.equal(cured.battle.sides.A.roster[0].itemState.consumed,false);delete cured.battle.field.rooms;cured=resolveVolatileCureItems(cured.battle,{actorIds:['a1'],trigger:'room-ended'});assert.equal(cured.battle.sides.A.roster[0].volatiles.taunt,undefined);assert.equal(cured.battle.sides.A.roster[0].itemState.consumed,true);
});


test('Quick Claw rolls once per move at turn preparation and acts first only inside the same priority bracket',()=>{
 let state=battle('single',{actorItem:'quick-claw'});state.rngState=2;state.sides.A.roster[0].stats.spe=50;state.sides.B.roster[0].stats.spe=150;
 const actions=[{...action(),speed:50},{kind:'move',side:'B',actorId:'b1',moveId:'tackle',speed:150,priority:0,target:{side:'A',slot:0}}],seen=[];
 const resolved=resolveActionQueue(state,actions,{move:(current,queued)=>{seen.push(queued.actorId);return {battle:current,events:[{kind:'quickOrderProbe',actorId:queued.actorId}]};}},{prepareTurnOrder:prepareTurnOrderItems,getSpeed:(current,queued)=>current.sides[queued.side].roster.find(unit=>unit.actorId===queued.actorId).stats.spe});
 assert.equal(resolved.ok,true);assert.deepEqual(seen,['a1','b1']);assert.ok(resolved.events.some(event=>event.kind==='itemActivated'&&event.itemId==='quick-claw'&&event.reason==='turn-order'));assert.equal(resolved.battle.sides.A.roster[0].itemState.consumed,false);
 const direct=prepareTurnOrderItems(battle('single',{actorItem:'quick-claw'}),actions,{nextRandom:()=>.19});assert.equal(direct.actions.find(entry=>entry.actorId==='a1').orderBoost,1);
 const suppressed=battle('single',{actorItem:'quick-claw',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}}),blocked=prepareTurnOrderItems(suppressed,actions,{nextRandom:()=>0});assert.equal(blocked.actions.find(entry=>entry.actorId==='a1').orderBoost,undefined);assert.equal(blocked.events.length,0);
 const differentPriority=resolveActionQueue({...state,rngState:2},[{...actions[0],priority:0},{...actions[1],priority:1}],{move:(current,queued)=>({battle:current,events:[{kind:'quickOrderProbe',actorId:queued.actorId}]})},{prepareTurnOrder:prepareTurnOrderItems,getSpeed:(current,queued)=>current.sides[queued.side].roster.find(unit=>unit.actorId===queued.actorId).stats.spe});assert.deepEqual(differentPriority.queue.map(entry=>entry.actorId),['b1','a1']);
 const spoofed=resolveActionQueue({...state,rngState:2},[{...actions[0],orderBoost:99},actions[1]],{move:current=>({battle:current,events:[]})},{prepareTurnOrder:prepareTurnOrderItems});assert.equal(spoofed.ok,false);assert.equal(spoofed.code,'INVALID_ACTION');
});
