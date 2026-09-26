import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,prepareBindingResidualEndTurn,validateVolatileSwitchChoice} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,itemId=null)=>({actorId,speciesId:actorId,types:['normal'],hp:480,maxHp:480,stats:{hp:480,atk:100,def:100,spa:100,spd:100,spe:100},pp:{},maxPp:{},status:null,volatiles:{},stages:stages(),passiveEffects:itemId?compilePassiveEffects({itemId,manifests}):[],abilityState:{},buildSnapshot:{abilityId:null,itemId,moveIds:[]},itemState:createHeldItemState(itemId)});
function fixture(itemId=null){const a1=unit('a1',itemId),a2=unit('a2'),b1=unit('b1'),b2=unit('b2');return {id:'item-wave8',format:'single',level:50,phase:'END_TURN',phaseRevision:1,turn:3,activeCount:1,rngState:8,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:['a1'],roster:[a1,a2],conditions:{}},B:{active:['b1'],roster:[b1,b2],conditions:{}}}};}
const evidence={single:['r3-item-lifecycle-wave8:single'],double:['r3-item-lifecycle-wave8:double']};

test('r3-item-lifecycle-wave8 manifests keep Binding Band and Shed Shell evidence stable after later item promotion',()=>{
 for(const id of ['binding-band','shed-shell']){assert.ok(manifests.items[id]);assert.deepEqual(manifests.items[id].testEvidence,evidence);}
 assert.equal(manifests.items['eject-button']?.handlers?.[0]?.id,'item-holder-switch');
});

test('Binding Band raises live binding residual from 1/8 to 1/6 and obeys Magic Room suppression',()=>{
 let battle=fixture('binding-band');battle.sides.B.roster[0].volatiles.bound={id:'bound',sourceActorId:'a1',sourceId:'bind',trapsSwitch:true,residualNumerator:1,residualDenominator:8};
 let result=prepareBindingResidualEndTurn(battle);assert.deepEqual(result.group.changes,[{actorId:'b1',delta:-80}]);
 battle.field.rooms={'magic-room':{id:'magic-room',remaining:3}};result=prepareBindingResidualEndTurn(battle);assert.deepEqual(result.group.changes,[{actorId:'b1',delta:-60}]);
});

test('Shed Shell bypasses active bound/trapped switch locks but not Ingrain, and Magic Room disables escape',()=>{
 let battle=fixture('shed-shell'),holder=battle.sides.A.roster[0];holder.volatiles.bound={id:'bound',sourceActorId:'b1',sourceId:'bind',trapsSwitch:true};
 const action={kind:'switch',side:'A',actorId:'a1',toId:'a2'};assert.equal(validateVolatileSwitchChoice(battle,action).ok,true);
 holder.volatiles.ingrain={id:'ingrain',sourceId:'ingrain'};assert.equal(validateVolatileSwitchChoice(battle,action).code,'INGRAIN_SWITCH_BLOCKED');delete holder.volatiles.ingrain;
 battle.field.rooms={'magic-room':{id:'magic-room',remaining:3}};assert.equal(validateVolatileSwitchChoice(battle,action).code,'BOUND_SWITCH_BLOCKED');
});
