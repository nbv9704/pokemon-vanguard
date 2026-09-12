import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMoveCapabilityInventory,reviewSignalsForMove} from '../mechanics-v3/capability-inventory.mjs';

test('capability inventory separates trusted manifests from description-only research signals',()=>{
 const moves=[
  {id:'tackle',name:'Tackle',type:'normal',category:'physical',power:40,accuracy:100,maxPP:20,description:'A physical attack.'},
  {id:'agility',name:'Agility',type:'psychic',category:'status',power:null,accuracy:null,maxPP:20,description:'This sharply boosts Speed.'},
  {id:'mystery',name:'Mystery',type:'ghost',category:'status',power:null,accuracy:null,maxPP:5,description:'This poisons the target and changes the weather.'}
 ],manifests={tackle:{handlers:[{id:'spend-pp'},{id:'deal-direct-damage'}]}};
 const inventory=buildMoveCapabilityInventory(moves,manifests),tackle=inventory.entries.find(entry=>entry.id==='tackle'),mystery=inventory.entries.find(entry=>entry.id==='mystery');
 assert.equal(inventory.summary.total,3);assert.equal(inventory.summary.manifestReviewed,1);assert.equal(inventory.summary.manualReview,2);
 assert.equal(tackle.primaryQueue,'manifest-reviewed');assert.deepEqual(tackle.declaredHandlers,['spend-pp','deal-direct-damage']);
 assert.deepEqual(mystery.reviewSignals,['major-status','weather']);assert.equal(mystery.trustedMechanics,false);
 assert.deepEqual(inventory.policy,{descriptionSignals:'research-queue-only',changesImplementation:false,changesLegality:false});
});

test('review signals never infer an executable handler or implementation state',()=>{
 const signals=reviewSignalsForMove({description:'Always goes first, sharply raises Attack, and burns the target.'});
 assert.deepEqual(signals,['stat-stages','major-status','priority-order']);
 const entry=buildMoveCapabilityInventory([{id:'signal-only',name:'Signal Only',type:'fire',category:'status',power:null,accuracy:100,maxPP:1,description:'Burns the target.'}],{}).entries[0];
 assert.equal(entry.manifestReviewed,false);assert.deepEqual(entry.declaredHandlers,[]);assert.equal(entry.trustedMechanics,false);
});
