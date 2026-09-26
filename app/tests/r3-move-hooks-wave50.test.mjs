import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['tera-blast'];
const moves=Object.fromEntries(catalog.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,moveIds=ids)=>({actorId,speciesId:'venusaur',baseSpeciesId:'venusaur',types:['grass','poison'],level:50,hp:300,maxHp:300,stats:{hp:300,atk:120,def:120,spa:120,spd:120,spe:100},stages:stages(),status:null,volatiles:{},pp:Object.fromEntries(moveIds.map(id=>[id,10])),maxPp:Object.fromEntries(moveIds.map(id=>[id,10])),passiveEffects:[],abilityState:{},buildSnapshot:{moveIds:[...moveIds],abilityId:null,itemId:null}});
function fixture(format='single'){const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1',[]),unit('b2',[])];return {id:`wave50-${format}`,format,level:50,phase:'RESOLVE',turn:50,activeCount:n,rngState:50,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};}
const action=id=>({kind:'move',side:'A',actorId:'a1',moveId:id,target:{side:'B',slot:0},priority:0,speed:100});
const runtime={nextRandom:()=>.99,hasActed:()=>false,willMove:()=>true};

test('r3-move-hooks-wave50:single/double keeps Tera Blast fail-closed while Terastallization is unavailable in Champions',()=>{for(const id of ids){assert.equal(manifests.moves[id].unusable,true,id);assert.deepEqual(manifests.moves[id].handlers,[{id:'reject-unusable-move',hook:'onTryMove',order:1}],id);assert.deepEqual(manifests.moves[id].testEvidence,{single:['r3-move-hooks-wave50:single'],double:['r3-move-hooks-wave50:double']},id);}});

test('wave50 Tera Blast fail-closed rejection remains deterministic in both battle formats',()=>{for(const format of ['single','double'])for(const id of ids){const before=fixture(format),pp=before.sides.A.roster[0].pp[id],result=resolveMove(before,action(id),runtime);assert.equal(result.battle.sides.A.roster[0].pp[id],pp,id);assert.equal(result.battle.sides.B.roster[0].hp,300,id);assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.moveId===id),id);}});
