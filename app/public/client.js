import {CompletedBattleResults} from "./js/completed-battle-results.js";
import {creature} from "./art.js";
import {BattleAnimator} from "./battle-animation.js";
import {createBrowserStore,availableBrowserStorage} from "./js/store.js";import {ModalFocusManager} from "./js/modal-focus-manager.js";
import {createRouter,NAV_ITEMS} from "./js/router.js";
import {AdventureConnection,websocketUrl} from "./js/net.js";
import {SocialPendingActions} from "./js/social-pending-actions.js";
import {createSocialRetryController} from "./js/social-retry-controller.js";
import {CommercePendingActions,commerceActionLabel,createCommerceRetryController} from "./js/commerce-pending-actions.js";
import {PvpPendingActions,pvpActionLabel,createPvpRetryController} from "./js/pvp-pending-actions.js";
import {captureRenderContinuity,restoreRenderContinuity} from "./js/render-continuity.js";
import {RouteModuleRegistry,createCatalogLoader,createStyleLoader} from "./js/feature-loader.js";
import {V3TrainingEditor} from "./js/v3-training-editor.js";
import {V3TeamBuilder} from "./js/v3-team-builder.js";
import {V3RecruitmentView} from "./js/v3-recruitment-view.js";
import {V3OverviewView} from "./js/v3-overview-view.js";
import {GameUiController} from "./js/ui/core/game-ui-controller.js";
import {presentationAsset,hasBespokeAsset} from "./js/presentation-assets.js";
import {AudioManager} from "./js/audio-manager.js";
import {createGameViewportScaler} from "./js/ui/core/game-viewport-scaler.js";
import {MissionView} from "./js/mission-view.js";
import {renderAccountControl,countUnreadMail,renderMailbox,renderSettingsPage} from "./js/client-chrome-views.js";
import {renderRoutePage,renderClientShell} from "./js/client-shell-layout.js";
import {AccessibilityController,routeLabel} from "./js/accessibility-controller.js";
import {renderConfirmDialog,renderLegacyDetailDialog,renderLegacyTypeChart} from "./js/client-modal-templates.js";
import {routeFeatureClick} from "./js/client-feature-action-router.js";
import {ReplicaTeamsView} from "./js/replica-teams.js";
import {ShopView} from "./js/shop-view.js";
import {BagView} from "./js/bag-view.js";
import {ProfileView} from "./js/profile-view.js";
import {rankedTierEmblem,rankedTierLine,rankedTierNext} from "./js/ranked-tier-view.js";
import {ArenaView} from "./js/arena-view.js";
import {SocialView} from "./js/social-view.js";
import {BATTLE_PRESENTATION_EVENT,BATTLE_AUDIO_EVENT} from "./js/ui/events.js";
import {BattleLogDragController} from "./js/ui/battle-log-drag-controller.js";
createGameViewportScaler().attach();
const browserStore=createBrowserStore({storage:availableBrowserStorage(window),cryptoApi:crypto,locationLike:location});
const auth=window.__PV_AUTH__||null;
const sessionStore=(()=>{try{return sessionStorage;}catch{return null;}})(),accountScope=auth?.accountId||auth?.playerId||browserStore.playerId;
const socialPending=new SocialPendingActions({storage:sessionStore,scope:accountScope});
const commercePending=new CommercePendingActions({storage:sessionStore,scope:accountScope});
const pvpPending=new PvpPendingActions({storage:sessionStore,scope:accountScope});
const accessibility=new AccessibilityController({documentRef:document});
const id=auth?.playerId||browserStore.playerId,room=auth?.roomId||browserStore.room,router=createRouter('home',{onChange:page=>accessibility.routeChanged(page)});
let V=null,commands={},pending=false,modalId=null,lastNotice="",connected=false,joinedReady=false,toastTimer,userMenuOpen=false,trainingHubMode=null,mailOpenKey=null,confirmAction=null;
const modalFocus = new ModalFocusManager();
let latestView=null,playback=null,playbackVersion=0;
const settings=browserStore.settings;
const battleLogDrag=new BattleLogDragController();
if(settings.audio===undefined)settings.audio=true;if(settings.audioVolume===undefined)settings.audioVolume=.55;
const $=s=>document.querySelector(s);
let renderedPage=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const art=id=>'<div class="art">'+creature(id)+'</div>';
const pokemonBattleArt=(id,view='front')=>`<div class="art pokemon-art ${view==='back'?'back-view':'front-view'} ${hasBespokeAsset(id,view)?'':'pokemon-art-missing'}"><img src="${presentationAsset(id,view)}" alt="${esc(id)} ${view} battle presentation"></div>`;
const artworkScale={venusaur:1.03,blastoise:.95,beedrill:1,chesnaught:1,decidueye:1.095,feraligatr:.97};
const pokemonArtwork=id=>`<div class="art pokemon-art pokemon-key-art ${hasBespokeAsset(id,'artwork')?'':'pokemon-art-missing'}" style="--art-scale:${artworkScale[id]||1}"><img src="${presentationAsset(id,'artwork')}" alt="${esc(id)} presentation artwork"></div>`;
const btn=(label,action,cls="",disabled=false)=>'<button class="'+cls+'" data-action="'+action+'" '+(disabled?"disabled":"")+'>'+label+'</button>';
const navs=NAV_ITEMS;
function notify(t){$("#toast").textContent=t;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),4200);}if(!browserStore.persistent)queueMicrotask(()=>notify('Browser storage is unavailable. Local identity and settings will not persist after reload.'));
function accountControl(){return renderAccountControl({auth,userMenuOpen,esc});}
function setUserMenu(open,{focusMenu=false}={}){userMenuOpen=!!open;const trigger=document.querySelector('[data-action="account-menu"]'),menu=document.querySelector('#account-dropdown');trigger?.setAttribute('aria-expanded',String(userMenuOpen));if(menu)menu.hidden=!userMenuOpen;if(userMenuOpen&&focusMenu)queueMicrotask(()=>menu?.querySelector('[role="menuitem"]')?.focus({preventScroll:true}));}
function unreadMailCount(){return countUnreadMail(V);}
function prefs(){document.body.classList.toggle("reduce",!!settings.reduce);document.body.classList.toggle("contrast",!!settings.contrast);document.documentElement.style.setProperty("--scale",settings.large?"1.12":"1");}
prefs();
const audioManager=new AudioManager({settings,onSettingsChange:()=>browserStore.saveSettings()});
audioManager.attachDocument(document);
const connection=new AdventureConnection({url:websocketUrl(location,room),playerId:id,WebSocketImpl:WebSocket,onFatal:()=>{connected=false;joinedReady=false;pending=false;notify('This session is no longer authorized. Sign in again.');if(V)draw();},onState:view=>{if(view.spectator){$("#app").innerHTML='<div class="empty">This adventure belongs to another player. <a href="/">Open your own adventure</a></div>';return;}receiveView(view);},onError:(error,frame)=>{pending=false;if(frame?.actionId){socialPending.reject(frame.actionId,error);commercePending.reject(frame.actionId,error);pvpPending.reject(frame.actionId,error);}v3TeamBuilder?.handleActionError?.(error);notify(error);if(V)draw();},onActionAck:frame=>{if(frame.actionType?.startsWith('socialV1.')&&socialPending.acknowledge(frame.actionId)){pending=false;if(V&&router.current==='friends')draw();}if(commercePending.acknowledge(frame.actionId)){pending=false;if(V)draw();}if(pvpPending.acknowledge(frame.actionId,frame.actionType)){pending=false;if(V)draw();}},onStatus:value=>{connected=value;joinedReady=false;if(value){if(V)draw();return;}pending=false;if(playback)finishPlayback();else if(V)draw();else $("#connection").textContent="Connection interrupted. Reconnecting…";}});
const completedBattleResults=new CompletedBattleResults({sendAction:action=>action.type?.startsWith('rankedV1.')||action.type?.startsWith('trainingPvpV1.')?pvpRetry.send(action):connection.sendAction(action),createActionId:kind=>`${kind}:${crypto.randomUUID()}`});
function receiveView(next){
 joinedReady=true;const previous=latestView;latestView=next;pending=false;completedBattleResults.accept(next,{reentry:!previous});
 prepareRoute(router.current,next);
 if(playback){
  // Presence broadcasts for the same saved turn must not restart its animation.
  if(previous?.battle?.id===next.battle?.id&&previous?.battle?.round===next.battle?.round)return;
  finishPlayback();return;
 }
 if(!previous&&next.rankedV1?.status==='finished'&&next.rankedV1?.recovered&&router.current!=='battle')router.go('battle');if(previous?.rankedV1?.status==='queued'&&next.rankedV1?.status==='preview'&&router.current!=='battle')router.go('battle');
 if(previous?.trainingPvpV1?.status==='waiting'&&next.trainingPvpV1?.status==='preview'&&router.current!=='battle')router.go('battle');
 if(previous&&rankedBattleScreen&&router.current==='battle'&&previous.rankedV1?.battleV3?.id===next.rankedV1?.battleV3?.id&&rankedBattleScreen.hasFreshPlayback(next.rankedV1?.battleV3)){
  V=next;announceNotice(!!previous);closeModal();void rankedBattleScreen.playTurn(next.rankedV1.battleV3,{reduced:!!settings.reduce||matchMedia('(prefers-reduced-motion: reduce)').matches,speed:settings.battleSpeed===2?2:1,catalog:v3TrainingEditor.catalog});return;
 }
 if(previous&&trainingPvpBattleScreen&&router.current==='battle'&&previous.trainingPvpV1?.battleV3?.id===next.trainingPvpV1?.battleV3?.id&&trainingPvpBattleScreen.hasFreshPlayback(next.trainingPvpV1?.battleV3)){
  V=next;announceNotice(!!previous);closeModal();void trainingPvpBattleScreen.playTurn(next.trainingPvpV1.battleV3,{reduced:!!settings.reduce||matchMedia('(prefers-reduced-motion: reduce)').matches,speed:settings.battleSpeed===2?2:1,catalog:v3TrainingEditor.catalog});return;
 }
 if(previous&&v3BattleScreen&&router.current==='battle'&&previous.battleV3?.id===next.battleV3?.id&&v3BattleScreen.hasFreshPlayback(next.battleV3)){
  V=next;announceNotice(!!previous);closeModal();void v3BattleScreen.playTurn(next.battleV3,{reduced:!!settings.reduce||matchMedia('(prefers-reduced-motion: reduce)').matches,speed:settings.battleSpeed===2?2:1,catalog:v3TrainingEditor.catalog});return;
 }
 if(previous&&router.current==="battle"&&previous.battle&&!previous.battle.result&&next.battle?.id===previous.battle.id&&next.battle.round===previous.battle.round+1&&next.battle.eventsRound===previous.battle.round&&next.battle.events?.length){
  void playTurn(previous,next);return;
 }
 if(previous?.battle?.round!==next.battle?.round)commands={};
 // Any authoritative V3 state accepted without animation becomes the playback baseline.
 // This prevents a later presence/timing push from replaying the last resolved turn after reload, reconnect, or while the user was on another screen.
 rankedBattleScreen?.acknowledgePlayback(next.rankedV1?.battleV3);trainingPvpBattleScreen?.acknowledgePlayback(next.trainingPvpV1?.battleV3);v3BattleScreen?.acknowledgePlayback(next.battleV3);
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
function send(a){
 if(pending||playback)return false;
 if(!connection.sendAction(a)){notify("Reconnecting. Please try again shortly.");return false;}
 pending=true;draw();return true;
}
const socialRetry=createSocialRetryController({outbox:socialPending,sendAction:send,isBusy:()=>pending||!!playback,isConnected:()=>connected,notify,onChange:()=>{if(V&&router.current==='friends')draw();}});
const commerceRetry=createCommerceRetryController({outbox:commercePending,sendAction:send,isBusy:()=>pending||!!playback,isReady:()=>connected&&joinedReady,notify,onChange:()=>{if(V)draw();}});
const pvpRetry=createPvpRetryController({outbox:pvpPending,sendAction:send,isBusy:()=>pending||!!playback,isReady:()=>connected&&joinedReady,notify,onChange:()=>{if(V)draw();}});
function commerceBanner(){const commerce=commercePending.pending,pvp=pvpPending.pending;let html="";if(commerce){const label=commerceActionLabel(commerce),issue=commercePending.lastError;html+=`<section class="commerce-pending-notice" role="status"><b>${esc(label)} · Not yet confirmed</b><p>${issue?`Server response: ${esc(issue)}. `:''}The server may already have saved this action. Retry uses the <strong>same request ID</strong> and will not execute it twice.</p><div><button type="button" data-action="commerce-retry" ${commerceRetry.canRetry()?'':'disabled'}>Retry same action</button><button type="button" data-action="commerce-discard">Discard local retry</button></div></section>`;}if(pvp){const label=pvpActionLabel(pvp),issue=pvpPending.lastError;html+=`<section class="commerce-pending-notice" role="status"><b>${esc(label)} · Match server confirmation pending</b><p>${issue?`Server response: ${esc(issue)}. `:''}A state or presence update does not confirm this command. Retry sends the <strong>same request ID</strong>; it is never replayed automatically. Active PvP remains session-scoped.</p><div><button type="button" data-action="pvp-retry" ${pvpRetry.canRetry()?'':'disabled'}>Retry same command</button><button type="button" data-action="pvp-discard">Discard local retry</button></div></section>`;}return html;}
function connectionLabel(){return !connected?'RECONNECTING':!joinedReady?'SYNCING':commercePending.pending?'ACTION UNCONFIRMED':pvpPending.pending?'MATCH ACTION UNCONFIRMED':socialPending.pending?'SOCIAL ACTION UNCONFIRMED':pending?'ACTION IN PROGRESS':'ONLINE';}
const economyActionId=kind=>`${kind}:${crypto.randomUUID()}`;
const rankedActionType=type=>({'battleV3.preview.lock':'rankedV1.preview.lock','battleV3.commands':'rankedV1.commands','battleV3.replacements':'rankedV1.replacements','battleV3.surrender':'rankedV1.surrender'}[type]||type);
const trainingPvpActionType=type=>({'battleV3.preview.lock':'trainingPvpV1.preview.lock','battleV3.commands':'trainingPvpV1.commands','battleV3.replacements':'trainingPvpV1.replacements','battleV3.surrender':'trainingPvpV1.surrender'}[type]||type);
const rankedState=state=>({...state,battleV3:state?.rankedV1?.battleV3||null});
const trainingPvpState=state=>({...state,battleV3:state?.trainingPvpV1?.battleV3||null});
const rankedActive=state=>completedBattleResults.isRankedActive(state);
const trainingPvpActive=state=>completedBattleResults.isTrainingPvpActive(state);
const redrawWorkspace=()=>{if(V&&['home','training','collection','teams','recruitment','shop','bag','missions','gym','guide'].includes(router.current))draw();};
const catalogs=createCatalogLoader((...args)=>fetch(...args));
const styles=createStyleLoader(document);
const routeModules=new RouteModuleRegistry({
 'legacy-core':async()=>{const [modules]=await Promise.all([Promise.all([import('./js/training-editor.js'),import('./js/box-view.js'),import('./js/team-builder.js'),import('./js/v2-battle-screen.js'),import('./js/v2-tutorial.js'),import('./js/recruitment-view.js')]),styles.loadMany(['/training-editor.css','/box-view.css','/team-builder.css','/recruitment.css','/v2-battle.css','/v2-tutorial.css'])]);const [training,box,team,battle,tutorial,recruitment]=modules;return {...training,...box,...team,...battle,...tutorial,...recruitment};},
 'damage-inspector':async()=>{const [module]=await Promise.all([import('./js/damage-inspector.js'),styles.load('/damage-inspector.css')]);return module;},
 'v3-battle':async()=>{const [module]=await Promise.all([import('./js/v3-battle-screen.js'),styles.loadMany(['/v3-battle-arena.css','/v3-move-fx.css','/v3-playback.css','/v3-field-effects.css','/pokemon-battle-shell.css','/battle-presentation-polish.css'])]);return module;}
});
let trainingEditor=null,boxView=null,teamBuilder=null,v2BattleScreen=null,damageInspector=null,recruitmentView=null,renderV2Tutorial=null;
let v3BattleScreen=null,rankedBattleScreen=null,trainingPvpBattleScreen=null,v3CatalogPromise=null,legacyCorePromise=null,damageInspectorPromise=null,v3BattlePromise=null;
const v3TrainingEditor=new V3TrainingEditor({fetchImpl:url=>fetch(url),loadCatalog:()=>catalogs.load('v3','/api/v3/catalog',{retry:catalogs.status('v3').state==='error'}),onChange:redrawWorkspace,sendAction:send,createActionId:kind=>economyActionId(kind)});
const v3TeamBuilder=new V3TeamBuilder({onChange:redrawWorkspace,sendAction:send,createActionId:kind=>economyActionId(kind)});
const v3RecruitmentView=new V3RecruitmentView({sendAction:action=>action.type==='recruitV3.sync'?send(action):commerceRetry.send(action),createActionId:kind=>economyActionId(kind.replaceAll('.','-')),onChange:redrawWorkspace});
const v3OverviewView=new V3OverviewView({onChange:redrawWorkspace});
const missionView=new MissionView({sendAction:commerceRetry.send,onChange:redrawWorkspace,createActionId:kind=>economyActionId(kind)});
const replicaTeamsView=new ReplicaTeamsView({sendAction:send,onChange:redrawWorkspace,onNotify:notify,createActionId:kind=>economyActionId(kind)});
const bagView=new BagView({sendAction:commerceRetry.send,onChange:redrawWorkspace,createActionId:kind=>economyActionId(kind)});const shopView=new ShopView({sendAction:commerceRetry.send,onChange:redrawWorkspace,createActionId:kind=>economyActionId(kind)});
const profileView=new ProfileView();
const arenaView=new ArenaView({send,actionId:economyActionId,notify});
const socialView=new SocialView({send:socialRetry.send,actionId:economyActionId,notify,pendingAction:()=>socialPending.pending,pendingError:()=>socialPending.lastError,retryPending:socialRetry.retry,discardPending:()=>socialPending.discard(),canRetry:socialRetry.canRetry,openFriendly:()=>{arenaView.section='pvp';if(router.go('battle')){closeModal();draw();window.scrollTo(0,0);}}});
function redrawAfter(promise){promise.then(()=>{if(V)draw();},()=>{if(V)draw();});return promise;}
function ensureV3Catalog({retry=false}={}){if(retry)v3CatalogPromise=null;if(!v3CatalogPromise)v3CatalogPromise=redrawAfter(v3TrainingEditor.load());return v3CatalogPromise;}
function ensureV3Battle({retry=false}={}){
 if(retry)v3BattlePromise=null;if(v3BattlePromise)return v3BattlePromise;v3BattlePromise=redrawAfter(routeModules.load('v3-battle',{retry}).then(({V3BattleScreen})=>{const common={onChange:()=>{if(V&&router.current==='battle')draw();},playbackSpeed:settings.battleSpeed===2?2:1,onPlaybackSpeedChange:speed=>{settings.battleSpeed=speed;browserStore.saveSettings();},onPresentationCue:cue=>document.dispatchEvent(new CustomEvent(BATTLE_PRESENTATION_EVENT,{detail:cue})),onAudioCue:cue=>document.dispatchEvent(new CustomEvent(BATTLE_AUDIO_EVENT,{detail:cue}))};v3BattleScreen||=new V3BattleScreen({...common,sendAction:action=>commerceRetry.send({...action,actionId:economyActionId('pve')})});rankedBattleScreen||=new V3BattleScreen({...common,sendAction:action=>pvpRetry.send({...action,type:rankedActionType(action.type),actionId:economyActionId('ranked')})});trainingPvpBattleScreen||=new V3BattleScreen({...common,sendAction:action=>pvpRetry.send({...action,type:trainingPvpActionType(action.type),actionId:economyActionId('training-pvp')})});}));return v3BattlePromise;
}
function ensureLegacyCore({retry=false}={}){
 if(retry)legacyCorePromise=null;if(legacyCorePromise)return legacyCorePromise;legacyCorePromise=redrawAfter(routeModules.load('legacy-core',{retry}).then(async modules=>{trainingEditor||=new modules.TrainingEditor({fetchImpl:url=>fetch(url),loadCatalog:()=>catalogs.load('v2','/api/v2/catalog',{retry:catalogs.status('v2').state==='error'}),onChange:redrawWorkspace,sendAction:commerceRetry.send,createActionId:kind=>economyActionId(kind)});boxView||=new modules.BoxView({onChange:redrawWorkspace});teamBuilder||=new modules.TeamBuilder({onChange:redrawWorkspace,sendAction:commerceRetry.send,createActionId:kind=>economyActionId(kind)});v2BattleScreen||=new modules.V2BattleScreen({onChange:()=>{if(V&&router.current==='battle')draw();},sendAction:commerceRetry.send,createActionId:kind=>economyActionId(`v2-${kind}`)});recruitmentView||=new modules.RecruitmentView({onChange:redrawWorkspace,sendAction:send,createActionId:kind=>economyActionId(kind)});renderV2Tutorial||=modules.renderV2Tutorial;await trainingEditor.load();}));return legacyCorePromise;
}
function ensureDamageInspector({retry=false}={}){if(retry)damageInspectorPromise=null;if(damageInspectorPromise)return damageInspectorPromise;damageInspectorPromise=redrawAfter(ensureLegacyCore({retry}).then(()=>routeModules.load('damage-inspector',{retry})).then(({DamageInspector})=>{damageInspector||=new DamageInspector({fetchImpl:(...args)=>fetch(...args),getDraft:()=>trainingEditor.draft});}));return damageInspectorPromise;}
const featurePages=new Set(['home','collection','teams','recruitment','training','gym','battle']);
function prepareRoute(page,state=V,{retry=false}={}){
 if(!state||!featurePages.has(page))return;if(state.trainingV3){const catalog=ensureV3Catalog({retry});if(page==='battle')void ensureV3Battle({retry});else void catalog.then(()=>queueMicrotask(()=>{void ensureV3Battle();})).catch(()=>{});return;}void ensureLegacyCore({retry});if(page==='training')void ensureDamageInspector({retry});
}
function routeFeatureState(page){
 if(!featurePages.has(page))return {ready:true};if(V.trainingV3){if(!v3TrainingEditor.catalog){const status=catalogs.status('v3');return {ready:false,error:status.error,label:'Regulation M-A catalog'};}if(page==='battle'&&!v3BattleScreen){const status=routeModules.status('v3-battle');return {ready:false,error:status.error,label:'battle screen'};}return {ready:true};}if(!trainingEditor?.catalog){const moduleStatus=routeModules.status('legacy-core'),catalogStatus=catalogs.status('v2');return {ready:false,error:moduleStatus.error||catalogStatus.error,label:'legacy compatibility modules'};}if(page==='training'&&!damageInspector){const status=routeModules.status('damage-inspector');return {ready:false,error:status.error,label:'damage inspector'};}return {ready:true};
}
function featurePlaceholder(state){const failed=!!state.error;return `<section class="panel feature-loading" role="${failed?'alert':'status'}"><small>${failed?'ROUTE LOAD FAILED':'PREPARING ROUTE'}</small><h2>${failed?'This screen could not be loaded yet':'Loading '+esc(state.label)+'…'}</h2><p>${failed?esc(state.error?.message||'A network or module error interrupted this screen. The rest of the app remains available.'):'The live connection remains active while this optional feature becomes ready.'}</p>${failed?'<button class="primary" data-action="feature-retry">Retry this screen</button>':''}</section>`;}
const activeBattleScreen=()=>rankedActive(V)?rankedBattleScreen:trainingPvpActive(V)?trainingPvpBattleScreen:v3BattleScreen;
const activeBattleState=()=>rankedActive(V)?rankedState(V):trainingPvpActive(V)?trainingPvpState(V):V;
const gameUi=new GameUiController({root:()=>document.querySelector('[data-game-ui-scope="battle"]'),onCancel:()=>V&&activeBattleScreen()?activeBattleScreen().handleCancel(activeBattleState()):false,onAction:action=>V&&activeBattleScreen()?activeBattleScreen().handleUiAction(action,activeBattleState()):false});
const managementUi=new GameUiController({root:()=>document.querySelector('[data-game-ui-scope="management"]'),initialMode:'TRAINING_PROFILE',onCancel:()=>{if(!V)return false;if(router.current==='training')return v3TrainingEditor.handleCancel();if(router.current==='teams')return v3TeamBuilder.handleCancel();if(router.current==='collection')return v3OverviewView.handleArchiveCancel();if(router.current==='recruitment')return v3RecruitmentView.handleCancel();return false;},onAction:action=>{if(!V)return false;if(router.current==='training')return v3TrainingEditor.handleUiAction(action);if(router.current==='teams')return v3TeamBuilder.handleUiAction(action);if(router.current==='collection')return v3OverviewView.handleArchiveUiAction(action,V,v3TrainingEditor.catalog);if(router.current==='recruitment')return v3RecruitmentView.handleUiAction(action,V);return false;}});
function start(mode,gym){commands={};router.go("battle");prepareRoute('battle');if(V.trainingV3&&gym===undefined){commerceRetry.send({type:'battleV3.preview.start',mode,difficulty:v3BattleScreen?.difficulty||'normal',actionId:economyActionId('pve')});return;}const team=V.trainingV2.teams.find(entry=>entry.teamId===V.trainingV2.activeTeamId),regulationId=team?.buildIds.length===6?`alpha-${mode}`:'sandbox-v2';commerceRetry.send({type:"battleV2.preview.start",mode,regulationId,...(gym===undefined?{}:{gym}),difficulty:gym===undefined?v2BattleScreen.difficulty:'hard',actionId:economyActionId('v2-preview')});}
function types(d){return '<div class="types">'+d.types.map(t=>'<span class="type" style="--c:'+V.colors[V.types.indexOf(t)]+'">'+t+'</span>').join("")+'</div>';}
function head(title,sub,kicker="YOUR ADVENTURE"){return '<div class="heading"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p>'+sub+'</p></div><span class="pill">✦ &nbsp; VANGUARD LEAGUE · PUBLIC BETA</span></div>';}
function home(){
 if(V.trainingV3)return head("Welcome back, Challenger.","The Regulation M-A core battle beta is ready for public testing.")+v3OverviewView.renderHome(V,v3TrainingEditor.catalog,{art:pokemonArtwork});
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
function shop(){return head("Shop","Unlock battle items using VP or a Shop Ticket.","VANGUARD SUPPLY · ACCOUNT INVENTORY")+shopView.render(V);}
function friendsPage(){return head("Friends & Chat","Your Trainer Network, friend requests and direct messages are available across Pokémon Vanguard.","VANGUARD NETWORK · SOCIAL")+socialView.render(V);}
function profilePage(){return head("Trainer Profile","Your account identity, battle record, collection progress and active team in one place.","VANGUARD ACCOUNT · TRAINER CARD")+profileView.render(V,auth,{connected});}
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
function mail(){return renderMailbox({V,mailOpenKey,pending,head,esc,btn});}
function settingsPage(){return renderSettingsPage({settings,auth,connected,persistent:browserStore.persistent,esc,head,btn});}
function live(side){return V.battle[side].map((m,i)=>({m,i})).filter(x=>x.m.hp>0&&x.m.slot>=0).sort((a,b)=>a.m.slot-b.m.slot);}
function animationBar(){return '<div class="battle-announcer" role="status" aria-live="polite"><div><strong>'+(playback?esc(playback.currentCaption?.title||'Battle in motion…'):'Choose your moves')+'</strong><span>'+(playback?esc(playback.currentCaption?.subtitle||'Playing actions in speed order'):'Elemental attacks · Hold items · Team synergy')+'</span></div><div class="playback-controls"><label>Speed <select data-battle-speed aria-label="Battle animation speed" '+(playback?'disabled':'')+'><option value="1" '+(settings.battleSpeed!==2?'selected':'')+'>1×</option><option value="2" '+(settings.battleSpeed===2?'selected':'')+'>2×</option></select></label>'+(playback?btn('Skip ⏭','skip-animation','small ghost'):'')+'</div></div>';}
function ensureCommands(){for(const {i} of live("allies"))if(!commands[i])commands[i]={kind:"move",actor:i,move:0,target:live("enemies")[0]?.i};}
function fighter(m,side,i){return '<div class="fighter" data-fighter="'+side+'-'+i+'">'+art(m.id)+'<div class="hpbox"><strong>'+V.catalog[m.id].name+'<span>Lv.'+m.level+'</span></strong><div class="progress"><i class="'+(m.hp<m.max*.3?"low":"")+'" style="width:'+m.hp/m.max*100+'%"></i></div><small>'+m.hp+'/'+m.max+' HP · '+m.energy+' EN'+(m.status?" · "+m.status.toUpperCase():"")+'</small></div></div>';}
function rankedFinished(){const ranked=V.rankedV1||{},result=ranked.result||{},profile=ranked.profile||{},outcome=result.outcome==='win'?'Victory':result.outcome==='loss'?'Defeat':'Draw',delta=Number(result.ratingDelta)||0;return `<div class="pokemon-game-surface pokemon-battle-shell" data-game-ui-scope="battle" data-ui-mode="BATTLE_RESULT"><header class="pokemon-game-header"><div><img class="pokemon-game-logo" src="/logo.png" alt="" aria-hidden="true"><span><small>POKÉMON VANGUARD</small><b>Ranked Arena</b></span></div><div class="pokemon-game-header-actions ranked-header-tier">${rankedTierEmblem(profile,{className:'ranked-tier-icon ranked-tier-icon-xs',decorative:true})}<span>${rankedTierLine(profile)}</span></div></header><div class="pokemon-game-body ranked-queue-surface"><section class="ranked-queue-card ranked-finished-card aether-window">${rankedTierEmblem(profile)}<small>RANKED MATCH COMPLETE</small><h2>${outcome}</h2><p>${esc(result.reason||'completed')}</p><div class="ranked-rating-result">Rating ${delta>=0?'+':''}${delta} → ${result.ratingAfter??profile.rating??1000}</div>${result.rankTicketProtected?'<p class="bag-ready">Rank Ticket used: your RP was protected.</p>':''}<small class="ranked-next-tier">${rankedTierNext(profile)}</small><button class="primary" data-v3-battle="new">Return to Ranked</button></section></div></div>`;}
function rankedQueue(){const ranked=V.rankedV1,queue=ranked.queue||{},profile=ranked.profile||{};return `<div class="pokemon-game-surface pokemon-battle-shell" data-game-ui-scope="battle" data-ui-mode="BATTLE_MESSAGE"><header class="pokemon-game-header"><div><img class="pokemon-game-logo" src="/logo.png" alt="" aria-hidden="true"><span><small>POKÉMON VANGUARD</small><b>Ranked Arena</b></span></div><div class="pokemon-game-header-actions ranked-header-tier">${rankedTierEmblem(profile,{className:'ranked-tier-icon ranked-tier-icon-xs',decorative:true})}<span>${rankedTierLine(profile)}</span><button class="small ghost" data-action="nav:home">Exit Arena</button></div></header><div class="pokemon-game-body ranked-queue-surface"><section class="ranked-queue-card aether-window">${rankedTierEmblem(profile)}<div class="ranked-queue-spinner"></div><small>SEARCHING · REGULATION M-A</small><h2>Finding a ${queue.mode==='double'?'Double':'Single'} Ranked opponent…</h2><p>Your active Battle Team is locked while matchmaking is active.</p><div class="ranked-queue-meta"><span>${profile.rating||1000} RP</span><span>${esc(profile.tier||'Poké Ball')}</span><span>Queue #${queue.position||1}</span><span>Window ±${queue.ratingWindow||250}</span></div><small class="ranked-next-tier">${rankedTierNext(profile)}</small><button class="ghost" data-ranked="leave">Cancel Search</button></section></div></div>`;}
function battle(){
 if(V.battle?.result)return head("Legacy battle complete","Your v1 result was saved safely before the adventure upgrade.")+`<section class="panel v2-result"><small>LEGACY V1 · MATCH COMPLETE</small><h2>${esc(V.battle.result)}</h2><p>+${V.battle.reward?.coins||0} coins · +${V.battle.reward?.gems||0} crystals</p>${btn("Continue to Vanguard battles","legacy-finish","primary")}</section>`;
 if(V.trainingV3){const catalog=v3TrainingEditor.catalog;if(V.rankedV1?.status==='queued')return rankedQueue();if(rankedActive(V)&&V.rankedV1?.status==='finished'&&!V.rankedV1?.battleV3)return rankedFinished();if(rankedActive(V))return rankedBattleScreen.render(rankedState(V),catalog,{art:pokemonArtwork,battleArt:pokemonBattleArt});if(trainingPvpActive(V))return trainingPvpBattleScreen.render(trainingPvpState(V),catalog,{art:pokemonArtwork,battleArt:pokemonBattleArt});if(V.trainingPvpV1?.status==='waiting'){arenaView.section='pvp';return arenaView.render(V,catalog);}if(completedBattleResults.isPveVisible(V)&&v3BattleScreen.dismissedId!==V.battleV3.id)return v3BattleScreen.render(V,catalog,{art:pokemonArtwork,battleArt:pokemonBattleArt});return arenaView.render(V,catalog);}
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
 const page=router.current,pageLabel=routeLabel(page);document.body.dataset.appScreen=page;
 prepareRoute(page);const continuity=captureRenderContinuity(page,renderedPage),t=performance.now();if(page!=='recruitment'){recruitmentView?.stopTicker();v3RecruitmentView.stopTicker();}const readiness=routeFeatureState(page),content=renderRoutePage(page,{home,collection:()=>archive(false),teams:teamsPage,recruitment,shop,bag:()=>bagView.render(V),missions,training:trainingPage,gym,mail,friends:friendsPage,profile:profilePage,settings:settingsPage,battle},readiness.ready,()=>featurePlaceholder(readiness)),footerSummary=V.trainingV3?`${V.trainingV3.mons.length} / ${v3TrainingEditor.catalog?.species.length||V.trainingV3.mons.length} BETA POKÉMON · SCHEMA 3`:V.collection.length+' / '+V.catalog.length+' DISCOVERED &nbsp; · &nbsp; '+V.badges.length+' / 6 BADGES',immersiveBattle=page==='battle'&&!!V.trainingV3;
 $("#app").innerHTML=renderClientShell({page,pageLabel,V,navs,esc,auth,content,footerSummary,immersiveBattle,commerceBanner,connectionLabel,unreadMailCount,accountControl,storagePersistent:browserStore.persistent});
 renderedPage=page;const focusRestored=restoreRenderContinuity(continuity);
 if(immersiveBattle&&readiness.ready){const battleMode=rankedActive(V)&&V.rankedV1?.status==='finished'&&!V.rankedV1?.battleV3?'BATTLE_RESULT':rankedActive(V)?rankedBattleScreen.uiMode(rankedState(V)):trainingPvpActive(V)?trainingPvpBattleScreen.uiMode(trainingPvpState(V)):completedBattleResults.isPveVisible(V)&&v3BattleScreen.dismissedId!==V.battleV3.id?v3BattleScreen.uiMode(V):'BATTLE_LANDING';gameUi.setMode(battleMode);if(!focusRestored)gameUi.ensureFocus();}
 if(V.trainingV3&&page==='training'&&trainingHubMode==='pokemon'){managementUi.setMode(v3TrainingEditor.uiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(V.trainingV3&&page==='teams'){managementUi.setMode(v3TeamBuilder.uiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(V.trainingV3&&page==='collection'){managementUi.setMode(v3OverviewView.archiveUiMode());if(!focusRestored)managementUi.ensureFocus();}
 if(V.trainingV3&&page==='recruitment'){managementUi.setMode(v3RecruitmentView.uiMode());if(!focusRestored)managementUi.ensureFocus();}
 battleLogDrag.apply(document);accessibility.afterRender(page);
 if(playback){
  document.querySelectorAll('.commands button,.commands select,.turnfooter button').forEach(el=>{el.disabled=true;});
  const resolve=document.querySelector('[data-action="resolve"]');if(resolve)resolve.textContent='Playing turn…';
 }
 if(new URLSearchParams(location.search).has("debug"))$("#app").insertAdjacentHTML("beforeend",'<div class="debug">Render '+(performance.now()-t).toFixed(1)+' ms · '+document.querySelectorAll("svg").length+' visible creatures</div>');
}
function focusModal(){modalFocus.open();}
function closeModal(){modalId=null;confirmAction=null;$("#modal").innerHTML="";modalFocus.close();}
function openConfirm({title,message,confirmLabel="Confirm",cancelLabel="Cancel",danger=true,onConfirm}){
 confirmAction=onConfirm;modalId="confirm";$("#modal").innerHTML=renderConfirmDialog({title,message,confirmLabel,cancelLabel,danger,esc});focusModal();
}
function requestBattleSurrender(){
 if(rankedActive(V)){openConfirm({title:'Surrender Ranked Match?',message:'This immediately ends the match as a loss and applies the normal Ranked rating change.',confirmLabel:'Surrender Match',onConfirm:()=>pvpRetry.send({type:'rankedV1.surrender',actionId:economyActionId('ranked-surrender')})});return;}
 if(trainingPvpActive(V)){openConfirm({title:'Leave Friendly Battle?',message:'The friendly match will end immediately. Ranked rating and progression rewards are not affected.',confirmLabel:'Leave Match',onConfirm:()=>pvpRetry.send({type:'trainingPvpV1.surrender',actionId:economyActionId('training-pvp-surrender')})});return;}
 if(V?.battleV3){openConfirm({title:'Surrender Battle?',message:'The current Battle Practice match will end immediately and no training rewards will be granted.',confirmLabel:'Surrender Battle',onConfirm:()=>send({type:'battleV3.surrender'})});}
}
function detail(id){
 modalId=id;$("#modal").innerHTML=renderLegacyDetailDialog({id,V,btn,art,types,pending});focusModal();
}
function chart(){
 modalId=null;$("#modal").innerHTML=renderLegacyTypeChart({V,btn});focusModal();
}
document.addEventListener("click",async e=>{
 if(e.target.classList?.contains('modalback')){closeModal();return;}
 if(userMenuOpen&&!e.target.closest('.user-menu'))setUserMenu(false);
 const el=e.target.closest("[data-action],[data-shop],[data-mission],[data-replica],[data-training],[data-box],[data-team],[data-recruit],[data-v3-recruit],[data-v3-archive],[data-v2battle],[data-v3-battle],[data-damage],[data-v3-training],[data-v3-team],[data-ranked],[data-arena],[data-social],[data-bag]");if(!el||el.disabled)return;const featureSend=action=>action.type==='rankedV1.surrender'?pvpRetry.send(action):send(action);if(await routeFeatureClick(el,{requestBattleSurrender,socialView,V,draw,arenaView,send:featureSend,economyActionId,openConfirm,bagView,shopView,missionView,replicaTeamsView,v3TrainingEditor,rankedActive,completedBattleResults,rankedBattleScreen,trainingPvpActive,trainingPvpBattleScreen,trainingPvpState,rankedState,v3BattleScreen,v3TeamBuilder,updateV3RecruitmentSelection,v3RecruitmentView,updateV3ArchiveSelection,v3OverviewView,damageInspector,trainingEditor,boxView,router,teamBuilder,recruitmentView,v2BattleScreen}))return;const [a,b,c]=el.dataset.action.split(":");
 if(a==="commerce-retry"){commerceRetry.retry();return;}
 if(a==="pvp-retry"){pvpRetry.retry();return;}
 if(a==="feature-retry"){prepareRoute(router.current,V,{retry:true});draw();return;}
 if(a==="commerce-discard"){if(confirm("Discard the retry option? The server may already have committed this action; check your account or battle state after syncing.")){commercePending.discard();draw();}return;}
 if(a==="pvp-discard"){if(confirm("Discard this local retry option? Check the current match state first; the server may already have accepted the command.")){pvpPending.discard();draw();}return;}
 if(a==="confirm-action"){const action=confirmAction;confirmAction=null;closeModal();action?.();return;}
 if(a==="skip-animation"){finishPlayback();return;}
 if(a==="account-menu"){setUserMenu(!userMenuOpen,{focusMenu:!userMenuOpen});return;}
 if(a==="bag"||a==="profile"||a==="friends"||a==="settings"){setUserMenu(false);if(router.go(a)){closeModal();draw();window.scrollTo(0,0);}return;}
 if(a==="admin-console"&&auth?.admin){location.assign("/admin.html");return;}
 if(a==="logout"){if((socialPending.pending||commercePending.pending||pvpPending.pending)&&!confirm("An action is unconfirmed. Logging out will discard its local retry option, but the server may already have accepted it. Continue?"))return;socialPending.discard();commercePending.discard();pvpPending.discard();setUserMenu(false);connection.stop();await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});location.assign('/');return;}
 if(playback){if(a!=="nav")return;finishPlayback();}
 if(a==="nav"){if(router.current==='battle'&&b!=='battle')completedBattleResults.dismissFinished(V);if(router.current==='teams'&&b!=='teams')v3TeamBuilder.flushSave();if(router.go(b)){if(b==='training')trainingHubMode=null;if(b==='battle')arenaView.reset();v3BattleScreen?.cancelPlayback();rankedBattleScreen?.cancelPlayback();trainingPvpBattleScreen?.cancelPlayback();closeModal();prepareRoute(b);draw();window.scrollTo(0,0);}}
 if(a==="training-mode"){trainingHubMode=b;draw();window.scrollTo(0,0);}
 if(a==="training-home"){trainingHubMode=null;draw();window.scrollTo(0,0);}
 if(a==="training"&&V.trainingV3){trainingHubMode='pokemon';router.go('training');v3BattleScreen?.cancelPlayback();rankedBattleScreen?.cancelPlayback();closeModal();v3TrainingEditor.openSelection();v3TrainingEditor.select(V.trainingV3,b);window.scrollTo(0,0);}
 if(a==="start")start(b);
 if(a==="detail")detail(+b);
 if(a==="close")closeModal();
 if(a==="chart")chart();
 if(a==="gym")start($("#gymmode").value,+b);
 if(a==="mail-open"){mailOpenKey=`${b}:${c}`;const unread=b==="admin"?(V.adminGiftsV1?.gifts||[]).find(entry=>entry.giftId===c)?.unread:(V.mailboxV1?.system||[]).find(entry=>String(entry.mailId)===String(c))?.unread;if(unread)send({type:"mailboxV1.read",kind:b,...(b==="admin"?{giftId:c}:{mailId:+c})});else draw();return;}
 if(a==="claim")send({type:"mail.claim",mailId:+b,actionId:economyActionId("mail")});
 if(a==="admin-gift")commerceRetry.send({type:"adminGift.claim",giftId:b,actionId:economyActionId("admin-gift")});
 if(a==="train")send({type:"train",id:+b});
 if(a==="team")send({type:"team",ids:V.team.includes(+b)?V.team.filter(i=>i!==+b):[...V.team,+b]});
 if(a==="lead")send({type:"team",ids:[+b,...V.team.filter(i=>i!==+b)]});
 if(a==="move"){commands[+b]={...commands[+b],kind:"move",move:+c};draw();}
 if(a==="resolve")send({type:"turn",round:V.battle.round,commands:live("allies").map(x=>commands[x.i])});
 if(a==="surrender"){openConfirm({title:"Surrender Battle?",message:"This battle will end immediately and no rewards will be granted.",confirmLabel:"Surrender Battle",onConfirm:()=>send({type:"surrender"})});}
 if(a==="legacy-finish")send({type:"legacy.finish"});
});
document.addEventListener('pointerdown',event=>{battleLogDrag.start(event,document);});
document.addEventListener('pointermove',event=>{battleLogDrag.move(event);});
document.addEventListener('pointerup',event=>{battleLogDrag.end(event);});
document.addEventListener('pointercancel',event=>{battleLogDrag.end(event);});
document.addEventListener('dblclick',event=>{if(event.target?.closest?.('.pokemon-battle-log .aether-window-title')){battleLogDrag.reset(document);event.preventDefault();}});
document.addEventListener("change",e=>{
 const t=e.target;
 if(rankedActive(V)){if(rankedBattleScreen?.handleInput(t))return;}else if(trainingPvpActive(V)){if(trainingPvpBattleScreen?.handleInput(t))return;}else if(v3BattleScreen?.handleInput(t))return;
 if(socialView.handleInput(t)||arenaView.handleInput(t))return;
 if(damageInspector?.handleInput(t,V,trainingEditor?.catalog))return;
 if(v2BattleScreen?.handleInput(t))return;
 if(v3TrainingEditor.handleInput(t)||v3TeamBuilder.handleInput(t)||updateV3ArchiveInput(t))return;
 if(boxView?.handleInput(t)||teamBuilder?.handleInput(t))return;
 if(trainingEditor?.handleInput(t))return;
 if(t.hasAttribute('data-battle-speed')){settings.battleSpeed=Number(t.value)===2?2:1;browserStore.saveSettings();return;}
 if(t.hasAttribute('data-audio-enabled')){audioManager.setEnabled(t.checked);return;}
 if(t.hasAttribute('data-audio-volume')){audioManager.setVolume(t.value);return;}
 if(playback)return;
 if(t.dataset.setting){settings[t.dataset.setting]=t.checked;browserStore.saveSettings();prefs();}
 if(t.id==="equip")send({type:"equip",id:+t.dataset.id,item:+t.value});
 if(t.dataset.target!==undefined)commands[+t.dataset.target].target=+t.value;
 if(t.dataset.switch!==undefined){let i=+t.dataset.switch;commands[i]=+t.value<0?{kind:"move",actor:i,move:0,target:live("enemies")[0].i}:{kind:"switch",actor:i,to:+t.value};draw();}
});
document.addEventListener("input",e=>{const t=e.target;if(t.hasAttribute('data-audio-volume')){audioManager.setVolume(t.value);return;}if(socialView.handleInput(t)||arenaView.handleInput(t)||shopView.handleInput(t)||replicaTeamsView.handleInput(t)||v3TrainingEditor.handleInput(t)||v3TeamBuilder.handleInput(t)||updateV3ArchiveInput(t)||boxView?.handleInput(t)||teamBuilder?.handleInput(t))return;trainingEditor?.handleInput(t);});
document.addEventListener("keydown",e=>{const modalOpen=$("#modal").children.length>0;if(e.code==="Escape"&&modalOpen){e.preventDefault();closeModal();return;}if(userMenuOpen&&accessibility.handleMenuKey(e,{onClose:()=>setUserMenu(false)}))return;if(!modalOpen&&router.current==="battle"&&V?.trainingV3&&gameUi.handleKeyboard(e))return;const managementPage=["teams","collection","recruitment"].includes(router.current)||router.current==='training'&&trainingHubMode==='pokemon';if(!modalOpen&&V?.trainingV3&&managementPage&&managementUi.handleKeyboard(e))return;if(modalOpen)modalFocus.handleTab(e);});
connection.start();
// Leaving/resizing the scene commits its already-saved outcome and cancels effects.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)return;completedBattleResults.dismissFinished(V);if(playback)finishPlayback();v3BattleScreen?.cancelPlayback();rankedBattleScreen?.cancelPlayback();trainingPvpBattleScreen?.cancelPlayback();draw();});
window.addEventListener('resize',()=>{if(playback)finishPlayback();if(v3BattleScreen?.playback||rankedBattleScreen?.playback||trainingPvpBattleScreen?.playback){v3BattleScreen?.cancelPlayback();rankedBattleScreen?.cancelPlayback();trainingPvpBattleScreen?.cancelPlayback();draw();}battleLogDrag.apply(document);});
