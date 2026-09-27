import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const moveCatalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifestCatalog=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['frustration','hidden-power','natural-gift','pursuit','return','secret-power','snatch','telekinesis'],allMoves=Object.fromEntries(moveCatalog.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const registry=createHookRegistry(HANDLER_DEFINITIONS),resolveMove=createMoveActionHandler({moves:allMoves,manifests:manifestCatalog.moves,registry}),validateAction=createMoveChoiceValidator({moves:allMoves,manifests:manifestCatalog.moves});
const unit=(actorId)=>({actorId,speciesId:'pikachu',types:['electric'],hp:300,maxHp:300,stats:{hp:300,atk:100,def:100,spa:100,spd:100,spe:100},stages:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0},status:null,volatiles:{},pp:Object.fromEntries(ids.map(id=>[id,10])),maxPp:Object.fromEntries(ids.map(id=>[id,10])),passiveEffects:[],buildSnapshot:{moveIds:[...ids],abilityId:null,itemId:null}});
const fixture=(format='single')=>{const n=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`wave48-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:90,activeCount:n,rngState:48,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};};
const action=id=>({kind:'move',side:'A',actorId:'a1',moveId:id,target:{side:'B',slot:0},priority:manifestCatalog.moves[id].priority,speed:100});

test('r3-move-hooks-wave48:single/double promotes all Champions-unusable moves with explicit evidence',()=>{for(const id of ids){assert.equal(manifestCatalog.moves[id].unusable,true,id);assert.deepEqual(manifestCatalog.moves[id].testEvidence,{single:['r3-move-hooks-wave48:single'],double:['r3-move-hooks-wave48:double']},id);}});

test('all eight unavailable Champions moves are rejected at authoritative choice validation without spending PP',()=>{for(const format of ['single','double'])for(const id of ids){const battle=fixture(format),before=battle.sides.A.roster[0].pp[id],choice=validateAction(battle,action(id));assert.equal(choice.ok,false,id);assert.equal(choice.code,'MOVE_UNUSABLE',id);assert.equal(battle.sides.A.roster[0].pp[id],before,id);}});

test('direct resolver safety also rejects unusable moves before PP or move-history mutation',()=>{for(const id of ids){const battle=fixture(),result=resolveMove(battle,action(id),{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].pp[id],10,id);assert.equal(result.battle.sides.A.roster[0].lastMoveId,undefined,id);assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.moveId===id&&event.reason==='moveUnusable'),id);}});
