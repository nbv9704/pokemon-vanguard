import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const names=['V2_PHASES','V2_transition','V2_resolveTargets','V2_validateCommands','V2_buildQueue','V2_submitCommands','V2_applySwitch','V2_ABILITY_IDS','V2_ITEM_IDS','V2_ABILITY_HOOKS','V2_ITEM_HOOKS','V2_setField','V2_setSideCondition','V2_applyStatus','V2_changeStage','V2_sleepGate','V2_guardAttempt','V2_effectiveStat','V2_damageModifiers','V2_surviveLethal','V2_afterDamage','V2_entryAbility','V2_resolveEntry','V2_assertEffectCatalog','V2_endTurn','V2_checkResult','V2_validateReplacements','V2_applyReplacements'];
const source=await readFile(new URL('../src/logic.js',import.meta.url),'utf8');
const engine=await import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport {${names.join(',')}}`).toString('base64')}`);
const moves={hit:{id:'hit',type:'Flame',category:'physical',power:60,accuracy:100,maxPP:10,priority:0,targetMode:'foe',contact:true},spread:{id:'spread',type:'Tide',category:'special',power:65,accuracy:95,maxPP:10,priority:0,targetMode:'allFoes'},guard:{id:'guard',type:'Steel',category:'status',power:0,accuracy:100,maxPP:10,priority:4,targetMode:'self'}};
function mon(id,side,{hp=200,ability='tailwind',item='none',types=['Flame'],spe=100,status=null}={}){return {battleMonId:id,ownerSide:side,types,stats:{hp:200,atk:100,def:100,spa:100,spd:100,spe},hp,pp:{hit:10,spread:10,guard:10},status,stages:{atk:0,def:0,spa:0,spd:0,spe:0},volatiles:{},itemState:{used:false},buildSnapshot:{moveIds:['hit','spread','guard','other'],abilityId:ability,itemId:item}};}
function battle(phase='COMMAND'){
 const A=[mon('A0','A'),mon('A1','A'),mon('A2','A'),mon('A3','A')],B=[mon('B0','B'),mon('B1','B'),mon('B2','B')];
 return {id:'battle-1',phase,phaseRevision:1,turn:1,activeCount:2,rngState:7,field:{weather:null,terrain:null,sides:{A:{tailwind:0,barrier:0},B:{tailwind:0,barrier:0}}},sides:{A:{roster:A,active:['A0','A1']},B:{roster:B,active:['B0','B1']}},pending:{},rewardReceipts:[],result:null};
}

test('phase transitions, slot targets and command validation are strict',()=>{
 const b=battle();assert.equal(engine.V2_transition(b,'RESOLVE').ok,true);assert.equal(engine.V2_transition(b,'ENTRY').code,'WRONG_PHASE');
 const valid=[{kind:'move',actorId:'A0',moveId:'hit',target:{side:'B',slot:1}},{kind:'switch',actorId:'A1',toId:'A2'}];assert.equal(engine.V2_validateCommands(b,'A',valid,moves).ok,true);
 const duplicate=[{kind:'switch',actorId:'A0',toId:'A2'},{kind:'switch',actorId:'A1',toId:'A2'}];assert.equal(engine.V2_validateCommands(b,'A',duplicate,moves).code,'INVALID_SWITCH');
 const fallback=engine.V2_resolveTargets({...b,sides:{...b.sides,B:{...b.sides.B,active:['B0',null]}}},'A','A0',moves.hit,{side:'B',slot:1});assert.equal(fallback[0].battleMonId,'B0');
 b.sides.B.roster[1].volatiles.redirect=true;b.sides.B.roster[1].volatiles.redirectOrder=4;assert.equal(engine.V2_resolveTargets(b,'A','A0',moves.hit,{side:'B',slot:0})[0].battleMonId,'B1');
});

test('queue uses switch, priority, speed and precomputed seeded tie keys',()=>{
 const b=battle(),sets={A:[{kind:'move',actorId:'A0',moveId:'hit'},{kind:'switch',actorId:'A1',toId:'A2'}],B:[{kind:'move',actorId:'B0',moveId:'guard'},{kind:'move',actorId:'B1',moveId:'hit'}]};
 const built=engine.V2_buildQueue(b,sets,moves);assert.equal(built.queue[0].command.kind,'switch');assert.equal(built.queue[1].command.moveId,'guard');assert.ok(built.queue.every(entry=>Number.isFinite(entry.tieKey)));
 const winners=new Set();for(let seed=1;seed<=20;seed++){b.rngState=seed;const q=engine.V2_buildQueue(b,{A:[{kind:'move',actorId:'A0',moveId:'hit'}],B:[{kind:'move',actorId:'B0',moveId:'hit'}]},moves);winners.add(q.queue[0].side);}assert.deepEqual([...winners].sort(),['A','B']);
});

test('command packages commit once and resolve only after both sides submit',()=>{
 const b=battle(),a=[{kind:'move',actorId:'A0',moveId:'hit',target:{side:'B',slot:0}},{kind:'move',actorId:'A1',moveId:'hit',target:{side:'B',slot:1}}],bb=[{kind:'move',actorId:'B0',moveId:'hit',target:{side:'A',slot:0}},{kind:'move',actorId:'B1',moveId:'hit',target:{side:'A',slot:1}}];
 const first=engine.V2_submitCommands(b,'A',a,moves);assert.equal(first.ready,false);assert.equal(engine.V2_submitCommands(first.battle,'A',a,moves).code,'ALREADY_SUBMITTED');const second=engine.V2_submitCommands(first.battle,'B',bb,moves);assert.equal(second.ready,true);assert.equal(second.battle.phase,'RESOLVE');assert.equal(second.battle.queue.length,4);
});

test('switch keeps PP/status and clears stages and volatile state',()=>{
 const b=battle();b.sides.A.roster[0].status='burn';b.sides.A.roster[0].pp.hit=3;b.sides.A.roster[0].stages.atk=4;b.sides.A.roster[0].volatiles.guarded=true;
 const result=engine.V2_applySwitch(b,'A','A0','A2');const out=result.battle.sides.A.roster[0];assert.equal(out.status,'burn');assert.equal(out.pp.hit,3);assert.equal(out.stages.atk,0);assert.deepEqual(out.volatiles,{});assert.equal(result.battle.sides.A.active[0],'A2');
});

test('conditions obey immunity, single-status, sleep and duration rules',()=>{
 const flame=mon('F','A');assert.equal(engine.V2_applyStatus(flame,'burn').applied,false);const poisoned=engine.V2_applyStatus(flame,'poison');assert.equal(poisoned.applied,true);assert.equal(engine.V2_applyStatus(poisoned.mon,'slow').applied,false);
 const cured=engine.V2_applyStatus(mon('C','A',{item:'cure-berry',types:['Gale']}),'slow');assert.equal(cured.applied,true);assert.equal(cured.mon.status,null);assert.equal(cured.mon.itemState.used,true);
 assert.equal(engine.V2_changeStage(mon('N','A',{item:'clear-charm'}),'atk',-1).changed,false);assert.equal(engine.V2_changeStage(mon('N','A'),'atk',-1).mon.stages.atk,-1);
 const sleeper=engine.V2_applyStatus(mon('S','A',{types:['Gale']}),'sleep').mon;let gate=engine.V2_sleepGate(sleeper);assert.equal(gate.canAct,false);gate=engine.V2_sleepGate(gate.mon);assert.equal(gate.canAct,false);gate=engine.V2_sleepGate(gate.mon);assert.equal(gate.canAct,true);assert.equal(gate.woke,true);
 const guarded=engine.V2_guardAttempt(mon('G','A'),1);assert.equal(guarded.success,true);assert.equal(guarded.denominator,1);assert.equal(guarded.mon.volatiles.guarded,true);
 const b=battle(),rock=mon('R','A',{item:'weather-rock'});b.sides.A.roster[0]=rock;b.sides.A.active[0]='R';const sunny=engine.V2_setField(b,'weather','sun','R').battle;assert.equal(sunny.field.weather.remaining,7);const layered=engine.V2_setField(sunny,'terrain','meadow','R').battle;assert.equal(layered.field.terrain.remaining,5);assert.equal(layered.field.weather.id,'sun');
 const side=engine.V2_setSideCondition(b,'A','tailwind',4).battle;assert.equal(engine.V2_setSideCondition(side,'A','tailwind',4).battle.field.sides.A.tailwind,4);
});

test('all 24 abilities and 12 items are registered with modifier and trigger behavior',()=>{
 assert.equal(engine.V2_assertEffectCatalog(),true);assert.equal(engine.V2_ABILITY_IDS.length,24);assert.equal(engine.V2_ITEM_IDS.length,12);
 assert.equal(Object.keys(engine.V2_ABILITY_HOOKS).length,24);assert.equal(Object.keys(engine.V2_ITEM_HOOKS).length,12);
 const b=battle();b.field.weather={id:'rain',remaining:5};b.field.sides.A.tailwind=4;const speed=engine.V2_effectiveStat(mon('X','A',{ability:'rain-swimmer',item:'swift-feather',spe:100}),'spe',b,'A');assert.equal(speed,375);
 const attacker=mon('X','A',{ability:'night-hunter',item:'power-lens'}),defender=mon('Y','B',{hp:90,ability:'water-shell',item:'aegis-plate'});b.field.sides.B.barrier=3;const mods=engine.V2_damageModifiers({attacker,defender,battle:b,attackerSide:'A',defenderSide:'B',move:moves.hit,allies:[]});assert.equal(mods.outgoing,1.5);assert.ok(Math.abs(mods.incoming-.3)<1e-9);
 const sturdy=mon('T','B',{ability:'sturdy-heart',item:'focus-crystal'});let survive=engine.V2_surviveLethal(sturdy,999);assert.equal(survive.trigger,'sturdy-heart');assert.equal(survive.damage,199);survive.mon.hp=200;survive=engine.V2_surviveLethal(survive.mon,999);assert.equal(survive.trigger,'focus-crystal');
 const entry=battle('ENTRY');entry.sides.A.roster[0].buildSnapshot.abilityId='dawnbringer';assert.equal(engine.V2_entryAbility(entry,'A','A0').battle.field.weather.id,'sun');entry.sides.A.roster[0].buildSnapshot.abilityId='intimidator';assert.equal(engine.V2_entryAbility(entry,'A','A0').battle.sides.B.roster[0].stages.atk,-1);
 entry.sides.A.roster[0].stats.spe=50;entry.sides.B.roster[0].stats.spe=150;const ordered=engine.V2_resolveEntry(entry,[{side:'A',monId:'A0'},{side:'B',monId:'B0'}]);assert.deepEqual(ordered.order,['B0','A0']);
});

test('berry, venom and thorn post-hit hooks respect positive and negative gates',()=>{
 const b=mon('B','B',{hp:40,ability:'thorn-coat',item:'healing-berry',types:['Bloom']}),a=mon('A','A',{ability:'venom-touch'});const result=engine.V2_afterDamage({attacker:a,defender:b,damage:20,move:moves.hit,rngState:1});assert.equal(result.defender.itemState.used,true);assert.ok(result.defender.hp>40);assert.ok(result.attacker.hp<200);
 const blocked=engine.V2_afterDamage({attacker:a,defender:{...b,hp:0},damage:20,move:moves.hit,rngState:1});assert.equal(blocked.events.length,0);
});

test('END_TURN applies groups symmetrically, expires effects and creates one draw receipt',()=>{
 const b=battle('END_TURN');b.sides.A.roster.forEach((m,i)=>m.hp=i?0:10);b.sides.B.roster.forEach((m,i)=>m.hp=i?0:10);b.sides.A.roster[0].status='poison';b.sides.B.roster[0].status='poison';b.field.weather={id:'sun',remaining:1};
 const ended=engine.V2_endTurn(b);assert.equal(ended.battle.phase,'FINISHED');assert.equal(ended.battle.result.reason,'draw-ko');assert.equal(ended.battle.rewardReceipts.length,1);const again=engine.V2_checkResult(ended.battle);assert.equal(again.battle.rewardReceipts.length,1);
});

test('replacement validates exact empty slots and duplicate reserves',()=>{
 const b=battle('REPLACE');b.sides.A.roster[0].hp=0;b.sides.A.roster[1].hp=0;b.sides.B.roster[0].hp=0;b.sides.B.roster[1].hp=0;
 assert.equal(engine.V2_validateReplacements(b,'A',[{slot:0,monId:'A2'},{slot:1,monId:'A2'}]).ok,false);
 const applied=engine.V2_applyReplacements(b,{A:[{slot:0,monId:'A2'},{slot:1,monId:'A3'}],B:[{slot:0,monId:'B2'}]});assert.equal(applied.ok,true);assert.equal(applied.battle.phase,'ENTRY');assert.deepEqual(applied.battle.sides.A.active,['A2','A3']);assert.deepEqual(applied.battle.sides.B.active,['B2','B1']);
});

test('turn cap produces a draw exactly at 100',()=>{const b=battle('END_TURN');b.turn=100;const result=engine.V2_endTurn(b);assert.equal(result.battle.result.reason,'turn-cap');assert.equal(result.battle.result.winner,null);});
