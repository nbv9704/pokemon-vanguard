import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMechanicsCoverage,createHookRegistry,dispatchHook,validateManifestCatalog,validateMechanicManifest} from '../mechanics-v3/index.mjs';

const battle={id:'hook-fixture',turn:1,events:[]};
const pureHandler=(id,hooks,operation)=>({id,hooks,run({battle,payload,params}){return {battle:structuredClone(battle),payload:{...payload,value:operation(payload.value,params.value)},events:[{kind:'handlerRan',handlerId:id}]};}});

test('hook dispatcher runs stable order and returns trace without mutating input',()=>{
 const registry=createHookRegistry([pureHandler('add',['modifyDamage'],(value,amount)=>value+amount),pureHandler('multiply',['modifyDamage'],(value,amount)=>value*amount)]),before=JSON.stringify(battle);
 const result=dispatchHook(registry,{hook:'modifyDamage',battle,payload:{value:10},invocations:[{id:'multiply',hook:'modifyDamage',order:20,params:{value:3}},{id:'add',hook:'modifyDamage',order:10,params:{value:2}}]});
 assert.equal(result.payload.value,36);assert.equal(JSON.stringify(battle),before);
 assert.deepEqual(result.trace.map(entry=>entry.id),['add','multiply']);
 assert.deepEqual(result.events.map(entry=>entry.handlerId),['add','multiply']);
});

test('registry rejects unknown hooks, duplicate handlers and input mutation',()=>{
 assert.throws(()=>createHookRegistry([pureHandler('same',['onMove'],value=>value),pureHandler('same',['onMove'],value=>value)]),/duplicate handler/);
 const mutating=createHookRegistry([{id:'mutate',hooks:['onMove'],run({battle,payload}){battle.turn++;return {battle,payload,events:[]};}}]);
 assert.throws(()=>dispatchHook(mutating,{hook:'onMove',battle,payload:{},invocations:[{id:'mutate',hook:'onMove',order:1}]}),/mutated its input/);
 assert.throws(()=>dispatchHook(createHookRegistry(),{hook:'onMove',battle,payload:{},invocations:[{id:'missing',hook:'onMove',order:1}]}),/unregistered handler/);
});

test('manifest validation requires move targeting, handler order and format evidence arrays',()=>{
 const manifest={id:'tackle',targetMode:'adjacentFoe',priority:0,contact:true,handlers:[{id:'direct-damage',hook:'onMove',order:100}],testEvidence:{single:[],double:[]}};
 assert.deepEqual(validateMechanicManifest(manifest,'moves'),[]);
 assert.match(validateMechanicManifest({...manifest,targetMode:null},'moves').join('\n'),/targetMode/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'x',hook:'unknown'}]},'moves').join('\n'),/unknown hook/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'apply-stat-stages',hook:'onMove',order:10,params:{boosts:{luck:2}}}]},'moves').join('\n'),/unknown battle stage: luck/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'apply-stat-stages',hook:'onMove',order:10,params:{boosts:{atk:0}}}]},'moves').join('\n'),/invalid stage delta for atk/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'apply-major-status',hook:'onMove',order:10,params:{status:'fear'}}]},'moves').join('\n'),/unsupported major status: fear/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'apply-major-status',hook:'onMove',order:10,params:{status:'burn',blockedTargetTypes:['fire','fire']}}]},'moves').join('\n'),/blockedTargetTypes/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'deal-multi-hit-damage',hook:'onMove',order:10,params:{hits:[3,5]}}]},'moves').join('\n'),/multi-hit/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'apply-recoil',hook:'onMove',order:10,params:{numerator:2,denominator:1}}]},'moves').join('\n'),/positive fraction/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'deal-fixed-damage',hook:'onMove',order:10,params:{formula:'target-current-fraction',denominator:1}}]},'moves').join('\n'),/denominator/);
 assert.match(validateMechanicManifest({...manifest,handlers:[{id:'deal-variable-power-damage',hook:'onMove',order:10,params:{formula:'unknown'}}]},'moves').join('\n'),/variable-power/);
});

test('coverage derives support and machine-readable block reasons',()=>{
 const move={id:'tackle',name:'Tackle'},ability={id:'adaptability',name:'Adaptability'},item={id:'air-balloon',name:'Air Balloon'};
 const manifests={schemaVersion:1,moves:{tackle:{id:'tackle',targetMode:'adjacentFoe',priority:0,contact:true,handlers:[{id:'direct-damage',hook:'onMove',order:100}],testEvidence:{single:['tackle-single'],double:['tackle-double']}}},abilities:{adaptability:{id:'adaptability',handlers:[{id:'adaptability-stab',hook:'modifyDamage',order:40}],testEvidence:{single:['adaptability-single'],double:[]}}},items:{}};
 const evidence=['tackle-single','tackle-double','adaptability-single'];
 const coverage=buildMechanicsCoverage({moves:[move],abilities:[ability],items:[item]},manifests,['direct-damage','adaptability-stab'],evidence);
 assert.deepEqual(coverage.summary.single,{supported:2,blocked:1});assert.deepEqual(coverage.summary.double,{supported:1,blocked:2});
 assert.equal(coverage.entries.find(entry=>entry.id==='adaptability').formats.double.reason,'missing-test-evidence');
 assert.equal(coverage.entries.find(entry=>entry.id==='air-balloon').formats.single.reason,'missing-manifest');
 const missing=buildMechanicsCoverage({moves:[move],abilities:[],items:[]},{schemaVersion:1,moves:manifests.moves,abilities:{},items:{}},[],evidence);
 assert.equal(missing.entries[0].formats.single.reason,'missing-handler:direct-damage');
 const stale=buildMechanicsCoverage({moves:[move],abilities:[],items:[]},{schemaVersion:1,moves:manifests.moves,abilities:{},items:{}},['direct-damage'],[]);
 assert.equal(stale.entries[0].formats.single.reason,'unknown-test-evidence:tackle-single');
});

test('manifest catalog rejects stale keys and key/id mismatches',()=>{
 const catalog={moves:[{id:'tackle'}],abilities:[],items:[]},manifests={schemaVersion:1,moves:{unknown:{id:'tackle'}},abilities:{},items:{}};
 assert.deepEqual(validateManifestCatalog(catalog,manifests),['moves manifest references unknown id unknown','moves manifest key/id mismatch for unknown']);
});
