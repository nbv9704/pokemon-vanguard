import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {createTurnFrames} from '../public/js/v3-battle-timeline.js';
import {moveFxProfile,renderV3BattleFx,V3_FX_TYPES,v3MoveFxCoverage} from '../public/js/v3-move-fx.js';

test('every enabled beta move resolves to an explicit visual profile or readable fallback',()=>{
 const coverage=v3MoveFxCoverage(publicV3Catalog.moves);
 assert.equal(coverage.length,29);
 assert.ok(coverage.every(entry=>entry.id&&entry.source));
 assert.deepEqual(new Set(coverage.map(entry=>entry.moveId)),new Set(publicV3Catalog.moves.map(move=>move.id)));
 assert.equal(moveFxProfile(publicV3Catalog.moves.find(move=>move.id==='protect')).id,'barrier');
 assert.equal(moveFxProfile(publicV3Catalog.moves.find(move=>move.id==='water-spout')).id,'field-burst');
});

test('FX palette covers all eighteen battle types and every active move type',()=>{
 assert.equal(new Set(V3_FX_TYPES).size,18);
 for(const move of publicV3Catalog.moves)assert.ok(V3_FX_TYPES.includes(move.type),`${move.id} has an FX color token`);
});

test('cast and authoritative impact render distinct stages for the same move',()=>{
 const initial={turn:1,own:[{actorId:'A-0',name:'User',hp:100,maxHp:100,activeSlot:0}],opponent:[{actorId:'B-0',name:'Target',hpPercent:100,activeSlot:0}]};
 const events=[{id:'1',kind:'turnStarted',turn:1},{id:'2',kind:'moveStarted',actorId:'A-0',moveId:'giga-drain'},{id:'3',kind:'damage',actorId:'A-0',targetId:'B-0',moveId:'giga-drain',hpAfterPercent:60},{id:'4',kind:'heal',actorId:'A-0',targetId:'A-0',moveId:'giga-drain',hpAfter:100}];
 const [cast,impact]=createTurnFrames(initial,events);
 assert.equal(cast.moveId,'giga-drain');assert.equal(impact.moveId,'giga-drain');
 assert.match(renderV3BattleFx(cast,publicV3Catalog),/stage-cast[\s\S]*outcome-pending/);
 assert.match(renderV3BattleFx(impact,publicV3Catalog),/stage-impact[\s\S]*outcome-drain/);
 assert.match(renderV3BattleFx(impact,publicV3Catalog),/data-fx-profile="drain"/);
});

test('impact adapter uses event outcomes and represents spread target count',()=>{
 const base={stage:'impact',actorId:'B-0',moveId:'water-spout'};
 const spread=renderV3BattleFx({...base,events:[{kind:'damage',targetId:'A-0'},{kind:'damage',targetId:'A-1'}]},publicV3Catalog);
 assert.match(spread,/from-enemy/);assert.match(spread,/outcome-hit/);assert.match(spread,/data-target-count="2"/);
 for(const [kind,outcome] of [['moveMissed','miss'],['moveBlocked','blocked'],['statusApplied','status'],['heal','heal'],['moveFailed','failed']])assert.match(renderV3BattleFx({...base,events:[{kind,targetId:'A-0'}]},publicV3Catalog),new RegExp(`outcome-${outcome}`));
});

test('reduced motion preserves cast and impact snapshots while removing waits',()=>{
 const initial={turn:1,own:[],opponent:[{actorId:'B-0',name:'Target',hpPercent:100,activeSlot:0}]},events=[{kind:'moveStarted',actorId:'A-0',moveId:'stored-power'},{kind:'damage',targetId:'B-0',hpAfterPercent:72}];
 const frames=createTurnFrames(initial,events,{reduced:true});
 assert.deepEqual(frames.map(frame=>frame.stage),['cast','impact']);
 assert.deepEqual(frames.map(frame=>frame.duration),[0,0]);
 assert.equal(frames[0].snapshot.opponent[0].hpPercent,100);assert.equal(frames[1].snapshot.opponent[0].hpPercent,72);
});
