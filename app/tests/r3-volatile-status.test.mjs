import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveEndTurn} from '../rules-v3/lifecycle.mjs';
import {applyVolatileStatus,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,tryBeforeMoveConditions,tryVolatileAction} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const specs={
 'confuse-ray':{type:'ghost',accuracy:100},
 flatter:{type:'dark',accuracy:100},
 swagger:{type:'normal',accuracy:85}
};
const moves=Object.fromEntries(Object.entries(specs).map(([id,spec])=>[id,{id,type:spec.type,category:'status',power:null,accuracy:spec.accuracy}]));
const pp=()=>Object.fromEntries(Object.keys(specs).map(id=>[id,20]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:pp(),status:null,volatiles:{},stages:stages()});

function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`volatile-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,eventSequence:0,events:[],result:null,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}

const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target});
const sequence=(...values)=>{let index=0;const next=()=>values[Math.min(index++,values.length-1)];next.count=()=>index;return next;};

test('r3-volatile-status:single applies Confuse Ray, Flatter and Swagger with composed effects',()=>{
 for(const moveId of Object.keys(specs)){
  const battle=fixture(),before=JSON.stringify(battle),rolls=moveId==='swagger'?sequence(0,.99):sequence(.99),result=resolveMove(battle,action(moveId),{nextRandom:rolls}),target=result.battle.sides.B.roster[0];
  assert.equal(JSON.stringify(battle),before,moveId);assert.equal(target.volatiles.confusion.timer,5,moveId);assert.equal(result.battle.sides.A.roster[0].pp[moveId],19,moveId);
  assert.equal(target.stages.atk,moveId==='swagger'?2:0,moveId);assert.equal(target.stages.spa,moveId==='flatter'?1:0,moveId);
 }
});

test('r3-volatile-status:double supports an ally target and redirects a foe target',()=>{
 const ally=resolveMove(fixture('double'),action('flatter',{side:'A',slot:1}),{nextRandom:()=>0});assert.equal(ally.battle.sides.A.roster[1].stages.spa,1);assert.equal(ally.battle.sides.A.roster[1].volatiles.confusion.id,'confusion');
 const redirected=fixture('double');redirected.sides.B.roster[1].volatiles.redirection={active:true,order:1};const foe=resolveMove(redirected,action('confuse-ray'),{nextRandom:()=>0});
 assert.equal(foe.battle.sides.B.roster[0].volatiles.confusion,undefined);assert.equal(foe.battle.sides.B.roster[1].volatiles.confusion.id,'confusion');
});

test('reapplying confusion fails without erasing Swagger stat changes',()=>{
 const battle=fixture();battle.sides.B.roster[0].volatiles.confusion={id:'confusion',timer:4};const result=resolveMove(battle,action('swagger'),{nextRandom:()=>0});
 assert.equal(result.battle.sides.B.roster[0].stages.atk,2);assert.equal(result.battle.sides.B.roster[0].volatiles.confusion.timer,4);assert.equal(result.events.at(-1).reason,'alreadyVolatile');
});

test('confusion timer reproduces one to four action checks before natural recovery',()=>{
 for(const [roll,checks] of [[0,1],[.34,2],[.67,3],[.99,4]]){
  let battle=applyVolatileStatus(fixture(),{actorId:'b1',targetId:'a1',moveId:'fixture',volatile:'confusion'},{nextRandom:()=>roll}).battle;
  for(let index=0;index<checks;index++){const result=tryVolatileAction(battle,{actorId:'a1'},{nextRandom:()=>.99});assert.equal(result.cancelled,false);assert.equal(result.events[0].kind,'volatileActivated');battle=result.battle;}
  const recovered=tryVolatileAction(battle,{actorId:'a1'},{nextRandom:()=>.99});assert.equal(recovered.cancelled,false);assert.equal(recovered.events[0].kind,'volatileEnded');assert.equal(recovered.battle.sides.A.roster[0].volatiles.confusion,undefined);
 }
});

test('confusion self-hit uses stage-aware power-40 damage and spends no PP',()=>{
 const battle=fixture();battle.sides.A.roster[0].stages.atk=2;battle.sides.A.roster[0].volatiles.confusion={id:'confusion',timer:3};const before=battle.sides.A.roster[0].pp.swagger;
 const result=resolveMove(battle,action('swagger'),{nextRandom:sequence(.329,0)}),self=result.battle.sides.A.roster[0];
 assert.equal(self.hp,129);assert.equal(self.pp.swagger,before);assert.equal(result.events.find(event=>event.kind==='damage').amount,31);assert.equal(result.events.at(-1).kind,'actionPrevented');
});

test('sleep and freeze gate before flinch, while confusion gates before paralysis',()=>{
 const sleeping=fixture();sleeping.sides.A.roster[0].status={id:'sleep',turnsRemaining:1};sleeping.sides.A.roster[0].volatiles={flinch:{id:'flinch',timer:1},confusion:{id:'confusion',timer:4}};
 const sleepResult=tryBeforeMoveConditions(sleeping,{actorId:'a1'},{nextRandom:()=>0});assert.equal(sleepResult.events[0].status,'sleep');assert.equal(sleepResult.battle.sides.A.roster[0].volatiles.confusion.timer,4);assert.ok(sleepResult.battle.sides.A.roster[0].volatiles.flinch);
 const confused=fixture();confused.sides.A.roster[0].status={id:'paralysis'};confused.sides.A.roster[0].volatiles.confusion={id:'confusion',timer:3};const rolls=sequence(.1,0,.1),confusionResult=tryBeforeMoveConditions(confused,{actorId:'a1'},{nextRandom:rolls});
 assert.equal(confusionResult.events.at(-1).status,'confusion');assert.equal(rolls.count(),2);
});

test('flinch is consumed before action or expires at end turn',()=>{
 const applied=applyVolatileStatus(fixture(),{actorId:'b1',targetId:'a1',moveId:'fixture',volatile:'flinch'}).battle,before=applied.sides.A.roster[0].pp['confuse-ray'];
 const blocked=resolveMove(applied,action('confuse-ray'),{nextRandom:()=>0});assert.equal(blocked.events[0].volatile,'flinch');assert.equal(blocked.battle.sides.A.roster[0].pp['confuse-ray'],before);assert.equal(blocked.battle.sides.A.roster[0].volatiles.flinch,undefined);
 const stale=applyVolatileStatus(fixture(),{actorId:'b1',targetId:'a1',moveId:'fixture',volatile:'flinch'}).battle;stale.phase='END_TURN';const ended=resolveEndTurn(stale,[]);assert.equal(ended.battle.sides.A.roster[0].volatiles.flinch,undefined);
});

test('volatile status resolution is byte-identical for the same seeded rolls',()=>{
 const run=()=>resolveMove(fixture('double'),action('swagger'),{nextRandom:sequence(.2,.7)});assert.deepEqual(run(),run());
});
