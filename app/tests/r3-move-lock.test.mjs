import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySwitch,resolveEndTurn} from '../rules-v3/lifecycle.mjs';
import {resolveActionQueue,validateTurnActions} from '../rules-v3/turn-engine.mjs';
import {applyVolatileStatus,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,recordLastMove,tryBeforeMoveConditions,validateVolatileMoveChoice} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const moves={
 taunt:{id:'taunt',type:'dark',category:'status',power:null,accuracy:100},
 encore:{id:'encore',type:'normal',category:'status',power:null,accuracy:100},
 disable:{id:'disable',type:'normal',category:'status',power:null,accuracy:100},
 'confuse-ray':{id:'confuse-ray',type:'ghost',category:'status',power:null,accuracy:100},
 tackle:{id:'tackle',type:'normal',category:'physical',power:40,accuracy:100}
};
const pp=()=>Object.fromEntries(Object.keys(moves).map(id=>[id,20]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:pp(),status:null,volatiles:{},stages:stages(),lastMoveId:null});

function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`move-lock-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:7,eventSequence:0,events:[],result:null,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}

const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(side,actorId,moveId,target)=>({kind:'move',side,actorId,moveId,target});
const aAction=(moveId,target={side:'B',slot:0})=>action('A','a1',moveId,target);
const bAction=(moveId,target={side:'A',slot:0})=>action('B','b1',moveId,target);

test('r3-move-lock:single Taunt blocks status moves through legality and resolver gates',()=>{
 const taunted=resolveMove(fixture(),aAction('taunt'),{hasActed:()=>false,nextRandom:()=>.5}).battle,target=taunted.sides.B.roster[0],before=target.pp['confuse-ray'];
 assert.equal(target.volatiles.taunt.endTurnTimer,3);assert.deepEqual(validateVolatileMoveChoice(taunted,bAction('confuse-ray'),moves['confuse-ray']),{ok:false,code:'TAUNTED_STATUS_MOVE',volatile:'taunt'});
 const blocked=resolveMove(taunted,bAction('confuse-ray'),{nextRandom:()=>.5});assert.equal(blocked.events[0].reason,'TAUNTED_STATUS_MOVE');assert.equal(blocked.battle.sides.B.roster[0].pp['confuse-ray'],before);
 const commands=[{...aAction('tackle'),speed:100,priority:0},{...bAction('confuse-ray'),speed:100,priority:0}],validated=validateTurnActions(taunted,commands,{validateAction:createMoveChoiceValidator({moves})});assert.equal(validated.code,'TAUNTED_STATUS_MOVE');
 const attack=resolveMove(taunted,bAction('tackle'),{nextRandom:()=>.5});assert.equal(attack.events.some(event=>event.kind==='damage'),true);assert.equal(attack.battle.sides.B.roster[0].lastMoveId,'tackle');
});

test('last successful execution feeds Encore and forces exactly the bound move',()=>{
 const used=resolveMove(fixture(),bAction('tackle'),{nextRandom:()=>.5}).battle;assert.equal(used.sides.B.roster[0].lastMoveId,'tackle');
 const encored=resolveMove(used,aAction('encore'),{hasActed:()=>false,nextRandom:()=>.5}).battle,state=encored.sides.B.roster[0].volatiles.encore;assert.equal(state.moveId,'tackle');assert.equal(state.endTurnTimer,3);
 const wrong=resolveMove(encored,bAction('confuse-ray'),{nextRandom:()=>.5});assert.equal(wrong.events[0].reason,'ENCORED_MOVE_REQUIRED');assert.equal(wrong.battle.sides.B.roster[0].pp['confuse-ray'],20);
 const forced=resolveMove(encored,bAction('tackle'),{nextRandom:()=>.5});assert.equal(forced.events.some(event=>event.kind==='damage'),true);
});

test('Disable binds the last move and blocks only that move without spending PP',()=>{
 let battle=recordLastMove(fixture(),'b1','tackle');const disabled=resolveMove(battle,aAction('disable'),{hasActed:()=>false,nextRandom:()=>.5}).battle;assert.equal(disabled.sides.B.roster[0].volatiles.disable.moveId,'tackle');assert.equal(disabled.sides.B.roster[0].volatiles.disable.endTurnTimer,4);
 const before=disabled.sides.B.roster[0].pp.tackle,blocked=resolveMove(disabled,bAction('tackle'),{nextRandom:()=>.5});assert.equal(blocked.events[0].reason,'MOVE_DISABLED');assert.equal(blocked.battle.sides.B.roster[0].pp.tackle,before);
 const other=resolveMove(disabled,bAction('confuse-ray'),{nextRandom:()=>0});assert.equal(other.battle.sides.B.roster[0].lastMoveId,'confuse-ray');
});

test('Encore and Disable fail on missing, invalid or exhausted last moves',()=>{
 for(const [moveId,lastMoveId,remaining,reason] of [['encore',null,null,'noLastMove'],['encore','encore',20,'invalidLastMove'],['encore','tackle',0,'noLastMovePP'],['disable',null,null,'noLastMove'],['disable','struggle',20,'invalidLastMove']]){
  const battle=fixture(),target=battle.sides.B.roster[0];target.lastMoveId=lastMoveId;if(lastMoveId&&remaining!==null)target.pp[lastMoveId]=remaining;
  const result=resolveMove(battle,aAction(moveId),{nextRandom:()=>.5});assert.equal(result.events.at(-1).reason,reason,`${moveId}:${lastMoveId}`);assert.equal(result.battle.sides.B.roster[0].volatiles[moveId],undefined);
 }
});

test('r3-move-lock:double supports ally binding and foe redirection',()=>{
 const allyBattle=fixture('double');allyBattle.sides.A.roster[1].lastMoveId='tackle';const ally=resolveMove(allyBattle,aAction('encore',{side:'A',slot:1}),{hasActed:()=>false,nextRandom:()=>.5});assert.equal(ally.battle.sides.A.roster[1].volatiles.encore.moveId,'tackle');
 const foeBattle=fixture('double');foeBattle.sides.B.roster[0].lastMoveId='tackle';foeBattle.sides.B.roster[1].lastMoveId='confuse-ray';foeBattle.sides.B.roster[1].volatiles.redirection={active:true,order:1};
 const foe=resolveMove(foeBattle,aAction('disable'),{hasActed:()=>false,nextRandom:()=>.5});assert.equal(foe.battle.sides.B.roster[0].volatiles.disable,undefined);assert.equal(foe.battle.sides.B.roster[1].volatiles.disable.moveId,'confuse-ray');
});

test('duration accounts for whether the target already acted and expires at end turn',()=>{
 for(const [volatile,fresh,acted] of [['taunt',3,4],['encore',3,4],['disable',4,5]]){
  let base=fixture();base.sides.A.roster[0].lastMoveId='tackle';
  const before=applyVolatileStatus(base,{actorId:'b1',targetId:'a1',moveId:'fixture',volatile},{hasActed:()=>false}).battle,after=applyVolatileStatus(base,{actorId:'b1',targetId:'a1',moveId:'fixture',volatile},{hasActed:()=>true}).battle;
  assert.equal(before.sides.A.roster[0].volatiles[volatile].endTurnTimer,fresh);assert.equal(after.sides.A.roster[0].volatiles[volatile].endTurnTimer,acted);
  let ticking=before;for(let turn=0;turn<fresh;turn++){ticking.phase='END_TURN';ticking=resolveEndTurn(ticking,[]).battle;}
  assert.equal(ticking.sides.A.roster[0].volatiles[volatile],undefined);
 }
});

test('turn engine supplies acted-state so Taunt duration matches action order',()=>{
 const run=(tauntSpeed,tackleSpeed)=>resolveActionQueue(fixture(),[{...aAction('taunt'),speed:tauntSpeed,priority:0},{...bAction('tackle'),speed:tackleSpeed,priority:0}],{move:resolveMove});
 assert.equal(run(200,100).battle.sides.B.roster[0].volatiles.taunt.endTurnTimer,3);
 assert.equal(run(100,200).battle.sides.B.roster[0].volatiles.taunt.endTurnTimer,4);
});

test('Encore expires at end turn when its bound move runs out of PP',()=>{
 const battle=fixture();battle.phase='END_TURN';battle.sides.A.roster[0].pp.tackle=0;battle.sides.A.roster[0].volatiles.encore={id:'encore',moveId:'tackle',endTurnTimer:3,endsWhenMoveHasNoPp:true};
 assert.equal(validateVolatileMoveChoice(battle,aAction('confuse-ray'),moves['confuse-ray']).ok,true);
 const result=resolveEndTurn(battle,[]);assert.equal(result.battle.sides.A.roster[0].volatiles.encore,undefined);assert.equal(result.events.find(event=>event.volatile==='encore').reason,'noPP');
});

test('sleep and flinch gate before move locks, which gate before confusion',()=>{
 const move=moves['confuse-ray'],sleeping=fixture();sleeping.sides.A.roster[0].status={id:'sleep',turnsRemaining:1};sleeping.sides.A.roster[0].volatiles={disable:{id:'disable',moveId:'confuse-ray',endTurnTimer:4},confusion:{id:'confusion',timer:4}};
 const sleep=tryBeforeMoveConditions(sleeping,aAction('confuse-ray'),{nextRandom:()=>0},move);assert.equal(sleep.events[0].status,'sleep');assert.equal(sleep.battle.sides.A.roster[0].volatiles.confusion.timer,4);
 const flinching=fixture();flinching.sides.A.roster[0].volatiles={flinch:{id:'flinch'},disable:{id:'disable',moveId:'confuse-ray',endTurnTimer:4},confusion:{id:'confusion',timer:4}};const flinch=tryBeforeMoveConditions(flinching,aAction('confuse-ray'),{nextRandom:()=>0},move);assert.equal(flinch.events[0].volatile,'flinch');assert.equal(flinch.battle.sides.A.roster[0].volatiles.confusion.timer,4);
 const restricted=fixture();restricted.sides.A.roster[0].volatiles={disable:{id:'disable',moveId:'confuse-ray',endTurnTimer:4},confusion:{id:'confusion',timer:4}};const lock=tryBeforeMoveConditions(restricted,aAction('confuse-ray'),{nextRandom:()=>0},move);assert.equal(lock.events[0].status,'disable');assert.equal(lock.battle.sides.A.roster[0].volatiles.confusion.timer,4);
});

test('switch clears move locks and seeded move-lock resolution is deterministic',()=>{
 const battle=fixture();battle.sides.A.roster[0].volatiles.taunt={id:'taunt',endTurnTimer:3};const switched=applySwitch(battle,'A','a1','a2');assert.equal(switched.battle.sides.A.roster[0].volatiles.taunt,undefined);
 const run=()=>{const base=fixture('double');base.sides.B.roster[0].lastMoveId='tackle';return resolveMove(base,aAction('encore'),{hasActed:()=>false,nextRandom:()=>.5});};assert.deepEqual(run(),run());
});
