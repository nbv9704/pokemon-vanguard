import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {battleLog,createTurnFrames,visualTargetIds} from '../public/js/v3-battle-timeline.js';
import {moveFxProfile,renderV3BattleFx,V3_FX_TYPES,v3MoveFxCoverage} from '../public/js/v3-move-fx.js';
import {sceneAnchor,sceneTracks,sceneTrackStyle} from '../public/js/v3-scene-anchors.js';

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
 assert.match(renderV3BattleFx(impact,publicV3Catalog),/data-target-count="1"/);
});

test('impact adapter uses event outcomes and represents spread target count',()=>{
 const snapshot={format:'double',own:[{actorId:'A-0',activeSlot:0},{actorId:'A-1',activeSlot:1}],opponent:[{actorId:'B-0',activeSlot:0},{actorId:'B-1',activeSlot:1}]},base={stage:'impact',snapshot,actorId:'B-0',moveId:'water-spout'};
 const spread=renderV3BattleFx({...base,targetIds:['A-0','A-1'],events:[{kind:'damage',targetId:'A-0'},{kind:'damage',targetId:'A-1'}]},publicV3Catalog);
 assert.match(spread,/from-enemy/);assert.match(spread,/outcome-hit/);assert.match(spread,/data-target-count="2"/);assert.match(spread,/--end-x:18%;--end-y:77%/);assert.match(spread,/--end-x:43%;--end-y:69%/);
 for(const [kind,outcome] of [['moveMissed','miss'],['moveBlocked','blocked'],['statusApplied','status'],['heal','heal'],['moveFailed','failed']])assert.match(renderV3BattleFx({...base,targetIds:['A-0'],events:[{kind,targetId:'A-0'}]},publicV3Catalog),new RegExp(`outcome-${outcome}`));
});

test('single and double scene anchors follow actor and target slots',()=>{
 const single={format:'single',own:[{actorId:'A-0',activeSlot:0}],opponent:[{actorId:'B-0',activeSlot:0}]};
 assert.deepEqual(sceneAnchor(single,'A-0'),{x:22,y:76,side:'own',slot:0});
 assert.equal(sceneTrackStyle(sceneTracks(single,'A-0',['B-0'])[0]),'--start-x:22%;--start-y:76%;--end-x:78%;--end-y:25%');
 const double={format:'double',own:[{actorId:'A-0',activeSlot:0},{actorId:'A-1',activeSlot:1}],opponent:[{actorId:'B-0',activeSlot:0},{actorId:'B-1',activeSlot:1}]};
 assert.deepEqual(sceneTracks(double,'A-1',['A-0','B-0','B-1']).map(track=>[track.end.x,track.end.y]),[[18,77],[82,23],[58,32]]);
 assert.deepEqual(sceneAnchor(double,'field'),{x:50,y:50,side:'field',slot:-1});
});

test('spread FX keep per-target outcomes and immunity while sharing one action frame',()=>{
 const snapshot={format:'double',own:[{actorId:'A-0',activeSlot:0},{actorId:'A-1',activeSlot:1}],opponent:[{actorId:'B-0',activeSlot:0},{actorId:'B-1',activeSlot:1}]};
 const mixed=renderV3BattleFx({stage:'impact',snapshot,actorId:'B-0',moveId:'water-spout',targetIds:['A-0','A-1'],speed:2,events:[{kind:'damage',targetId:'A-0',effectiveness:1},{kind:'moveMissed',targetId:'A-1'}]},publicV3Catalog);
 assert.match(mixed,/outcome-mixed speed-2/);assert.match(mixed,/fx-outcome-hit" data-fx-target="A-0"/);assert.match(mixed,/fx-outcome-miss" data-fx-target="A-1"/);
 const immune=renderV3BattleFx({stage:'impact',snapshot,actorId:'B-0',moveId:'water-spout',targetIds:['A-0'],events:[{kind:'damage',targetId:'A-0',effectiveness:0}]},publicV3Catalog);
 assert.match(immune,/outcome-immune/);assert.match(immune,/fx-outcome-immune/);
});

test('visual targets omit drain healing and self recoil from the attack track',()=>{
 assert.deepEqual(visualTargetIds([{kind:'damage',targetId:'B-0'},{kind:'heal',targetId:'A-0'}],'A-0'),['B-0']);
 assert.deepEqual(visualTargetIds([{kind:'damage',targetId:'B-0'},{kind:'damage',targetId:'A-0',source:'recoil'}],'A-0'),['B-0']);
});

test('battle log keeps initial switch events on turn one after later turns',()=>{
 const entries=battleLog([{kind:'switchedIn',targetId:'A-0'},{kind:'turnStarted',turn:1},{kind:'turnEnded',turn:1},{kind:'turnStarted',turn:2}],{turn:2,own:[{actorId:'A-0',name:'Lead'}],opponent:[]},publicV3Catalog);
 assert.deepEqual(entries.map(entry=>entry.turn),[1,1,1,2]);
});

test('reduced motion preserves cast and impact snapshots while removing waits',()=>{
 const initial={turn:1,own:[],opponent:[{actorId:'B-0',name:'Target',hpPercent:100,activeSlot:0}]},events=[{kind:'moveStarted',actorId:'A-0',moveId:'stored-power'},{kind:'damage',targetId:'B-0',hpAfterPercent:72}];
 const frames=createTurnFrames(initial,events,{reduced:true});
 assert.deepEqual(frames.map(frame=>frame.stage),['cast','impact']);
 assert.deepEqual(frames.map(frame=>frame.duration),[0,0]);
 assert.equal(frames[0].snapshot.opponent[0].hpPercent,100);assert.equal(frames[1].snapshot.opponent[0].hpPercent,72);
});
