
import {creature} from "./art.js";
import {BattleAnimator} from "./battle-animation.js";
import {createBrowserStore} from "./js/store.js";
import {createRouter,NAV_ITEMS} from "./js/router.js";
import {AdventureConnection,websocketUrl} from "./js/net.js";
import {TrainingEditor} from "./js/training-editor.js";
import {BoxView} from "./js/box-view.js";
import {TeamBuilder} from "./js/team-builder.js";
import {V2BattleScreen} from "./js/v2-battle-screen.js";
import {DamageInspector} from "./js/damage-inspector.js";
import {renderV2Tutorial} from "./js/v2-tutorial.js";
import {RecruitmentView} from "./js/recruitment-view.js";
import {V3TrainingEditor} from "./js/v3-training-editor.js";
import {V3TeamBuilder} from "./js/v3-team-builder.js";
import {V3BattleScreen} from "./js/v3-battle-screen.js";
import {V3RecruitmentView} from "./js/v3-recruitment-view.js";
import {V3OverviewView} from "./js/v3-overview-view.js";
import {GameUiController} from "./js/ui/core/game-ui-controller.js";
import {presentationAsset,hasBespokeAsset} from "./js/presentation-assets.js";
import {AudioManager} from "./js/audio-manager.js";
import {createGameViewportScaler} from "./js/ui/core/game-viewport-scaler.js";
import {MissionView} from "./js/mission-view.js";
import {ReplicaTeamsView} from "./js/replica-teams.js";
const viewportScaler=createGameViewportScaler().attach();
const browserStore=createBrowserStore({storage:localStorage,cryptoApi:crypto,locationLike:location});
const auth=window.__PV_AUTH__||null;
const id=auth?.playerId||browserStore.playerId,room=auth?.roomId||browserStore.room,router=createRouter();
let V=null,commands={},pending=false,modalId=null,lastNotice="",connected=false,toastTimer,modalReturnFocus=null,userMenuOpen=false,trainingHubMode=null;
let latestView=null,playback=null,playbackVersion=0;
const settings=browserStore.settings;
if(settings.audio===undefined)settings.audio=true;if(settings.audioVolume===undefined)settings.audioVolume=.55;
const $=s=>document.querySelector(s);
let renderedPage=null;
const continuityAttributes=['data-replica-code','data-v3-archive-input','data-v3-field','data-v3-stat','data-v3-move','data-v3-team-field','data-v3-battle-field','data-box-field','data-team-field','data-team-slot','data-training-field','data-training-stat','data-training-move','data-damage-field','data-v2-field','data-ui-focus-id'];
function continuitySelector(element){
 if(!element||element===document.body)return null;
 if(element.id)return `#${CSS.escape(element.id)}`;
 for(const name of continuityAttributes)if(element.hasAttribute?.(name))return `[${name}="${CSS.escape(element.getAttribute(name))}"]`;
 return null;
}
function captureRenderContinuity(page){
 if(renderedPage!==page)return null;
 const active=document.activeElement,selector=continuitySelector(active);
 return {selector,selectionStart:Number.isInteger(active?.selectionStart)?active.selectionStart:null,selectionEnd:Number.isInteger(active?.selectionEnd)?active.selectionEnd:null,windowX:window.scrollX,windowY:window.scrollY,scroll:[...document.querySelectorAll('[data-ui-scroll-container]')].map((element,index)=>({key:element.dataset.uiScrollKey||String(index),top:element.scrollTop,left:element.scrollLeft}))};
}
function restoreRenderContinuity(value){
 if(!value)return false;
 const scrollByKey=new Map(value.scroll.map(entry=>[entry.key,entry]));
 for(const [index,element] of [...document.querySelectorAll('[data-ui-scroll-container]')].entries()){
  const saved=scrollByKey.get(element.dataset.uiScrollKey||String(index));if(!saved)continue;element.scrollTop=saved.top;element.scrollLeft=saved.left;
 }
 window.scrollTo(value.windowX,value.windowY);
 const active=value.selector&&document.querySelector(value.selector);if(!active)return false;
 active.focus({preventScroll:true});
 if(active.setSelectionRange&&value.selectionStart!==null)active.setSelectionRange(value.selectionStart,value.selectionEnd??value.selectionStart);
 return document.activeElement===active;
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const art=id=>'<div class="art">'+creature(id)+'</div>';
const pokemonBattleArt=(id,view='front')=>`<div class="art pokemon-art ${view==='back'?'back-view':'front-view'} ${hasBespokeAsset(id,view)?'':'pokemon-art-missing'}"><img src="${presentationAsset(id,view)}" alt="${esc(id)} ${view} battle presentation"></div>`;
const artworkScale={venusaur:1.03,blastoise:.95,beedrill:1,chesnaught:1,decidueye:1.095,feraligatr:.97};
const pokemonArtwork=id=>`<div class="art pokemon-art pokemon-key-art ${hasBespokeAsset(id,'artwork')?'':'pokemon-art-missing'}" style="--art-scale:${artworkScale[id]||1}"><img src="${presentationAsset(id,'artwork')}" alt="${esc(id)} presentation artwork"></div>`;
const btn=(label,action,cls="",disabled=false)=>'<button class="'+cls+'" data-action="'+action+'" '+(disabled?"disabled":"")+'>'+label+'</button>';
const navs=NAV_ITEMS;
function notify(t){$("#toast").textContent=t;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),4200);}
function accountControl(){
 const name=auth?.name||'Local player',provider=auth?.provider||'browser',initial=name.slice(0,1).toUpperCase(),avatar=auth?.avatar?'<img src="'+esc(auth.avatar)+'" alt="">':esc(initial);
 return '<div class="user-menu"><button class="user-trigger" type="button" data-action="account-menu" aria-haspopup="menu" aria-controls="account-dropdown" aria-expanded="'+userMenuOpen+'"><span class="avatar">'+avatar+'</span><span class="user-trigger-copy"><b>'+esc(name)+'</b><small>'+esc(provider)+'</small></span><span class="user-caret" aria-hidden="true">▾</span></button><div class="user-dropdown" id="account-dropdown" role="menu" '+(userMenuOpen?'':'hidden')+'><div class="user-dropdown-head"><span class="avatar">'+avatar+'</span><div><b>'+esc(name)+'</b><small>'+esc(provider)+' account</small></div></div><button type="button" role="menuitem" data-action="profile"><span aria-hidden="true">◆</span> Profile</button><button type="button" role="menuitem" data-action="settings"><span aria-hidden="true">⚙</span> Settings</button><button type="button" role="menuitem" data-action="logout" class="user-logout"><span aria-hidden="true">↪</span> Log out</button></div></div>';
}
function setUserMenu(open,{focusMenu=false}={}){userMenuOpen=!!open;const trigger=document.querySelector('[data-action="account-menu"]'),menu=document.querySelector('#account-dropdown');trigger?.setAttribute('aria-expanded',String(userMenuOpen));if(menu)menu.hidden=!userMenuOpen;if(userMenuOpen&&focusMenu)queueMicrotask(()=>menu?.querySelector('[role="menuitem"]')?.focus({preventScroll:true}));}
function unclaimedMailCount(){return [0,1,2].filter(index=>!V?.mail?.includes(index)).length;}
function prefs(){document.body.classList.toggle("reduce",!!settings.reduce);document.body.classList.toggle("contrast",!!settings.contrast);document.documentElement.style.setProperty("--scale",settings.large?"1.12":"1");}
prefs();
const audioManager=new AudioManager({settings,onSettingsChange:()=>browserStore.saveSettings()});
audioManager.attachDocument(document);
const connection=new AdventureConnection({url:websocketUrl(location,room),playerId:id,WebSocketImpl:WebSocket,onState:view=>{if(view.spectator){$("#app").innerHTML='<div class="empty">This adventure belongs to another player. <a href="/">Open your own adventure</a></div>';return;}receiveView(view);},onError:error=>{pending=false;notify(error);draw();},onStatus:value=>{connected=value;if(value)return;pending=false;if(playback)finishPlayback();else if(V)draw();else $("#connection").textContent="Connection interrupted. Reconnecting…";}});
function receiveView(next){
 const previous=latestView;latestView=next;pending=false;
 if(playback){
  // Presence broadcasts for the same saved turn must not restart its animation.
  if(previous?.battle?.id===next.battle?.id&&previous?.battle?.round===next.battle?.round)return;
  finishPlayback();return;
 }
 if(previous&&router.current==='battle'&&previous.battleV3?.id===next.battleV3?.id&&next.battleV3?.turnSnapshots?.initial&&next.battleV3.events?.some(event=>event.kind==='turnStarted')){
  V=next;announceNotice(!!previous);closeModal();draw();void v3BattleScreen.playTurn(next.battleV3,{reduced:!!settings.reduce||matchMedia('(prefers-reduced-motion: reduce)').matches,speed:settings.battleSpeed===2?2:1,catalog:v3TrainingEditor.catalog});return;
 }
 if(previous&&router.current==="battle"&&previous.battle&&!previous.battle.result&&next.battle?.id===previous.battle.id&&next.battle.round===previous.battle.round+1&&next.battle.eventsRound===previous.battle.round&&next.battle.events?.length){
  void playTurn(previous,next);return;
 }
 if(previous?.battle?.round!==next.battle?.round)commands={};
 V=next;announceNotice(!!previous);draw();if(modalId!==null)detail(modalId);
}
function announceNotice(show=true){if(show&&V.notice!==lastNotice)notify(V.notice);lastNotice=V.notice;}
function finishPlayback(){
 playbackVersion++;playback?.cancel();playback=null;pending=false;commands={};
 if(latestView){V=latestView;announceNotice();draw();}
}
async function playTurn(previous,next){
 const version=++playbackVersion;
 playback=new BattleAnimator({speed:settings.battleSpeed===2?2:1,reduced:!!settings.reduce||matchMedia('(prefers-reduced-motion: reduce)').matches});
 const animator=playback;
 V={...previous,battle:{...previous.battle,log:["Turn "+previous.battle.round],events:[]}};
 closeModal();draw();
 document.querySelector('.battlehead')?.scrollIntoView({block:'start',behavior:animator.reduced?'auto':'smooth'});
 try{
  await animator.play(next.battle.events,frame=>{
   if(version!==playbackVersion||router.current!=="battle")return;
   V={...V,battle:{...V.battle,...frame}};draw();
  });
 }catch(error){console.error('Battle animation:',error);}
 finally{if(version===playbackVersion)finishPlayback();}
}
function send(a){if(pending||playback)return;if(!connection.sendAction(a)){notify("Reconnecting. Please try again shortly.");return;}pending=true;draw();}
const economyActionId=kind=>`${kind}:${crypto.randomUUID()}`;
const redrawWorkspace=()=>{if(V&&['home','training','collection','teams','recruitment','missions','gym','guide'].includes(router.current))draw();};
const trainingEditor=new TrainingEditor({fetchImpl:url=>fetch(url),onChange:redrawWorkspace,sendAction:send});
const boxView=new BoxView({onChange:redrawWorkspace});
const teamBuilder=new TeamBuilder({onChange:redrawWorkspace,sendAction:send});
const v2BattleScreen=new V2BattleScreen({onChange:()=>{if(V&&router.current==='battle')draw();},sendAction:send});
const damageInspector=new DamageInspector({fetchImpl:(...args)=>fetch(...args),getDraft:()=>trainingEditor.draft});
const recruitmentView=new RecruitmentView({onChange:redrawWorkspace,sendAction:send,createActionId:kind=>economyActionId(kind)});
const v3TrainingEditor=new V3TrainingEditor({fetchImpl:url=>fetch(url),onChange:redrawWorkspace,sendAction:send,createActionId:kind=>economyActionId(kind)});
const v3TeamBuilder=new V3TeamBuilder({onChange:redrawWorkspace,sendAction:send,createActionId:kind=>economyActionId(kind)});
const v3BattleScreen=new V3BattleScreen({onChange:()=>{if(V&&router.current==='battle')draw();},sendAction:send,playbackSpeed:settings.battleSpeed===2?2:1,onPlaybackSpeedChange:speed=>{settings.battleSpeed=speed;browserStore.saveSettings();},onPresentationCue:cue=>document.dispatchEvent(new CustomEvent('aether:battle-presentation',{detail:cue})),onAudioCue:cue=>document.dispatchEvent(new CustomEvent('aether:battle-audio-cue',{detail:cue}))});
const v3RecruitmentView=new V3RecruitmentView({sendAction:send,createActionId:kind=>economyActionId(kind.replaceAll('.','-')),onChange:redrawWorkspace});
const v3OverviewView=new V3OverviewView({onChange:redrawWorkspace});
const missionView=new MissionView({sendAction:send,onChange:redrawWorkspace,createActionId:kind=>economyActionId(kind)});
const replicaTeamsView=new ReplicaTeamsView({sendAction:send,onChange:redrawWorkspace,onNotify:notify,createActionId:kind=>economyActionId(kind)});
const gameUi=new GameUiController({root:()=>document.querySelector('[data-game-ui-scope="battle"]'),onCancel:()=>V?v3BattleScreen.handleCancel(V):false,onAction:action=>V?v3BattleScreen.handleUiAction(action,V):false});
const managementUi=new GameUiController({root:()=>document.querySelector('[data-game-ui-scope="management"]'),initialMode:'TRAINING_PROFILE',onCancel:()=>{if(!V)return false;if(router.current==='training')return v3TrainingEditor.handleCancel();if(router.current==='teams')return v3TeamBuilder.handleCancel();if(router.current==='collection')return v3OverviewView.handleArchiveCancel();if(router.current==='recruitment')return v3RecruitmentView.handleCancel();return false;},onAction:action=>{if(!V)return false;if(router.current==='training')return v3TrainingEditor.handleUiAction(action);if(router.current==='teams')return v3TeamBuilder.handleUiAction(action);if(router.current==='collection')return v3OverviewView.handleArchiveUiAction(action,V,v3TrainingEditor.catalog);if(router.current==='recruitment')return v3RecruitmentView.handleUiAction(action,V);return false;}});
trainingEditor.load().catch(error=>notify(error.message));
v3TrainingEditor.load().catch(error=>notify(error.message));
function start(mode,gym){commands={};router.go("battle");if(V.trainingV3&&gym===undefined){send({type:'battleV3.preview.start',mode,difficulty:v3BattleScreen.difficulty});return;}const team=V.trainingV2.teams.find(entry=>entry.teamId===V.trainingV2.activeTeamId),regulationId=team?.buildIds.length===6?`alpha-${mode}`:'sandbox-v2';send({type:"battleV2.preview.start",mode,regulationId,...(gym===undefined?{}:{gym}),difficulty:gym===undefined?v2BattleScreen.difficulty:'hard'});}
function types(d){return '<div class="types">'+d.types.map(t=>'<span class="type" style="--c:'+V.colors[V.types.indexOf(t)]+'">'+t+'</span>').join("")+'</div>';}
function head(title,sub,kicker="YOUR ADVENTURE"){return '<div class="heading"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p>'+sub+'</p></div><span class="pill">✦ &nbsp; VANGUARD LEAGUE · LOCAL PREVIEW</span></div>';}
function home(){
 if(V.trainingV3)return head("Welcome back, Challenger.","The Regulation M-A core battle beta is ready for local testing.")+v3OverviewView.renderHome(V,v3TrainingEditor.catalog,{art:pokemonArtwork});
 return head("Welcome back, Challenger.","A new legend starts with your next battle.")+renderV2Tutorial(V)+
 '<section class="hero"><div class="herocopy"><div class="eyebrow">THE VANGUARD LEAGUE AWAITS</div><h2>YOUR TEAM.<br>YOUR TACTICS.<br><em>YOUR LEGEND.</em></h2><p>Forge an elemental team. Outsmart your rivals. Prepare for the Vanguard League.</p>'+btn("Enter the arena &nbsp; ↗","nav:battle","primary")+'</div><div class="heroart"><div class="ring"></div>'+art(0)+art(1)+'<span class="spark">✦</span></div><div class="herotag">REGULATION M-A · DATA MIGRATION IN PROGRESS.</div></section>'+
 '<div class="dashboard"><div><div class="sectiontitle"><h2>Choose your battle</h2><small>AI CHALLENGERS · TEAM OF 4</small></div><div class="modegrid"><button class="modecard" data-action="start:single"><small>CLASSIC FORMAT</small><span class="modeicon">⚔</span><h3>Single Battle</h3><p>One Pokémon at a time.<br>Every decision counts.</p><span class="arrow">Find a challenger &nbsp; →</span></button><button class="modecard double" data-action="start:double"><small>TACTICAL FORMAT</small><span class="modeicon">✧</span><h3>Double Battle</h3><p>Two Pokémon. One strategy.<br>Discover powerful synergies.</p><span class="arrow">Build your synergy &nbsp; →</span></button></div><div class="sectiontitle" style="margin-top:26px"><h2>Your battle team</h2>'+btn("Manage team →","nav:collection","small ghost")+'</div><div class="teamstrip">'+V.team.map(id=>{const m=V.collection.find(x=>x.id===id);return '<button class="mini" data-action="detail:'+id+'">'+art(id)+'<b>'+V.catalog[id].name+'</b><small>Lv. '+m.level+' · '+V.catalog[id].types[0]+'</small></button>';}).join("")+'</div></div><aside><div class="panel"><div class="sectiontitle"><h2>Your journey</h2><span style="color:var(--gold)">✧</span></div>'+[
 ["Build your collection",V.collection.length,36,"36 temporary migration fixtures"],
 ["Claim the six badges",V.badges.length,6,"Conquer every gym"],
 ["First league victory",Math.min(V.wins,1),1,"+300 crystals in your mailbox"]
 ].map(([n,v,max,r])=>'<div class="mission"><b>'+n+'</b><small>'+v+' / '+max+' completed</small><div class="progress"><i style="width:'+100*v/max+'%"></i></div><span class="reward">'+r+'</span></div>').join("")+'</div><div class="panel" style="margin-top:15px;background:linear-gradient(120deg,#342b3e,#1c2436)"><div class="eyebrow" style="color:#ccb1eb">RECRUITMENT</div><h3 style="margin:10px 0">Choose your next partner</h3><p style="font-size:11px">Eight equal-chance offers. Trial one for seven days.</p>'+btn("Open Recruitment →","nav:recruitment","small ghost")+'</div></aside></div>';
}
function archive(training=false){
 if(training&&V.trainingV3)return head("Pokémon Summary & Training","Tune your Regulation M-A partner through Profile, Stats, Moves and Loadout pages.","PARTY · SUMMARY")+v3TrainingEditor.render(V);
 if(training)return head("Training room","Create competitive builds with stats, an Ability, four moves and one held item.")+trainingEditor.render(V,{art})+damageInspector.render(V,trainingEditor.catalog);
 if(V.trainingV3)return head("Pokédex Archive","Browse every canonical Regulation M-A entry, its forms and your ownership state.","POKÉDEX · REGULATION M-A")+v3OverviewView.renderArchive(V,v3TrainingEditor.catalog,{art:pokemonArtwork});
 return head("Pokémon archive","Browse permanent, trial and locked Pokémon, their builds and team usage.")+boxView.render(V,trainingEditor.catalog,{art});
}
function updateV3ArchiveInput(target){
 if(!V?.trainingV3||router.current!=='collection'||!v3OverviewView.handleArchiveInput(target,{notify:false}))return false;
 const current=document.querySelector('.pokedex-shell'),template=document.createElement('template');template.innerHTML=v3OverviewView.renderArchive(V,v3TrainingEditor.catalog,{art:pokemonArtwork});const next=template.content.querySelector('.pokedex-shell');
 if(!current||!next){draw();return true;}
 const currentIndex=current.querySelector('.pokedex-index'),nextIndex=next.querySelector('.pokedex-index'),currentHead=currentIndex?.querySelector('.pokedex-index-head'),nextHead=nextIndex?.querySelector('.pokedex-index-head'),currentResults=currentIndex?.querySelector('.pokedex-grid,.pokedex-empty'),nextResults=nextIndex?.querySelector('.pokedex-grid,.pokedex-empty'),currentDetail=current.querySelector('.pokedex-detail'),nextDetail=next.querySelector('.pokedex-detail');
 if(currentHead&&nextHead)currentHead.replaceWith(nextHead);else if(currentHead&&!nextHead)currentHead.remove();else if(!currentHead&&nextHead)currentIndex.prepend(nextHead);
 if(currentResults&&nextResults)currentResults.replaceWith(nextResults);
 if(currentDetail&&nextDetail)currentDetail.replaceWith(nextDetail);else if(currentDetail&&!nextDetail)currentDetail.remove();else if(!currentDetail&&nextDetail)current.append(nextDetail);
 return true;
}
function trainingPage(){if(!V.trainingV3)return archive(true);if(trainingHubMode==='pokemon')return head("Pokémon Training","Choose an owned Pokémon, prepare its training plan and pay only for changes.","TRAINING ROOM · POKÉMON")+v3TrainingEditor.render(V);if(trainingHubMode==='replica')return head("Replica Teams","Share your party as a portable Team ID or apply a team you are eligible to use.","TRAINING ROOM · REPLICA TERMINAL")+replicaTeamsView.render(V,v3TrainingEditor.catalog);return head("Training Room","Choose how you want to prepare for your next battle.","TRAINING ROOM")+'<div class="training-hub"><button class="training-hub-card panel" data-action="training-mode:pokemon"><span>◆</span><small>INDIVIDUAL TRAINING</small><h2>Pokémon Training</h2><p>Choose an owned Pokémon, then adjust Stat Points, Nature, Ability and moves using VP.</p><strong>Open Pokémon Training →</strong></button><button class="training-hub-card panel" data-action="training-mode:replica"><span>▦</span><small>TEAM SHARING</small><h2>Replica Teams</h2><p>Generate a Team ID to share your current party, or paste another trainer’s ID and apply it when you meet every requirement.</p><strong>Open Replica Terminal →</strong></button></div>';}
function missions(){return head("Missions","Complete activities across your adventure and collect time-limited rewards.","VANGUARD LEAGUE · MISSION BOARD")+missionView.render(V);}
function updateV3ArchiveSelection(target){
 if(!V?.trainingV3||router.current!=='collection'||target.dataset.v3Archive!=='select'||!v3OverviewView.handleArchiveClick(target,V,v3TrainingEditor.catalog,{notify:false}))return false;
 const current=document.querySelector('.pokedex-shell'),template=document.createElement('template');template.innerHTML=v3OverviewView.renderArchive(V,v3TrainingEditor.catalog,{art:pokemonArtwork});const next=template.content.querySelector('.pokedex-shell'),nextDetail=next?.querySelector('.pokedex-detail'),currentDetail=current?.querySelector('.pokedex-detail');
 if(!current||!nextDetail||!currentDetail){draw();return true;}
 current.querySelector('.pokedex-entry.selected')?.classList.remove('selected');
 target.classList.add('selected');
 currentDetail.replaceWith(nextDetail);
 target.focus({preventScroll:true});
 return true;
}
function updateV3RecruitmentSelection(target){
 if(!V?.trainingV3||router.current!=='recruitment'||target.dataset.v3Recruit!=='select'||!v3RecruitmentView.handleClick(target,V,{notify:false}))return false;
 const current=document.querySelector('.ranch-shell'),template=document.createElement('template');template.innerHTML=v3RecruitmentView.render(V,v3TrainingEditor.catalog,{art:pokemonArtwork});const next=template.content.querySelector('.ranch-shell'),nextDetail=next?.querySelector('.ranch-detail'),currentDetail=current?.querySelector('.ranch-detail');
 if(!current||!nextDetail||!currentDetail){draw();return true;}
 current.querySelector('.ranch-offer.selected')?.classList.remove('selected');
 target.classList.add('selected');
 currentDetail.replaceWith(nextDetail);
 target.focus({preventScroll:true});
 return true;
}
function teamsPage(){return head("Pokémon Party","Arrange six Regulation M-A partners and their saved battle builds.","PARTY · TEAM")+(V.trainingV3?v3TeamBuilder.render(V,v3TrainingEditor.catalog):teamBuilder.render(V,trainingEditor.catalog,{art}));}
function recruitment(){if(V.trainingV3)return head("Roster Ranch","Choose from ten rotating Regulation M-A partners, start a Trial or recruit permanently.","RECRUITMENT · REGULATION M-A")+v3RecruitmentView.render(V,v3TrainingEditor.catalog,{art:pokemonArtwork});return head("Recruitment","Choose one of eight Pokémon, start a seven-day trial, or recruit it permanently.","RECRUITMENT · SERVER UTC")+recruitmentView.render(V,trainingEditor.catalog,{art});}
const gyms=["Ember Coast","Wild Current","Frozen Quarry","Skyfall Spire","Eclipse Garden","Astral Citadel"];
function gym(){if(V.trainingV3)return head("The road to champion","Gym progression will open after the core battle and Roster Ranch beta gates.","GYM · SCHEMA 3 ROADMAP")+v3OverviewView.renderGym(V,v3TrainingEditor.catalog,{art:pokemonArtwork});return head("The road to champion","Six leaders. Six badges. One place at the top.")+'<div class="filters"><label>Battle format &nbsp; <select id="gymmode"><option value="single">Single battle</option><option value="double">Double battle</option></select></label></div><div class="gymgrid">'+gyms.map((n,i)=>'<div class="panel gym '+(i>V.badges.length?"locked":"")+'">'+art(i*6+1)+'<div class="eyebrow">GYM 0'+(i+1)+' · LEVEL '+(5+i*3)+'</div><h2>'+n+'</h2><p>'+V.catalog[i*6].types[0]+' / '+V.catalog[i*6+3].types[0]+' specialists</p><span class="reward">'+(V.badges.includes(i)?"✦ Badge earned":"First victory: +380 crystals · +680 coins")+'</span><br>'+btn(i>V.badges.length?"Locked":V.badges.includes(i)?"Challenge again →":"Challenge leader →","gym:"+i,i===V.badges.length?"primary":"",i>V.badges.length)+'</div>').join("")+'</div>';}
function mail(){const gifts=[{title:'Welcome Gift',sender:'Vanguard League Operations',body:'Thank you for joining the beta. Please accept these supplies for your adventure.',coins:500,crystals:500,tickets:3},{title:'Training Room Update Gift',sender:'Vanguard Training Center',body:'Pokémon Training and Replica Teams are now available. These supplies will help you test the new systems.',coins:1200,crystals:300,tickets:5},{title:'Mission Board Opening Gift',sender:'League Mission Office',body:'The Mission Board is open. Here is a small launch gift from the League staff.',coins:800,crystals:500,tickets:5}];return head("Mailbox","Official gifts and notices sent directly by the Vanguard League.","VANGUARD LEAGUE · MAIL")+'<div class="mail-gift-list">'+gifts.map((gift,i)=>{const done=V.mail.includes(i);return '<article class="panel mailrow mail-gift"><div class="mailicon">✉</div><div class="mailtext"><div class="eyebrow">FROM · '+gift.sender+'</div><h3>'+gift.title+'</h3><p>'+gift.body+'</p><span class="reward">◈ '+gift.coins.toLocaleString()+' VP &nbsp; ✦ '+gift.crystals.toLocaleString()+' crystals &nbsp; 🎟 '+gift.tickets+' tickets</span></div>'+btn(done?"Received":"Receive gift","claim:"+i,"primary",done||pending)+'</article>';}).join('')+'</div>';}
function settingsPage(){return head("Settings","Make the arena feel like home.")+'<div class="panel">'+[
 ["reduce","Reduced motion","Show quick battle updates without movement, particles, or flashes."],
 ["contrast","High contrast","Increase contrast for secondary text and borders."],
 ["large","Larger text","Increase interface text size for easier reading."]
 ].map(([key,title,desc])=>'<label class="settingsrow"><div><b>'+title+'</b><p>'+desc+'</p></div><input type="checkbox" data-setting="'+key+'" '+(settings[key]?"checked":"")+'></label>').join("")+'<div class="settingsrow"><div><b>Adventure account</b><p>'+esc(auth?.name||'Local player')+' · '+esc(auth?.provider||'browser')+'. Your progress is saved under this account.</p></div>'+btn('Sign out','logout','small ghost')+'</div><div class="settingsrow"><div><b>Adventure save</b><p>Saved automatically under your authenticated adventure identity.</p></div><span class="pill">'+(connected?"Connected":"Reconnecting")+'</span></div><label class="settingsrow"><div><b>Audio</b><p>Enable local synthesized UI and battle cues. No external audio files are required.</p></div><input type="checkbox" data-audio-enabled '+(settings.audio!==false?'checked':'')+'></label><label class="settingsrow audio-volume-row"><div><b>Audio volume</b><p>Master volume for UI and battle presentation cues.</p></div><input type="range" min="0" max="1" step="0.05" value="'+esc(settings.audioVolume??.55)+'" data-audio-volume aria-label="Audio volume"></label></div>';}
function live(side){return V.battle[side].map((m,i)=>({m,i})).filter(x=>x.m.hp>0&&x.m.slot>=0).sort((a,b)=>a.m.slot-b.m.slot);}
function animationBar(){return '<div class="battle-announcer" role="status" aria-live="polite"><div><strong>'+(playback?esc(playback.currentCaption?.title||'Battle in motion…'):'Choose your moves')+'</strong><span>'+(playback?esc(playback.currentCaption?.subtitle||'Playing actions in speed order'):'Elemental attacks · Hold items · Team synergy')+'</span></div><div class="playback-controls"><label>Speed <select data-battle-speed aria-label="Battle animation speed" '+(playback?'disabled':'')+'><option value="1" '+(settings.battleSpeed!==2?'selected':'')+'>1×</option><option value="2" '+(settings.battleSpeed===2?'selected':'')+'>2×</option></select></label>'+(playback?btn('Skip ⏭','skip-animation','small ghost'):'')+'</div></div>';}
function ensureCommands(){for(const {m,i} of live("allies"))if(!commands[i])commands[i]={kind:"move",actor:i,move:0,target:live("enemies")[0]?.i};}
function fighter(m,side,i){return '<div class="fighter" data-fighter="'+side+'-'+i+'">'+art(m.id)+'<div class="hpbox"><strong>'+V.catalog[m.id].name+'<span>Lv.'+m.level+'</span></strong><div class="progress"><i class="'+(m.hp<m.max*.3?"low":"")+'" style="width:'+m.hp/m.max*100+'%"></i></div><small>'+m.hp+'/'+m.max+' HP · '+m.energy+' EN'+(m.status?" · "+m.status.toUpperCase():"")+'</small></div></div>';}
function battle(){
 if(V.battle?.result)return head("Legacy battle complete","Your v1 result was saved safely before the adventure upgrade.")+`<section class="panel v2-result"><small>LEGACY V1 · MATCH COMPLETE</small><h2>${esc(V.battle.result)}</h2><p>+${V.battle.reward?.coins||0} coins · +${V.battle.reward?.gems||0} crystals</p>${btn("Continue to Vanguard battles","legacy-finish","primary")}</section>`;
 if(V.trainingV3){const catalog=v3TrainingEditor.catalog;return v3BattleScreen.render(V,catalog,{art:pokemonArtwork,battleArt:pokemonBattleArt});}
 if(!V.battle)return head("Battle arena","Choose your lineup in Team Preview, then battle with the phase-based engine.")+v2BattleScreen.render(V,trainingEditor.catalog,{art});
 const b=V.battle;if(!b)return head("Battle arena","Choose your format and face an AI challenger.")+'<div class="modegrid"><div class="panel"><h2>Single Battle</h2><p>One active monster per side. Bring up to four.</p>'+btn("Start single battle","start:single","primary")+'</div><div class="panel"><h2>Double Battle</h2><p>Two active monsters per side. Combine their strengths.</p>'+btn("Start double battle","start:double","primary")+'</div></div><div class="panel" style="margin-top:20px"><h3>Ready your team</h3><p>Manage your lead monsters, held items and levels before entering.</p>'+btn("Manage battle team →","nav:collection","ghost")+'</div>';
 ensureCommands();
 return '<div class="battlehead"><div><div class="eyebrow">'+(b.gym===null?"EXHIBITION MATCH":gyms[b.gym].toUpperCase())+'</div><h1>'+ (b.mode==="double"?"Double":"Single")+' Battle <span style="color:var(--muted);font-size:18px">/ Turn '+b.round+'</span></h1></div>'+btn("Type chart","chart","small ghost")+'</div>'+animationBar()+'<div class="arena" data-playing="'+!!playback+'" data-weather="'+b.weather+'"><div class="fieldlabel">'+b.weather.toUpperCase()+' '+(b.weatherTurns?"· "+b.weatherTurns+" TURNS":"")+'</div><div class="fighters enemies">'+live("enemies").map(({m,i})=>fighter(m,"enemies",i)).join("")+'</div><div class="fighters allies">'+live("allies").map(({m,i})=>fighter(m,"allies",i)).join("")+'</div></div>'+
 (b.result?'<div class="result"><div class="eyebrow">MATCH COMPLETE</div><h2>'+b.result+'</h2><p>+'+b.reward.coins+' coins &nbsp; +'+b.reward.gems+' crystals</p>'+btn("Battle again","start:"+b.mode,"primary")+' '+btn("Return to command center","nav:home","ghost")+'</div>':
 '<div class="battlemain"><div><div class="commands" '+(b.mode==="single"?'style="grid-template-columns:1fr"':"")+'>'+live("allies").map(({m,i})=>{
 const d=V.catalog[m.id],c=commands[i];return '<div class="panel command"><h3>'+d.name+' <span style="color:var(--accent);font-size:11px">· '+m.energy+'/5 ENERGY</span></h3><div class="moves">'+d.moves.map((mv,k)=>'<button class="move '+(c.kind==="move"&&c.move===k?"chosen":"")+'" style="--c:'+V.colors[V.types.indexOf(mv.type)]+'" data-action="move:'+i+':'+k+'" '+(m.energy<mv.cost?"disabled":"")+'><b>'+mv.name+'</b><small>'+mv.type+' · '+(mv.power?mv.power+" PWR":"UTILITY")+' · '+mv.cost+' EN</small></button>').join("")+'</div><select class="targetselect" data-target="'+i+'" aria-label="Target for '+d.name+'">'+live("enemies").map(t=>'<option value="'+t.i+'" '+(c.target===t.i?"selected":"")+'>'+V.catalog[t.m.id].name+' · '+t.m.hp+' HP</option>').join("")+'</select><select class="targetselect" data-switch="'+i+'" aria-label="Switch '+d.name+'"><option value="-1">Use selected move</option>'+b.allies.map((r,j)=>({r,j})).filter(x=>x.r.hp>0&&x.r.slot<0).map(({r,j})=>'<option value="'+j+'" '+(c.kind==="switch"&&c.to===j?"selected":"")+'>Switch → '+V.catalog[r.id].name+' ('+r.hp+' HP)</option>').join("")+'</select></div>';}).join("")+'</div><div class="turnfooter">'+btn(pending?"Resolving…":"Resolve turn →","resolve","primary",pending)+btn("Surrender","surrender","small ghost",pending)+'<small>Actions resolve in speed order.</small></div><div class="reserves">'+b.allies.filter(m=>m.slot<0).map(m=>'<span>'+V.catalog[m.id].name+' · '+(m.hp?m.hp+" HP":"Fainted")+'</span>').join("")+'</div></div><div class="panel battlelog"><h3>Battle log</h3>'+b.log.map(l=>'<p>'+esc(l)+'</p>').join("")+'</div></div>')+(b.result?'<div class="panel battlelog" style="margin-top:16px">'+b.log.map(l=>'<p>'+esc(l)+'</p>').join("")+'</div>':"");
}
function draw(){
 if(!V)return;
 const page=router.current;document.body.dataset.appScreen=page;
 const continuity=captureRenderContinuity(page),t=performance.now();if(page!=='recruitment'){recruitmentView.stopTicker();v3RecruitmentView.stopTicker();}const content={home,collection:()=>archive(false),teams:teamsPage,recruitment,missions,training:trainingPage,gym,mail,settings:settingsPage,battle}[page](),footerSummary=V.trainingV3?`${V.trainingV3.mons.length} / ${v3TrainingEditor.catalog?.species.length||V.trainingV3.mons.length} BETA POKÉMON · SCHEMA 3`:V.collection.length+' / '+V.catalog.length+' DISCOVERED &nbsp; · &nbsp; '+V.badges.length+' / 6 BADGES',immersiveBattle=page==='battle'&&!!V.trainingV3;
 if(immersiveBattle)$("#app").innerHTML='<div class="battle-shell-layout"><main class="battle-content">'+content+'</main></div>';
  else $("#app").innerHTML='<div class="shell"><aside class="sidebar"><div class="brand"><div class="brandmark project-logo"><img src="/logo.png" alt="" aria-hidden="true"></div><div class="brandname">POKÉMON<small>VANGUARD</small></div></div><div class="navlabel">PLAY & DISCOVER</div><div class="navs">'+navs.map(([k,icon,label])=>'<button class="nav '+(page===k?"active":"")+'" data-action="nav:'+k+'"><span class="icon">'+icon+'</span>'+label+(k==="mail"&&unclaimedMailCount()?'<span class="badge">'+unclaimedMailCount()+'</span>':k==="missions"&&V.missions?.claimableCount?'<span class="badge">'+V.missions.claimableCount+'</span>':"")+'</button>').join("")+'</div><div class="sidefoot"><span class="online">● '+(connected?"ADVENTURE SAVED":"RECONNECTING")+'</span><p>'+esc(auth?.name||'Local player')+'<br>'+esc(auth?.provider||'browser')+' account</p></div></aside><div><header class="topbar"><div class="breadcrumb">Vanguard League &nbsp; / &nbsp; <b>'+(navs.find(n=>n[0]===page)?.[2]||'Settings')+'</b></div><div class="resources"><div class="currency"><span>◈</span>'+V.coins.toLocaleString()+'</div><div class="currency crystal"><span>✦</span>'+V.gems.toLocaleString()+'</div><div class="currency"><span>🎟</span>'+(V.recruitmentTickets||0).toLocaleString()+'</div>'+accountControl()+'</div></header><main class="content" data-ui-scroll-container data-ui-scroll-key="page-content">'+content+'<footer class="bottomnote"><span>✦ &nbsp; POKÉMON VANGUARD</span><span>'+footerSummary+'</span></footer></main></div></div>';
 renderedPage=page;const focusRestored=restoreRenderContinuity(continuity);
 if(immersiveBattle){gameUi.setMode(v3BattleScreen.uiMode(V));if(!focusRestored)gameUi.ensureFocus();}
 if(V.trainingV3&&page==='training'&&trainingHubMode==='pokemon'){managementUi.setMode(v3TrainingEditor.uiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(V.trainingV3&&page==='teams'){managementUi.setMode(v3TeamBuilder.uiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(V.trainingV3&&page==='collection'){managementUi.setMode(v3OverviewView.archiveUiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(V.trainingV3&&page==='recruitment'){managementUi.setMode(v3RecruitmentView.uiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(playback){
  document.querySelectorAll('.commands button,.commands select,.turnfooter button').forEach(el=>{el.disabled=true;});
  const resolve=document.querySelector('[data-action="resolve"]');if(resolve)resolve.textContent='Playing turn…';
 }
 if(new URLSearchParams(location.search).has("debug"))$("#app").insertAdjacentHTML("beforeend",'<div class="debug">Render '+(performance.now()-t).toFixed(1)+' ms · '+document.querySelectorAll("svg").length+' visible creatures</div>');
}
function focusModal(){if(!$("#modal").children.length)return;if(!modalReturnFocus)modalReturnFocus=document.activeElement;queueMicrotask(()=>$("#modal").querySelector('button:not(:disabled),select,input')?.focus({preventScroll:true}));}
function closeModal(){const returnFocus=modalReturnFocus;modalReturnFocus=null;modalId=null;$("#modal").innerHTML="";if(returnFocus?.isConnected)queueMicrotask(()=>returnFocus.focus({preventScroll:true}));}
function detail(id){
 modalId=id;const d=V.catalog[id],m=V.collection.find(x=>x.id===id),inTeam=V.team.includes(id),level=m?.level||5;
 $("#modal").innerHTML='<div class="modalback"><section class="modal" role="dialog" aria-modal="true" aria-label="'+d.name+' details">'+btn("✕","close","close small")+'<div class="detail"><div>'+art(id)+'<div class="stats">'+[["HP",d.hp+level*6],["ATK",d.attack+level*2],["DEF",d.defense+level*2],["SPD",d.speed+level*2]].map(([k,v])=>'<div class="stat">'+k+'<b>'+v+'</b></div>').join("")+'</div><p>Stats include level growth. Abilities and held items apply during battle.</p></div><div><span class="pill">REGULATION POOL · #'+String(id+1).padStart(3,"0")+'</span><h2>'+d.name+'</h2>'+types(d)+'<p><b>'+d.ability.name+'</b><br>'+d.ability.desc+'</p><div class="movelist">'+d.moves.map(mv=>'<div class="movedetail"><span style="color:'+V.colors[V.types.indexOf(mv.type)]+'">'+mv.type+'</span><b>'+mv.name+'</b><small>'+mv.power+' power · '+mv.cost+' energy</small><p>'+mv.desc+(["burn","poison","slow"].includes(mv.effect)?" Applies "+mv.effect+" for 3 turns.":"")+'</p></div>').join("")+'</div></div></div>'+
 (m?'<div class="detailactions">'+btn(inTeam?"Remove from team":"Add to team","team:"+id,"primary",pending||(!inTeam&&V.team.length>=4)||(inTeam&&V.team.length===1))+(inTeam?btn("Make lead","lead:"+id,"",pending):"")+btn(m.level>=30?"Maximum level":"Train Lv. "+m.level+" → "+(m.level+1)+" · "+m.level*30+" coins","train:"+id,"",pending||m.level>=30||V.coins<m.level*30)+'</div><div class="detailactions"><label>Held item &nbsp;<select id="equip" data-id="'+id+'">'+V.items.map((v,i)=>'<option value="'+i+'" '+(m.item===i?"selected":"")+'>'+v.name+'</option>').join("")+'</select></label><p>'+V.items[m.item].desc+'</p></div>':'<p class="empty">Open Recruitment to add this species to your roster.</p>')+'</section></div>';focusModal();
}
function chart(){
 modalId=null;$("#modal").innerHTML='<div class="modalback"><section class="modal" role="dialog" aria-modal="true" aria-label="Type effectiveness">'+btn("✕","close","close small")+'<h2>Type effectiveness</h2><p style="font-size:12px">Rows attack → columns defend. Dual types multiply. 2× strong · ½× resisted · 0× immune.</p><div class="tablewrap"><table class="chart"><thead><tr><th>ATK ↓ DEF →</th>'+V.types.map(t=>'<th>'+t+'</th>').join("")+'</tr></thead><tbody>'+V.types.map((t,i)=>'<tr><th>'+t+'</th>'+V.typeChart[i].map(v=>'<td class="'+(v>1?"good":v<1?"bad":"")+'">'+(v===.5?"½":v)+'×</td>').join("")+'</tr>').join("")+'</tbody></table></div></section></div>';focusModal();
}
document.addEventListener("click",async e=>{
 if(e.target.classList?.contains('modalback')){closeModal();return;}
 if(userMenuOpen&&!e.target.closest('.user-menu'))setUserMenu(false);
 const el=e.target.closest("[data-action],[data-mission],[data-replica],[data-training],[data-box],[data-team],[data-recruit],[data-v3-recruit],[data-v3-archive],[data-v2battle],[data-v3-battle],[data-damage],[data-v3-training],[data-v3-team]");if(!el||el.disabled)return;if(el.dataset.mission){missionView.handleClick(el);return;}if(el.dataset.replica){await replicaTeamsView.handleClick(el,V,v3TrainingEditor.catalog);return;}if(el.dataset.v3Battle){v3BattleScreen.handleClick(el,V,v3TrainingEditor.catalog);return;}if(el.dataset.v3Training){v3TrainingEditor.handleClick(el,V);return;}if(el.dataset.v3Team){v3TeamBuilder.handleClick(el,V,v3TrainingEditor.catalog);return;}if(el.dataset.v3Recruit){if(!updateV3RecruitmentSelection(el))v3RecruitmentView.handleClick(el,V);return;}if(el.dataset.v3Archive){if(!updateV3ArchiveSelection(el))v3OverviewView.handleArchiveClick(el,V,v3TrainingEditor.catalog);return;}if(el.dataset.damage){void damageInspector.handleClick(el,V,trainingEditor.catalog);return;}if(el.dataset.training){trainingEditor.handleClick(el,V);return;}if(el.dataset.box){boxView.handleClick(el,V,{openTraining:monId=>{trainingEditor.select(V.trainingV2,monId);router.go('training');draw();}});return;}if(el.dataset.team){teamBuilder.handleClick(el,V,trainingEditor.catalog);return;}if(el.dataset.recruit){recruitmentView.handleClick(el,V);return;}if(el.dataset.v2battle){v2BattleScreen.handleClick(el,V,trainingEditor.catalog);return;}const [a,b,c]=el.dataset.action.split(":");
 if(a==="skip-animation"){finishPlayback();return;}
 if(a==="account-menu"){setUserMenu(!userMenuOpen,{focusMenu:!userMenuOpen});return;}
 if(a==="profile"||a==="settings"){setUserMenu(false);if(router.go('settings')){closeModal();draw();window.scrollTo(0,0);}return;}
 if(a==="logout"){setUserMenu(false);connection.stop();await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});location.assign('/');return;}
 if(playback){if(a!=="nav")return;finishPlayback();}
 if(a==="nav"&&router.go(b)){if(b==='training')trainingHubMode=null;v3BattleScreen.cancelPlayback();closeModal();draw();window.scrollTo(0,0);}
 if(a==="training-mode"){trainingHubMode=b;draw();window.scrollTo(0,0);}
 if(a==="training-home"){trainingHubMode=null;draw();window.scrollTo(0,0);}
 if(a==="training"&&V.trainingV3){trainingHubMode='pokemon';router.go('training');v3BattleScreen.cancelPlayback();closeModal();v3TrainingEditor.openSelection();v3TrainingEditor.select(V.trainingV3,b);window.scrollTo(0,0);}
 if(a==="start")start(b);
 if(a==="detail")detail(+b);
 if(a==="close")closeModal();
 if(a==="chart")chart();
 if(a==="gym")start($("#gymmode").value,+b);
 if(a==="claim")send({type:"mail.claim",mailId:+b,actionId:economyActionId("mail")});
 if(a==="train")send({type:"train",id:+b});
 if(a==="team")send({type:"team",ids:V.team.includes(+b)?V.team.filter(i=>i!==+b):[...V.team,+b]});
 if(a==="lead")send({type:"team",ids:[+b,...V.team.filter(i=>i!==+b)]});
 if(a==="move"){commands[+b]={...commands[+b],kind:"move",move:+c};draw();}
 if(a==="resolve")send({type:"turn",round:V.battle.round,commands:live("allies").map(x=>commands[x.i])});
 if(a==="surrender"){if(confirm("Surrender this battle? No rewards will be granted."))send({type:"surrender"});}
 if(a==="legacy-finish")send({type:"legacy.finish"});
});
document.addEventListener("change",e=>{
 const t=e.target;
 if(v3BattleScreen.handleInput(t))return;
 if(damageInspector.handleInput(t,V,trainingEditor.catalog))return;
 if(v2BattleScreen.handleInput(t))return;
 if(v3TrainingEditor.handleInput(t)||v3TeamBuilder.handleInput(t)||updateV3ArchiveInput(t))return;
 if(boxView.handleInput(t)||teamBuilder.handleInput(t))return;
 if(trainingEditor.handleInput(t))return;
 if(t.hasAttribute('data-battle-speed')){settings.battleSpeed=Number(t.value)===2?2:1;browserStore.saveSettings();return;}
 if(t.hasAttribute('data-audio-enabled')){audioManager.setEnabled(t.checked);return;}
 if(t.hasAttribute('data-audio-volume')){audioManager.setVolume(t.value);return;}
 if(playback)return;
 if(t.dataset.setting){settings[t.dataset.setting]=t.checked;browserStore.saveSettings();prefs();}
 if(t.id==="equip")send({type:"equip",id:+t.dataset.id,item:+t.value});
 if(t.dataset.target!==undefined)commands[+t.dataset.target].target=+t.value;
 if(t.dataset.switch!==undefined){let i=+t.dataset.switch;commands[i]=+t.value<0?{kind:"move",actor:i,move:0,target:live("enemies")[0].i}:{kind:"switch",actor:i,to:+t.value};draw();}
});
document.addEventListener("input",e=>{const t=e.target;if(t.hasAttribute('data-audio-volume')){audioManager.setVolume(t.value);return;}if(replicaTeamsView.handleInput(t)||v3TrainingEditor.handleInput(t)||v3TeamBuilder.handleInput(t)||updateV3ArchiveInput(t)||boxView.handleInput(t)||teamBuilder.handleInput(t))return;trainingEditor.handleInput(t);});
document.addEventListener("keydown",e=>{const modalOpen=$("#modal").children.length>0;if(e.code==="Escape"&&userMenuOpen){e.preventDefault();setUserMenu(false);document.querySelector('[data-action="account-menu"]')?.focus({preventScroll:true});return;}if(!modalOpen&&router.current==="battle"&&V?.trainingV3&&gameUi.handleKeyboard(e))return;const managementPage=["teams","collection","recruitment"].includes(router.current)||router.current==='training'&&trainingHubMode==='pokemon';if(!modalOpen&&V?.trainingV3&&managementPage&&managementUi.handleKeyboard(e))return;if(e.code==="Escape"&&modalOpen){e.preventDefault();closeModal();}if(e.code==="Tab"&&modalOpen){const els=[...$("#modal").querySelectorAll("button:not(:disabled),select,input")];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
connection.start();

// Leaving/resizing the scene commits its already-saved outcome and cancels effects.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)return;if(playback)finishPlayback();v3BattleScreen.cancelPlayback();draw();});
window.addEventListener('resize',()=>{if(playback)finishPlayback();if(v3BattleScreen.playback){v3BattleScreen.cancelPlayback();draw();}});
