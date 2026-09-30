import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SocialService,accountIdFromFriendCode,ensureSocialState,friendCodeFor} from '../server/social-v1.mjs';
import {TrainingPvpService} from '../server/training-pvp-v1.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction,chooseV3AiCommands} from '../server/v3-battle-actions.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {ArenaView} from '../public/js/arena-view.js';
import {SocialView} from '../public/js/social-view.js';

const IDS={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222'};
const makeState=()=>({schemaVersion:3,seed:7,wallet:{coins:9999,crystals:9999,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const session=(name,provider='discord')=>({name,provider});
const activeTeam=state=>state.progressionV3.teams.find(team=>team.teamId===state.progressionV3.activeTeamId)||state.progressionV3.teams[0];

test('Trainer Codes round-trip UUIDs without case-sensitive encoding loss',()=>{
 const code=friendCodeFor(IDS.a);assert.match(code,/^PV-[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/);assert.equal(accountIdFromFriendCode(code),IDS.a);assert.equal(accountIdFromFriendCode(code.toLowerCase()),IDS.a);assert.equal(accountIdFromFriendCode('bad-code'),null);
});

test('Friends, requests and direct chat persist in authoritative account state',async()=>{
 let now=1000;const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]);for(const state of states.values())ensureSocialState(state);
 const service=new SocialService({clock:{now:()=>now},getState:id=>states.get(id),loadState:async id=>states.get(id)||null,persistPair:async(entries)=>{for(const entry of entries)states.set(entry.userId,entry.state);},setLiveState:(id,state)=>states.set(id,state)});
 service.register(IDS.a,session('Alpha','google'));service.register(IDS.b,session('Bravo','discord'));
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'socialV1.friend.request',friendCode:friendCodeFor(IDS.b)})).ok,true);
 assert.equal(service.viewFor(IDS.b,states.get(IDS.b)).incomingRequests[0].name,'Alpha');
 assert.equal((await service.action(IDS.b,session('Bravo'),{type:'socialV1.friend.accept',accountId:IDS.a})).ok,true);
 assert.equal(service.isFriend(IDS.a,IDS.b),true);assert.equal(service.isFriend(IDS.b,IDS.a),true);
 now+=1000;assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'socialV1.chat.send',accountId:IDS.b,text:'Ready for a friendly battle?'})).ok,true);
 assert.equal(service.viewFor(IDS.b,states.get(IDS.b)).conversations[IDS.a].at(-1).text,'Ready for a friendly battle?');
 const limited=await service.action(IDS.a,session('Alpha','google'),{type:'socialV1.chat.send',accountId:IDS.b,text:'duplicate spam'});assert.equal(limited.ok,false);assert.equal(limited.code,'CHAT_RATE_LIMITED');
});

test('Social mutations do not leak into live state when pair persistence fails',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]);for(const state of states.values())ensureSocialState(state);const beforeA=structuredClone(states.get(IDS.a)),beforeB=structuredClone(states.get(IDS.b));
 const service=new SocialService({getState:id=>states.get(id),loadState:async id=>states.get(id)||null,persistPair:async()=>{throw new Error('synthetic persistence failure');},setLiveState:(id,state)=>states.set(id,state)});service.register(IDS.a,session('Alpha','google'));service.register(IDS.b,session('Bravo'));
 await assert.rejects(service.action(IDS.a,session('Alpha','google'),{type:'socialV1.friend.request',friendCode:friendCodeFor(IDS.b)}),/synthetic persistence failure/);assert.deepEqual(states.get(IDS.a),beforeA);assert.deepEqual(states.get(IDS.b),beforeB);
});

test('Friend acceptance rechecks the one-hundred friend limit',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]);for(const state of states.values())ensureSocialState(state);const a=states.get(IDS.a).socialV1,b=states.get(IDS.b).socialV1;a.incomingRequests=[{accountId:IDS.b,name:'Bravo'}];b.outgoingRequests=[{accountId:IDS.a,name:'Alpha'}];a.friends=Array.from({length:100},(_,index)=>({accountId:`friend-${index}`,name:`Friend ${index}`}));
 const service=new SocialService({getState:id=>states.get(id),loadState:async id=>states.get(id)||null,persistPair:async(entries)=>{for(const entry of entries)states.set(entry.userId,entry.state);},setLiveState:(id,state)=>states.set(id,state)});const result=await service.action(IDS.a,session('Alpha','google'),{type:'socialV1.friend.accept',accountId:IDS.b});assert.deepEqual(result,{ok:false,code:'SOCIAL_LIMIT_REACHED'});assert.equal(states.get(IDS.a).socialV1.friends.length,100);assert.equal(states.get(IDS.a).socialV1.incomingRequests.length,1);
});

test('Friend requests use the durable profile when the target is offline',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]);for(const state of states.values())ensureSocialState(state);const service=new SocialService({getState:id=>states.get(id),loadState:async id=>states.get(id)||null,loadProfile:async id=>id===IDS.b?{displayName:'Offline Bravo',avatarUrl:'https://example.test/bravo.png'}:null,persistPair:async(entries)=>{for(const entry of entries)states.set(entry.userId,entry.state);},setLiveState:(id,state)=>states.set(id,state)});service.register(IDS.a,session('Alpha','google'));
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'socialV1.friend.request',friendCode:friendCodeFor(IDS.b)})).ok,true);assert.equal(states.get(IDS.a).socialV1.outgoingRequests[0].name,'Offline Bravo');assert.equal(states.get(IDS.a).socialV1.outgoingRequests[0].avatar,'https://example.test/bravo.png');
});

test('Friendly Battle rooms require selected teams and create an authoritative PvP battle',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]),notices=[];
 const service=new TrainingPvpService({catalog:v3Catalog,clock:{now:()=>2000},getState:id=>states.get(id),notify:ids=>notices.push(ids),isFriend:()=>true});
 service.register(IDS.a,session('Alpha','google'));service.register(IDS.b,session('Bravo','discord'));
 const teamA=activeTeam(states.get(IDS.a)),teamB=activeTeam(states.get(IDS.b));
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.create',mode:'single',teamId:teamA.teamId})).ok,true);
 const waiting=service.viewFor(IDS.a);assert.equal(waiting.status,'waiting');assert.match(waiting.room.code,/^[A-Z2-9]{6}$/);
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.invite',accountId:IDS.b})).ok,true);assert.equal(service.viewFor(IDS.b).incomingInvites[0].code,waiting.room.code);
 assert.equal((await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.room.join',code:waiting.room.code,teamId:teamB.teamId})).ok,true);assert.equal(service.viewFor(IDS.b).incomingInvites.length,0);
 assert.equal(service.viewFor(IDS.a).status,'preview');
 const pickA=teamA.buildIds.slice(0,3),pickB=teamB.buildIds.slice(0,3);
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.preview.lock',buildIds:pickA,actionId:'a-lock'})).ok,true);
 assert.equal((await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.preview.lock',buildIds:pickB,actionId:'b-lock'})).ok,true);
 const battle=service.viewFor(IDS.a);assert.equal(battle.status,'battle');assert.equal(battle.battleV3.kind,'training-pvp');assert.equal(battle.battleV3.snapshot.ownSide,'A');assert.equal(battle.battleV3.snapshot.opponent[0].buildSnapshot,undefined);
});


test('Close Room destroys a waiting room, revokes invites and immediately returns the host to idle',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]),notices=[];
 const service=new TrainingPvpService({catalog:v3Catalog,clock:{now:()=>3000},getState:id=>states.get(id),notify:ids=>notices.push([...ids]),isFriend:()=>true});
 service.register(IDS.a,session('Alpha','google'));service.register(IDS.b,session('Bravo','discord'));
 const teamA=activeTeam(states.get(IDS.a));
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.create',mode:'single',teamId:teamA.teamId})).ok,true);
 const code=service.viewFor(IDS.a).room.code;
 assert.equal((await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.invite',accountId:IDS.b})).ok,true);
 assert.equal(service.viewFor(IDS.b).incomingInvites.length,1);
 const closed=await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.leave'});
 assert.equal(closed.ok,true);assert.equal(closed.closed,true);assert.equal(service.viewFor(IDS.a).status,'idle');assert.equal(service.viewFor(IDS.b).incomingInvites.length,0);assert.equal(service.rooms.has(code),false);assert.equal(service.busy(IDS.a),false);
 assert.equal(notices.some(ids=>ids.includes(IDS.a)),true);assert.equal(notices.some(ids=>ids.includes(IDS.b)),true);
 const join=await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.room.join',code,teamId:activeTeam(states.get(IDS.b)).teamId});assert.equal(join.ok,false);assert.equal(join.code,'ROOM_NOT_FOUND');
});

test('A guest can leave Friendly Team Preview without leaving a zombie participant behind',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]);
 const service=new TrainingPvpService({catalog:v3Catalog,getState:id=>states.get(id),isFriend:()=>true});
 const teamA=activeTeam(states.get(IDS.a)),teamB=activeTeam(states.get(IDS.b));
 await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.create',mode:'single',teamId:teamA.teamId});const code=service.viewFor(IDS.a).room.code;
 await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.room.join',code,teamId:teamB.teamId});
 assert.equal(service.viewFor(IDS.a).status,'preview');
 const left=await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.room.leave'});assert.equal(left.ok,true);assert.equal(left.left,true);
 assert.equal(service.viewFor(IDS.b).status,'idle');assert.equal(service.viewFor(IDS.a).status,'waiting');assert.equal(service.viewFor(IDS.a).room.opponent,null);
});


test('PvE difficulty changes AI policy instead of only changing its label',()=>{
 let state=makeState(),team=activeTeam(state);let result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'single',difficulty:'hard',training:true,teamId:team.teamId},v3Catalog);assert.equal(result.ok,true);result=applyV3BattleAction(result.state,{type:'battleV3.preview.lock',buildIds:team.buildIds.slice(0,3)},v3Catalog);assert.equal(result.ok,true);const battle=result.state.battleV3.battle,easy=chooseV3AiCommands(battle,v3Catalog,'easy'),normal=chooseV3AiCommands(battle,v3Catalog,'normal'),hard=chooseV3AiCommands(battle,v3Catalog,'hard');
 assert.equal(easy.some(action=>action.mega),false);assert.notDeepEqual(normal,hard);assert.equal(normal[0].moveId,'flip-turn');assert.equal(hard[0].moveId,'dragon-tail');
});

test('Arena PvE sessions can be marked training so they pay no rewards',()=>{
 const state=makeState(),team=activeTeam(state),coins=state.wallet.coins,crystals=state.wallet.crystals;
 const started=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'single',difficulty:'hard',training:true,teamId:team.teamId},v3Catalog);assert.equal(started.ok,true);assert.equal(started.state.battleV3.training,true);
 assert.equal(started.state.wallet.coins,coins);assert.equal(started.state.wallet.crystals,crystals);
});

test('Arena stays battle-focused while Friends & Chat is a global route',async()=>{
 const sent=[],state=makeState();state.trainingV3={...state.progressionV3,species:v3Catalog.species};state.rankedV1={eligible:true,profile:{rating:1000,peakRating:1000,wins:0,losses:0,draws:0,seasonId:'2026-S1',tier:'Poké Ball',tierId:'pokeball',tierAsset:'/ranks/pokeball.png',nextTierRating:1200}};state.trainingPvpV1={status:'idle',incomingInvites:[{code:'ABC234',mode:'single',fromName:'Bravo'}]};state.socialV1={eligible:true,friendCode:friendCodeFor(IDS.a),friends:[{accountId:IDS.b,name:'Bravo',online:true,provider:'discord'}],incomingRequests:[],outgoingRequests:[],conversations:{}};
 const arena=new ArenaView({send:a=>sent.push(a),actionId:()=> 'action'});let html=arena.render(state);assert.match(html,/Choose your arena/);assert.doesNotMatch(html,/Manage Trainer Codes/);
 arena.section='pve';html=arena.render(state);assert.match(html,/Choose Team/);assert.match(html,/Rookie/);assert.match(html,/Veteran/);assert.match(html,/Ace/);
 arena.section='pvp';html=arena.render(state);assert.match(html,/Create Room/);assert.match(html,/ROOM CODE/);assert.doesNotMatch(html,/Trainer Code/);
 const social=new SocialView({send:a=>sent.push(a),actionId:()=> 'action'});html=social.render(state);assert.match(html,/Friends & Chat/);assert.match(html,/YOUR TRAINER CODE/);assert.match(html,/DIRECT MESSAGE/);assert.match(html,/room invite/);
 const router=await readFile(new URL('../public/js/router.js',import.meta.url),'utf8');assert.match(router,/\['battle','\/assets\/icons\/arena\.png','Arena'\]/);assert.match(router,/\['friends','\/assets\/icons\/friends\.png','Friends'\]/);
 const client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');const shell=await readFile(new URL('../public/js/client-shell-layout.js',import.meta.url),'utf8');assert.match(client,/new SocialView/);assert.match(client,/renderClientShell/);assert.match(shell,/data-nav-icon/);assert.doesNotMatch(shell,/data-action=\"friends\"/);assert.match(client,/trainingPvpBattleScreen\?\.playback/);
 const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.match(index,/social\.css/);
 const css=await readFile(new URL('../public/arena.css',import.meta.url),'utf8');assert.match(css,/body\.pixel-era \.arena-mode-card\{min-height:290px!important/);assert.match(css,/arena-segmented button\.active.*background:#6576bb!important/);assert.match(css,/\.arena-team-mon\{height:44px/);assert.match(css,/body\.pixel-era \.arena-team-card img\{image-rendering:auto!important\}/);
 const arenaSource=await readFile(new URL('../public/js/arena-view.js',import.meta.url),'utf8');assert.match(arenaSource,/arena-team-mon/);assert.match(arenaSource,/presentationAsset\(species\.id,'artwork'\)/);
});



test('Arena resets its cached team selection to the latest active Team Builder team',()=>{
 const state=makeState();state.trainingV3={...state.progressionV3,species:v3Catalog.species};const arena=new ArenaView({send(){},actionId:()=> 'action'}),first=state.trainingV3.teams[0],third=state.trainingV3.teams[2];
 arena.teamId=first.teamId;arena.lastActiveTeamId=first.teamId;state.trainingV3.activeTeamId=third.teamId;assert.equal(arena.selectedTeam(state).teamId,third.teamId);
 arena.teamId=first.teamId;arena.reset();assert.equal(arena.selectedTeam(state).teamId,third.teamId);
});
test('admin stop closes Friendly preview rooms or finishes active Friendly battles as no-contest',async()=>{
 const states=new Map([[IDS.a,makeState()],[IDS.b,makeState()]]),service=new TrainingPvpService({catalog:v3Catalog,getState:id=>states.get(id),isFriend:()=>true});service.register(IDS.a,session('Alpha','google'));service.register(IDS.b,session('Bravo','discord'));
 let teamA=activeTeam(states.get(IDS.a)),teamB=activeTeam(states.get(IDS.b));await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.create',mode:'single',teamId:teamA.teamId});let code=service.viewFor(IDS.a).room.code;await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.room.join',code,teamId:teamB.teamId});let stopped=await service.adminStopForPlayer(IDS.a,'admin-stop');assert.equal(stopped.ok,true);assert.equal(service.viewFor(IDS.a).status,'idle');assert.equal(service.viewFor(IDS.b).status,'idle');
 await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.room.create',mode:'single',teamId:teamA.teamId});code=service.viewFor(IDS.a).room.code;await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.room.join',code,teamId:teamB.teamId});await service.action(IDS.a,session('Alpha','google'),{type:'trainingPvpV1.preview.lock',buildIds:teamA.buildIds.slice(0,3),actionId:'a-lock-admin'});await service.action(IDS.b,session('Bravo'),{type:'trainingPvpV1.preview.lock',buildIds:teamB.buildIds.slice(0,3),actionId:'b-lock-admin'});stopped=await service.adminStopForPlayer(IDS.a,'admin-stop');assert.equal(stopped.ok,true);assert.equal(service.viewFor(IDS.a).status,'finished');assert.equal(service.viewFor(IDS.b).status,'finished');assert.equal(service.viewFor(IDS.a).battleV3.snapshot.result.winner,null);assert.equal(service.viewFor(IDS.a).battleV3.snapshot.result.reason,'admin-stop');
});
