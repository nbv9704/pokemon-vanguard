import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RankedService,ensureRankedState,rankedRatingDelta,rankedTier} from '../server/ranked-v1.mjs';
import {rankedTierView} from '../server/ranked-tiers.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

const makeState=()=>({schemaVersion:3,seed:7,wins:0,badges:[],wallet:{coins:0,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const linked=(name,provider='discord')=>({name,provider});
function harness(){
 const states=new Map([['alpha',makeState()],['bravo',makeState()],['local',makeState()]]),persisted=[],notifications=[];
 for(const state of states.values())ensureRankedState(state);
 const service=new RankedService({catalog:v3Catalog,clock:{now:()=>Date.UTC(2026,8,23,1,0,0)},getState:id=>states.get(id),persist:async(id,state)=>{persisted.push([id,state.rankedV1.rating]);},notify:ids=>notifications.push([...ids])});
 service.register('alpha',linked('Alpha','google'));service.register('bravo',linked('Bravo','discord'));service.register('local',linked('Local','local'));
 return {service,states,persisted,notifications};
}
const teamBuildIds=state=>state.progressionV3.teams.find(t=>t.teamId===state.progressionV3.activeTeamId).buildIds;
async function matchedSingle(ctx){
 assert.equal((await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.queue.join',mode:'single'})).ok,true);
 assert.equal((await ctx.service.action('bravo',linked('Bravo','discord'),{type:'rankedV1.queue.join',mode:'single'})).ok,true);
 assert.equal(ctx.service.viewFor('alpha',ctx.states.get('alpha')).status,'preview');
 const aPick=teamBuildIds(ctx.states.get('alpha')).slice(0,3),bPick=teamBuildIds(ctx.states.get('bravo')).slice(0,3);
 assert.equal((await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.preview.lock',buildIds:aPick,actionId:'a-lock'})).ok,true);
 assert.equal((await ctx.service.action('bravo',linked('Bravo','discord'),{type:'rankedV1.preview.lock',buildIds:bPick,actionId:'b-lock'})).ok,true);
 return {aPick,bPick};
}

test('Ranked rating model is versionable, symmetric and tiered',()=>{
 assert.deepEqual(rankedRatingDelta(1000,1000,1),{A:16,B:-16});
 assert.deepEqual(rankedRatingDelta(1000,1000,.5),{A:0,B:0});
 assert.equal(rankedTier(1000),'Poké Ball');assert.equal(rankedTier(1199),'Poké Ball');assert.equal(rankedTier(1200),'Great Ball');assert.equal(rankedTier(1600),'Ultra Ball');assert.equal(rankedTier(2000),'Master Ball');assert.equal(rankedTier(2400),'Challenger');
 const start=rankedTierView(1000);assert.equal(start.tierId,'pokeball');assert.equal(start.tierAsset,'/ranks/pokeball.png');assert.equal(start.nextTierRating,1200);
});

test('Ranked queue requires linked account and pairs compatible trainers',async()=>{
 const ctx=harness(),denied=await ctx.service.action('local',linked('Local','local'),{type:'rankedV1.queue.join',mode:'single'});assert.equal(denied.ok,false);assert.equal(denied.code,'RANKED_ACCOUNT_REQUIRED');
 assert.equal(ctx.service.viewFor('local',ctx.states.get('local')).eligible,false);
 await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.queue.join',mode:'single'});assert.equal(ctx.service.viewFor('alpha',ctx.states.get('alpha')).status,'queued');
 await ctx.service.action('bravo',linked('Bravo','discord'),{type:'rankedV1.queue.join',mode:'single'});const a=ctx.service.viewFor('alpha',ctx.states.get('alpha')),b=ctx.service.viewFor('bravo',ctx.states.get('bravo'));assert.equal(a.status,'preview');assert.equal(b.status,'preview');assert.equal(a.match.opponent.name,'Bravo');assert.equal(b.match.opponent.name,'Alpha');assert.equal(a.eligible,true);
});

test('Ranked preview creates a two-account authoritative battle with perspective privacy',async()=>{
 const ctx=harness();await matchedSingle(ctx);const a=ctx.service.viewFor('alpha',ctx.states.get('alpha')),b=ctx.service.viewFor('bravo',ctx.states.get('bravo'));
 assert.equal(a.status,'battle');assert.equal(b.status,'battle');assert.notEqual(a.battleV3.ownSide,b.battleV3.ownSide);assert.equal(a.battleV3.snapshot.ownSide,a.battleV3.ownSide);assert.equal(b.battleV3.snapshot.ownSide,b.battleV3.ownSide);assert.ok(a.battleV3.snapshot.own[0].buildSnapshot);assert.equal(a.battleV3.snapshot.opponent[0].buildSnapshot,undefined);assert.ok(b.battleV3.snapshot.own[0].buildSnapshot);assert.equal(b.battleV3.snapshot.opponent[0].buildSnapshot,undefined);assert.equal(a.battleV3.snapshot.opponent[0].hp,undefined);
});

test('Ranked commands wait for both players, resolve one deterministic turn, and surrender settles once',async()=>{
 const ctx=harness();await matchedSingle(ctx);let a=ctx.service.viewFor('alpha',ctx.states.get('alpha')),b=ctx.service.viewFor('bravo',ctx.states.get('bravo'));
 const aMon=a.battleV3.snapshot.own.find(m=>m.activeSlot===0),bMon=b.battleV3.snapshot.own.find(m=>m.activeSlot===0),revision=a.battleV3.snapshot.phaseRevision;
 const aAction={type:'rankedV1.commands',phaseRevision:revision,commands:[{kind:'move',actorId:aMon.actorId,moveId:'protect'}],actionId:'a-turn-1'};
 const bAction={type:'rankedV1.commands',phaseRevision:revision,commands:[{kind:'move',actorId:bMon.actorId,moveId:'protect'}],actionId:'b-turn-1'};
 assert.equal((await ctx.service.action('alpha',linked('Alpha','google'),aAction)).ok,true);a=ctx.service.viewFor('alpha',ctx.states.get('alpha'));assert.equal(a.battleV3.snapshot.phase,'COMMAND');assert.equal(a.battleV3.rankedWaiting,'opponent-command');
 assert.equal((await ctx.service.action('bravo',linked('Bravo','discord'),bAction)).ok,true);a=ctx.service.viewFor('alpha',ctx.states.get('alpha'));assert.equal(a.battleV3.snapshot.turn,2);assert.equal(a.battleV3.snapshot.phase,'COMMAND');
 const surrender={type:'rankedV1.surrender',actionId:'a-surrender'};assert.equal((await ctx.service.action('alpha',linked('Alpha','google'),surrender)).ok,true);a=ctx.service.viewFor('alpha',ctx.states.get('alpha'));b=ctx.service.viewFor('bravo',ctx.states.get('bravo'));assert.equal(a.status,'finished');assert.equal(a.result.outcome,'loss');assert.equal(b.result.outcome,'win');assert.equal(a.result.ratingAfter,984);assert.equal(b.result.ratingAfter,1016);assert.equal(ctx.states.get('alpha').rankedV1.matches,1);assert.equal(ctx.states.get('bravo').rankedV1.matches,1);
 const duplicate=await ctx.service.action('alpha',linked('Alpha','google'),surrender);assert.equal(duplicate.ok,true);assert.equal(duplicate.duplicate,true);assert.equal(ctx.states.get('alpha').rankedV1.matches,1);assert.equal(ctx.states.get('bravo').rankedV1.matches,1);
});

test('Preview forfeit produces a dismissible ranked result without fabricating a battle',async()=>{
 const ctx=harness();await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.queue.join',mode:'single'});await ctx.service.action('bravo',linked('Bravo','discord'),{type:'rankedV1.queue.join',mode:'single'});const aPick=teamBuildIds(ctx.states.get('alpha')).slice(0,3);await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.preview.lock',buildIds:aPick,actionId:'lock'});await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.surrender',actionId:'preview-forfeit'});const view=ctx.service.viewFor('alpha',ctx.states.get('alpha'));assert.equal(view.status,'finished');assert.equal(view.battleV3,null);assert.equal(view.result.outcome,'loss');assert.equal(view.result.reason,'preview-forfeit');assert.equal((await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.dismiss',actionId:'dismiss'})).ok,true);assert.equal(ctx.service.viewFor('alpha',ctx.states.get('alpha')).status,'idle');
});

test('Ranked settlement keeps live state retryable when persistence fails',async()=>{
 const ctx=harness();let failed=false;ctx.service.persist=async(id,state)=>{ctx.persisted.push([id,state.rankedV1.rating]);if(id==='bravo'&&!failed){failed=true;throw new Error('synthetic persistence failure');}};
 await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.queue.join',mode:'single'});await ctx.service.action('bravo',linked('Bravo','discord'),{type:'rankedV1.queue.join',mode:'single'});
 const action={type:'rankedV1.surrender',actionId:'retryable-forfeit'};await assert.rejects(ctx.service.action('alpha',linked('Alpha','google'),action),/synthetic persistence failure/);
 assert.equal(ctx.states.get('alpha').rankedV1.rating,1000);assert.equal(ctx.states.get('bravo').rankedV1.rating,1000);assert.equal(ctx.states.get('alpha').rankedV1.matches,0);assert.equal(ctx.states.get('bravo').rankedV1.matches,0);
 const match=ctx.service.matches.get(ctx.service.playerMatch.get('alpha'));assert.equal(match.settled,false);assert.equal(match.settlementPromise,null);
 assert.equal((await ctx.service.action('alpha',linked('Alpha','google'),action)).ok,true);assert.equal(match.settled,true);assert.equal(ctx.states.get('alpha').rankedV1.rating,984);assert.equal(ctx.states.get('bravo').rankedV1.rating,1016);assert.equal(ctx.states.get('alpha').rankedV1.matches,1);assert.equal(ctx.states.get('bravo').rankedV1.matches,1);
});

test('Ranked client exposes queue, linked-account gating, PvP perspective and result UI',async()=>{
 const preview=await readFile(new URL('../public/js/v3-battle-preview.js',import.meta.url),'utf8'),client=await readFile(new URL('../public/client.js',import.meta.url),'utf8'),screen=await readFile(new URL('../public/js/v3-battle-screen.js',import.meta.url),'utf8'),css=await readFile(new URL('../public/ranked.css',import.meta.url),'utf8');
 assert.match(preview,/rankedEligible/);assert.match(preview,/Find Single Ranked Match/);assert.match(preview,/Google or Discord/);assert.match(preview,/rankedTierEmblem/);assert.match(client,/rankedFinished/);assert.match(client,/rankedTierEmblem/);assert.match(client,/rankedV1\.commands/);assert.match(screen,/snapshot\.ownSide/);assert.match(screen,/ranked-tier-icon/);assert.match(css,/ranked-tier-emblem/);
});

test('admin stop cancels Ranked queue or match as a no-contest without changing rating or match record',async()=>{
 let ctx=harness();await ctx.service.action('alpha',linked('Alpha','google'),{type:'rankedV1.queue.join',mode:'single'});let stopped=await ctx.service.adminStopForPlayer('alpha','admin-stop');assert.equal(stopped.ok,true);assert.equal(stopped.kind,'ranked-queue');assert.equal(ctx.service.viewFor('alpha',ctx.states.get('alpha')).status,'idle');
 ctx=harness();await matchedSingle(ctx);stopped=await ctx.service.adminStopForPlayer('alpha','admin-stop');assert.equal(stopped.ok,true);const a=ctx.service.viewFor('alpha',ctx.states.get('alpha')),b=ctx.service.viewFor('bravo',ctx.states.get('bravo'));assert.equal(a.status,'finished');assert.equal(b.status,'finished');assert.equal(a.result.outcome,'draw');assert.equal(a.result.reason,'admin-stop');assert.equal(a.result.ratingDelta,0);assert.equal(ctx.states.get('alpha').rankedV1.rating,1000);assert.equal(ctx.states.get('bravo').rankedV1.rating,1000);assert.equal(ctx.states.get('alpha').rankedV1.matches,0);assert.equal(ctx.states.get('bravo').rankedV1.matches,0);
});
