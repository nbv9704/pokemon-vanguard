import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,variableMovePower} from '../mechanics-v3/index.mjs';
import {recordTurnEvents} from '../mechanics-v3/turn-history.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['assurance','avalanche','payback','lash-out','retaliate','stomping-tantrum','temper-flare','alluring-voice','burning-jealousy'];
const byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const registry=createHookRegistry(HANDLER_DEFINITIONS),resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry});
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,24]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:4000,maxHp:4000,stats:{hp:4000,atk:220,def:180,spa:220,spd:180,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null,moveIds:ids},itemState:createHeldItemState(null),...overrides});
function fixture(format='double'){const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`wave31-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:2,activeCount:n,rngState:31,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};}
const action=(moveId,actorId='a1',target={side:'B',slot:0})=>({kind:'move',side:'A',actorId,moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const runtime={nextRandom:()=>.5,hasActed:()=>false,willMove:()=>false};
const evidence={single:['r3-move-hooks-wave31:single'],double:['r3-move-hooks-wave31:double']};

test('r3-move-hooks-wave31:single promotes nine turn-history moves with audited metadata',()=>{
 for(const id of ids){assert.ok(manifests.moves[id],id);assert.deepEqual(manifests.moves[id].testEvidence,evidence,id);}
 assert.equal(manifests.moves.avalanche.priority,-4);assert.equal(manifests.moves['alluring-voice'].tags.includes('sound'),true);assert.equal(manifests.moves['burning-jealousy'].targetMode,'allAdjacentFoes');
});

test('r3-move-hooks-wave31:double shares same-turn damage history across actors for Assurance',()=>{
 let battle=fixture('double');
 const first=resolveMove(battle,action('assurance','a1'),runtime),firstDamage=first.events.find(e=>e.kind==='damage'&&e.moveId==='assurance').amount;
 battle=first.battle;const second=resolveMove(battle,action('assurance','a2'),runtime),secondDamage=second.events.find(e=>e.kind==='damage'&&e.moveId==='assurance').amount;
 assert.ok(secondDamage>firstDamage*1.8,{firstDamage,secondDamage});assert.equal(second.battle.turnHistory.damaged.b1>0,true);
});

test('Avalanche, Payback, Lash Out and Retaliate read the intended turn/side history predicates',()=>{
 let battle=fixture();battle=recordTurnEvents(battle,[{kind:'damage',actorId:'b1',targetId:'a1',moveId:'probe',amount:25},{kind:'statStageChanged',actorId:'b1',targetId:'a1',stat:'atk',appliedDelta:-1}],{turn:2});battle.sides.A.lastFaintTurn=1;
 const actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];
 assert.equal(variableMovePower('target-damaged-user-this-turn',{battle,actor,target,basePower:60,runtime}),120);
 assert.equal(variableMovePower('target-acted-this-turn',{battle,actor,target,basePower:50,runtime:{hasActed:id=>id==='b1'}}),100);
 assert.equal(variableMovePower('user-stats-lowered-this-turn',{battle,actor,target,basePower:75,runtime}),150);
 assert.equal(variableMovePower('ally-fainted-previous-turn',{battle,actor,target,basePower:70,runtime}),140);
});

test('failed previous-turn move doubles Stomping Tantrum and Temper Flare, but Protect-style success does not',()=>{
 const battle=fixture(),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];actor.lastMoveOutcome={moveId:'probe',turn:1,result:false};
 assert.equal(variableMovePower('previous-move-failed',{battle,actor,target,basePower:75,runtime}),150);
 actor.lastMoveOutcome.result=true;assert.equal(variableMovePower('previous-move-failed',{battle,actor,target,basePower:75,runtime}),75);
});

test('Alluring Voice and Burning Jealousy apply their secondary only after the target raised stats this turn',()=>{
 let battle=fixture('double');
 let plain=resolveMove(battle,action('alluring-voice'),runtime);assert.equal(plain.battle.sides.B.roster[0].volatiles.confusion,undefined);
 battle=recordTurnEvents(battle,[{kind:'statStageChanged',actorId:'b1',targetId:'b1',stat:'atk',appliedDelta:1}],{turn:2});
 const voice=resolveMove(battle,action('alluring-voice'),runtime);assert.ok(voice.battle.sides.B.roster[0].volatiles.confusion);
 battle=fixture('double');battle=recordTurnEvents(battle,[{kind:'statStageChanged',actorId:'b1',targetId:'b1',stat:'spa',appliedDelta:1}],{turn:2});
 const jealousy=resolveMove(battle,action('burning-jealousy'),runtime);assert.equal(jealousy.battle.sides.B.roster[0].status?.id||jealousy.battle.sides.B.roster[0].status,'burn');assert.equal(jealousy.battle.sides.B.roster[1].status,null);
});


test('move-action stores failed-vs-successful previous-turn outcomes for Stomping Tantrum semantics',()=>{
 let battle=fixture('single');battle.turn=1;battle.sides.B.roster[0].types=['flying'];
 let failed=resolveMove(battle,action('stomping-tantrum'),runtime);assert.equal(failed.battle.sides.A.roster[0].lastMoveOutcome.result,false);
 battle=fixture('single');battle.turn=1;battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true};
 const blocked=resolveMove(battle,action('stomping-tantrum'),runtime);assert.equal(blocked.events.some(e=>e.kind==='moveBlocked'&&e.reason==='protect'),true);assert.equal(blocked.battle.sides.A.roster[0].lastMoveOutcome.result,true);
});
