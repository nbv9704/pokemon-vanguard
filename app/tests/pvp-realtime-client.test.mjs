import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {V3BattleScreen} from '../public/js/v3-battle-screen.js';

test('V3 playback gate distinguishes a fresh resolved turn from a same-turn realtime push',()=>{
 const screen=new V3BattleScreen({onChange(){},sendAction(){return true;}});
 const view={turnSnapshots:{initial:{}},events:[{id:'turn-7:start',kind:'turnStarted'},{id:'turn-7:end',kind:'turnEnded'}]};
 assert.equal(screen.hasFreshPlayback(view),true);
 assert.equal(screen.acknowledgePlayback(view),true);
 assert.equal(screen.hasFreshPlayback(view),false);
 assert.equal(screen.hasFreshPlayback({...view,events:[{id:'turn-8:start',kind:'turnStarted'},{id:'turn-8:end',kind:'turnEnded'}]}),true);
 assert.equal(screen.acknowledgePlayback({turnSnapshots:null,events:[]}),false);
 clearInterval(screen.clockTimer);
});

test('client only suppresses the authoritative redraw when there is actually a fresh V3 playback',async()=>{
 const client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');
 assert.match(client,/rankedBattleScreen\.hasFreshPlayback\(next\.rankedV1\?\.battleV3\)/);
 assert.match(client,/trainingPvpBattleScreen\.hasFreshPlayback\(next\.trainingPvpV1\?\.battleV3\)/);
 assert.match(client,/v3BattleScreen\.hasFreshPlayback\(next\.battleV3\)/);
 assert.match(client,/rankedBattleScreen\?\.acknowledgePlayback\(next\.rankedV1\?\.battleV3\)/);
 assert.match(client,/trainingPvpBattleScreen\?\.acknowledgePlayback\(next\.trainingPvpV1\?\.battleV3\)/);
 assert.match(client,/v3BattleScreen\?\.acknowledgePlayback\(next\.battleV3\)/);
 assert.match(client,/V=next;announceNotice\(!!previous\);draw\(\)/);
 assert.match(client,/completedBattleResults\.accept\(next,\{reentry:!previous\}\)/);
 assert.match(client,/completedBattleResults\.dismissFinished\(V\)/);
});

test('Ranked service pushes a pending command update to both connected players before turn resolution',async()=>{
 const {RankedService,ensureRankedState}=await import('../server/ranked-v1.mjs');
 const {createV3BetaProgression}=await import('../server/v3-progression.mjs');
 const {v3Catalog}=await import('../server/v3-catalog.mjs');
 const makeState=()=>({schemaVersion:3,seed:9,wins:0,badges:[],wallet:{coins:0,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
 const states=new Map([['a',makeState()],['b',makeState()]]);for(const state of states.values())ensureRankedState(state);
 const pushes=[];const service=new RankedService({catalog:v3Catalog,getState:id=>states.get(id),persist:async()=>{},notify:ids=>pushes.push([...ids])});
 const session=name=>({name,provider:'discord'});service.register('a',session('A'));service.register('b',session('B'));
 await service.action('a',session('A'),{type:'rankedV1.queue.join',mode:'single'});await service.action('b',session('B'),{type:'rankedV1.queue.join',mode:'single'});
 const team=id=>states.get(id).progressionV3.teams.find(entry=>entry.teamId===states.get(id).progressionV3.activeTeamId);
 await service.action('a',session('A'),{type:'rankedV1.preview.lock',buildIds:team('a').buildIds.slice(0,3),actionId:'a-lock'});await service.action('b',session('B'),{type:'rankedV1.preview.lock',buildIds:team('b').buildIds.slice(0,3),actionId:'b-lock'});
 pushes.length=0;const a=service.viewFor('a',states.get('a')),mon=a.battleV3.snapshot.own.find(entry=>entry.activeSlot===0),revision=a.battleV3.snapshot.phaseRevision;
 await service.action('a',session('A'),{type:'rankedV1.commands',phaseRevision:revision,commands:[{kind:'move',actorId:mon.actorId,moveId:'protect'}],actionId:'a-command'});
 assert.deepEqual(new Set(pushes.at(-1)),new Set(['a','b']));
 assert.equal(service.viewFor('a',states.get('a')).battleV3.rankedWaiting,'opponent-command');
});
