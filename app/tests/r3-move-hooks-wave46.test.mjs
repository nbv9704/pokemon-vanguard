import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyProtect,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['dragon-darts'],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves={['dragon-darts']:byId['dragon-darts']};
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1400,maxHp:1400,stats:{hp:1400,atk:240,def:180,spa:180,spd:180,spe:100},pp:{'dragon-darts':20},maxPp:{'dragon-darts':20},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null,moveIds:ids},itemState:createHeldItemState(null),...overrides});
function fixture(format='double'){const n=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`wave46-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:81,activeCount:n,rngState:46,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};}
const action=(targetSlot=0)=>({kind:'move',side:'A',actorId:'a1',moveId:'dragon-darts',target:{side:'B',slot:targetSlot},moveType:'dragon',moveCategory:'physical',priority:0,speed:100});const runtime={nextRandom:()=>0,hasActed:()=>false,willMove:()=>true};

test('r3-move-hooks-wave46:single/double promotes Dragon Darts with smart-split evidence',()=>{assert.deepEqual(manifests.moves['dragon-darts'].testEvidence,{single:['r3-move-hooks-wave46:single'],double:['r3-move-hooks-wave46:double']});assert.equal(manifests.moves['dragon-darts'].handlers.find(x=>x.id==='check-accuracy').params.smartSplit,true);});

test('Dragon Darts hits one target twice in singles',()=>{const battle=fixture('single'),result=resolveMove(battle,action(),runtime),hits=result.events.filter(e=>e.kind==='damage'&&e.moveId==='dragon-darts');assert.equal(hits.length,2);assert.deepEqual(hits.map(e=>e.targetId),['b1','b1']);assert.equal(result.events.find(e=>e.kind==='hitCount').hitCount,2);});

test('Dragon Darts hits each living foe once in doubles',()=>{const battle=fixture('double'),result=resolveMove(battle,action(),runtime),hits=result.events.filter(e=>e.kind==='damage'&&e.moveId==='dragon-darts');assert.equal(hits.length,2);assert.deepEqual(new Set(hits.map(e=>e.targetId)),new Set(['b1','b2']));assert.deepEqual(result.events.filter(e=>e.kind==='hitCount').map(e=>e.hitCount),[1,1]);});

test('Dragon Darts does not redirect the second dart onto the unprotected foe when one smart target Protects',()=>{let battle=fixture('double');battle=applyProtect(battle,{actorId:'b2',moveId:'protect'}).battle;const result=resolveMove(battle,action(),runtime),hits=result.events.filter(e=>e.kind==='damage'&&e.moveId==='dragon-darts');assert.equal(hits.length,1);assert.equal(hits[0].targetId,'b1');assert.ok(result.events.some(e=>e.kind==='moveBlocked'&&e.targetId==='b2'));});
