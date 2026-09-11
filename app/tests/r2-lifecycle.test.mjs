import test from 'node:test';
import assert from 'node:assert/strict';
import {
 applyHpGroup,applyReplacements,applySwitch,buildTurnQueue,completeEntry,createBattleSnapshot,legalTargets,
 replayBattle,resolveActionQueue,resolveEndTurn,resolveTargets,
 unitById,validateBattleSnapshot,validateReplacements,validateTurnActions,verifyDeterministicReplay
} from '../rules-v3/index.mjs';

const unit=(actorId,hp=100)=>({actorId,hp,maxHp:100,speed:100,volatiles:{},stages:{atk:0,def:0,spa:0,spd:0,spe:0}});
function fixture({phase='RESOLVE',activeCount=2}={}){
 const a=[unit('a1'),unit('a2'),unit('a3'),unit('a4')],b=[unit('b1'),unit('b2'),unit('b3'),unit('b4')];
 return {id:'r2-fixture',rulesVersion:'champions-r2.0.0',catalogVersion:'fixture-1',format:activeCount===1?'single':'double',phase,phaseRevision:1,turn:1,activeCount,rngState:17,eventSequence:0,events:[],result:null,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}

const handlers={
 move(battle,action){
  const applied=applyHpGroup(battle,[{actorId:action.targetId,delta:-action.damage}],action.moveId);
  return {battle:applied.battle,events:[{kind:'moveStarted',actorId:action.actorId,moveId:action.moveId},...applied.events]};
 }
};

test('battle snapshot pins rules and catalog versions at preview lock',()=>{
 const source=fixture({activeCount:1}),snapshot=createBattleSnapshot({id:source.id,rulesVersion:source.rulesVersion,catalogVersion:source.catalogVersion,format:'single',seed:source.rngState,sides:source.sides});
 assert.equal(snapshot.phase,'ENTRY');assert.deepEqual(validateBattleSnapshot(snapshot),[]);
 const broken=structuredClone(snapshot);broken.catalogVersion='';broken.sides.B.active=['missing'];
 assert.deepEqual(validateBattleSnapshot(broken),['catalogVersion is required','B has invalid active actors']);
});

test('target discovery excludes fainted slots and redirects eligible single targets',()=>{
 const battle=fixture();battle.sides.B.roster[1].volatiles.redirection={active:true,order:7};
 const request={side:'A',actorId:'a1',targetMode:'adjacentFoe',target:{side:'B',slot:0}};
 assert.deepEqual(resolveTargets(battle,request),[{side:'B',slot:1,actorId:'b2'}]);
 assert.deepEqual(resolveTargets(battle,request,{redirectable:false}),[{side:'B',slot:0,actorId:'b1'}]);
 assert.deepEqual(resolveTargets(battle,{...request,targetMode:'allAdjacentFoes'}).map(target=>target.actorId),['b1','b2']);
 battle.sides.B.roster[1].hp=0;
 assert.deepEqual(resolveTargets(battle,request),[{side:'B',slot:0,actorId:'b1'}]);
 assert.deepEqual(legalTargets(battle,{side:'A',actorId:'a1',targetMode:'adjacentFoe'}).map(target=>target.actorId),['b1']);
});

test('seeded queue order is independent from submitted array order',()=>{
 const actions=[{side:'A',actorId:'a1',kind:'move',speed:100},{side:'B',actorId:'b1',kind:'move',speed:100}];
 const first=buildTurnQueue(actions,23),second=buildTurnQueue([...actions].reverse(),23);
 assert.deepEqual(first,second);
 assert.deepEqual(first.actions.map(action=>action.actorId),['b1','a1']);
});

test('action resolution cancels a fainted actor and never mutates its input',()=>{
 const battle=fixture({activeCount:1}),before=JSON.stringify(battle);
 const actions=[
  {side:'A',actorId:'a1',kind:'move',moveId:'knockout',targetId:'b1',damage:100,speed:150},
  {side:'B',actorId:'b1',kind:'move',moveId:'late-hit',targetId:'a1',damage:40,speed:50}
 ];
 const result=resolveActionQueue(battle,actions,handlers);
 assert.equal(result.ok,true);assert.equal(JSON.stringify(battle),before);
 assert.equal(result.battle.sides.A.roster[0].hp,100);
 assert.equal(result.events.some(event=>event.kind==='actionCancelled'&&event.actorId==='b1'),true);
 assert.equal(result.battle.phase,'END_TURN');
 assert.equal(validateTurnActions(battle,[actions[0],actions[0]]).code,'INVALID_ACTOR');
});

test('switches and Mega transformations precede dynamically reordered moves',()=>{
 const battle=fixture();battle.sides.A.roster[0].speed=100;battle.sides.A.roster[1].speed=50;battle.sides.B.roster[0].speed=110;battle.sides.B.roster[1].speed=120;
 const dynamicHandlers={
  switch(state,action){return applySwitch(state,action.side,action.actorId,action.toId);},
  mega(state,action){const next=structuredClone(state),actor=unitById(next,action.actorId);actor.speed=action.actorId==='a1'?150:80;return {battle:next,events:[{kind:'megaEvolved',actorId:action.actorId}]};},
  move(state,action){return {battle:structuredClone(state),events:[{kind:'moveStarted',actorId:action.actorId,moveId:action.moveId}]};}
 };
 const actions=[
  {side:'A',actorId:'a1',kind:'move',moveId:'a-hit',mega:true,speed:100},{side:'A',actorId:'a2',kind:'switch',toId:'a3',speed:50},
  {side:'B',actorId:'b1',kind:'move',moveId:'b-hit',mega:true,speed:110},{side:'B',actorId:'b2',kind:'switch',toId:'b3',speed:120}
 ];
 const result=resolveActionQueue(battle,actions,dynamicHandlers,{getSpeed:(state,action)=>unitById(state,action.actorId).speed});
 assert.deepEqual(result.queue.map(action=>`${action.kind}:${action.actorId}`),['switch:b2','switch:a2','mega:b1','mega:a1','move:a1','move:b1']);
 assert.deepEqual(result.events.filter(event=>['switchOut','megaEvolved','moveStarted'].includes(event.kind)).map(event=>`${event.kind}:${event.actorId}`),['switchOut:b2','switchOut:a2','megaEvolved:b1','megaEvolved:a1','moveStarted:a1','moveStarted:b1']);
});

test('speed changes during the move phase reorder actors that have not acted',()=>{
 const battle=fixture();battle.sides.A.roster[0].speed=150;battle.sides.A.roster[1].speed=80;battle.sides.B.roster[0].speed=120;battle.sides.B.roster[1].speed=60;
 const dynamicHandlers={move(state,action){const next=structuredClone(state);if(action.moveId==='boost-ally')unitById(next,'a2').speed=200;return {battle:next,events:[{kind:'moveStarted',actorId:action.actorId,moveId:action.moveId}]};}};
 const actions=[
  {side:'A',actorId:'a1',kind:'move',moveId:'boost-ally',speed:150},{side:'A',actorId:'a2',kind:'move',moveId:'a2-hit',speed:80},
  {side:'B',actorId:'b1',kind:'move',moveId:'b1-hit',speed:120},{side:'B',actorId:'b2',kind:'move',moveId:'b2-hit',speed:60}
 ];
 const result=resolveActionQueue(battle,actions,dynamicHandlers,{getSpeed:(state,action)=>unitById(state,action.actorId).speed});
 assert.deepEqual(result.queue.map(action=>action.actorId),['a1','a2','b1','b2']);
});

test('end-turn groups can draw simultaneously and clear temporary redirection',()=>{
 const battle=fixture({phase:'END_TURN',activeCount:1});
 battle.sides.A.roster.forEach((entry,index)=>entry.hp=index?0:10);battle.sides.B.roster.forEach((entry,index)=>entry.hp=index?0:10);
 battle.sides.A.roster[0].volatiles.redirection={active:true,order:1};
 const result=resolveEndTurn(battle,[{id:'major-status',changes:[{actorId:'a1',delta:-10},{actorId:'b1',delta:-10}]}]);
 assert.equal(result.battle.phase,'FINISHED');assert.equal(result.battle.result.winner,null);assert.equal(result.battle.result.reason,'draw-ko');
 assert.equal(result.battle.sides.A.roster[0].volatiles.redirection,undefined);
 assert.equal(result.events.filter(event=>event.kind==='battleEnded').length,1);
});

test('replacement window requires exact unique reserves before entry completes',()=>{
 const battle=fixture({phase:'REPLACE'});battle.sides.A.roster[0].hp=0;battle.sides.A.roster[1].hp=0;battle.sides.B.roster[0].hp=0;
 assert.equal(validateReplacements(battle,'A',[{slot:0,actorId:'a3'},{slot:1,actorId:'a3'}]).code,'INVALID_REPLACEMENT');
 const result=applyReplacements(battle,{A:[{slot:0,actorId:'a3'},{slot:1,actorId:'a4'}],B:[{slot:0,actorId:'b3'}]});
 assert.equal(result.ok,true);assert.deepEqual(result.battle.sides.A.active,['a3','a4']);assert.equal(result.battle.phase,'ENTRY');assert.equal(result.battle.turn,2);
 const entered=completeEntry(result.battle,[{kind:'entryResolved',actorId:'a3'}]);assert.equal(entered.battle.phase,'COMMAND');
});

test('same seed and command stream produce byte-identical state, events and replay',()=>{
 const initial=fixture({activeCount:1}),before=JSON.stringify(initial);
 const commands=[
  {kind:'turn',actions:[{side:'B',actorId:'b1',kind:'move',moveId:'late-hit',targetId:'a1',damage:25,speed:50},{side:'A',actorId:'a1',kind:'move',moveId:'knockout',targetId:'b1',damage:100,speed:150}]},
  {kind:'endTurn',groups:[]},
  {kind:'replacements',choices:{A:[],B:[{slot:0,actorId:'b2'}]}},
  {kind:'entry',events:[{kind:'entryResolved',actorId:'b2'}]}
 ];
 const replay=verifyDeterministicReplay(initial,commands,{handlers});
 assert.equal(JSON.stringify(initial),before);assert.equal(replay.battle.phase,'COMMAND');assert.equal(replay.battle.turn,2);
 assert.deepEqual(replayBattle(initial,commands,{handlers}),replay);
 assert.deepEqual(replay.events.map(event=>event.id),replay.events.map((_,index)=>`r2-fixture:event:${index+1}`));
});
