import {renderV3BattleLanding,renderV3BattlePreview} from './v3-battle-preview.js';
import {renderV3Replacements} from './v3-battle-commands.js';
import {battleLog,createTurnFrames} from './v3-battle-timeline.js';
import {renderV3BattleFx} from './v3-move-fx.js';
import {renderV3FieldEffects} from './v3-field-effects.js';
import {renderV3PlaybackControls} from './v3-playback-controls.js';
import {V3PlaybackRunner} from './v3-playback-runner.js';
import {renderAetherWindow,renderMessageBox,renderPokemonHud} from './ui/primitives/pokemon-ui.js';
import {BattleCommandUiHandler} from './ui/handlers/battle-command-ui-handler.js';
import {BattlePresentationRuntime} from './presentation/battle-presentation-runtime.js';
import {actorPresentationClass,cameraPresentationClass} from './presentation/presentation-renderer.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function fighter(mon,own,{art,battleArt=art,hit,cast,commandingId,presentation,actorId,targetIds=[]}){
 const disguise=mon.illusionState,displayMon=disguise?{...mon,speciesId:disguise.speciesId||mon.speciesId,name:disguise.name||mon.name,spriteKey:disguise.spriteKey||mon.spriteKey,types:disguise.types?.length?[...disguise.types]:mon.types}:mon,hp=own?mon.hp/mon.maxHp*100:mon.hpPercent,status=typeof mon.status==='object'?mon.status?.id:mon.status,targetIndex=targetIds.indexOf(mon.actorId),presentationClass=actorPresentationClass(presentation,{actorId:mon.actorId,role:mon.actorId===actorId?'user':targetIndex>=0?'target':undefined,targetIndex:targetIndex>=0?targetIndex:undefined}),semi=mon.battlePresentation?.semiInvulnerable||mon.volatiles?.['two-turn-move']?.semiInvulnerable||null;
 return `<article class="v2-fighter v3-fighter ${own?'player-fighter':'opponent-fighter'} slot-${mon.activeSlot} ${hit.has(mon.actorId)?'hit':''} ${cast.has(mon.actorId)?'cast':''} ${commandingId===mon.actorId?'is-commanding':''}${presentationClass}${semi?` is-semi-invulnerable semi-${esc(semi)}`:''}"${semi?` data-semi-invulnerable="${esc(semi)}"`:''}>${battleArt(displayMon.spriteKey||displayMon.speciesId,own?'back':'front')}${renderPokemonHud(displayMon,{own,hpPercent:hp,status,mega:mon.megaEvolved})}</article>`;
}

function resolutionPanel(playback){
 const title=playback.stage==='mega'?'Mega Evolution':playback.stage==='endTurn'?'Resolving end-of-turn effects':`Resolving action ${playback.action} / ${playback.total}`;
 const detail=playback.stage==='mega'?'The form, stats and Ability update before the move order continues.':playback.stage==='cast'?'Move animation is playing. Damage and effects apply on impact.':playback.stage==='impact'?'Impact resolved.':'Battle state updated.';
 return renderMessageBox({title,message:detail,className:'v3-resolving'});
}

function battleControls(screen,view,catalog){
 const snapshot=view.snapshot;if(screen.playback)return resolutionPanel(screen.playback);
 if(snapshot.phase==='COMMAND')return renderAetherWindow({variant:'command',className:'v3-battle-command-window pokemon-bottom-command-window',body:screen.commandUi.render(screen,view,catalog)});
 if(snapshot.phase==='REPLACE')return renderAetherWindow({variant:'command',className:'v3-battle-command-window',body:renderV3Replacements(screen,view)});
 if(snapshot.phase==='FINISHED')return renderAetherWindow({variant:'dialog',className:'v2-result',body:`<small>BATTLE COMPLETE</small><h2>${snapshot.result?.winner==='A'?'Victory':snapshot.result?.winner==='B'?'Defeat':'Draw'}</h2><p>${esc(snapshot.result?.reason)} · ${snapshot.turn} turns</p>${view.reward?`<p>+${view.reward.coins} coins · +${view.reward.crystals} crystals</p>`:''}<button class="primary" data-ui-focusable data-ui-focus-id="new-battle" data-ui-row="0" data-ui-col="0" data-v3-battle="new">New battle</button>`});
 return '<div class="panel">Resolving…</div>';
}

function arena(screen,view,catalog,helpers){
 const playback=screen.playback,snapshot=playback?.snapshot||view.snapshot,events=playback?.events||[],history=playback?[...playback.priorEvents,...playback.visibleEvents]:(view.history||view.events||[]);
 const hit=new Set(events.filter(event=>event.kind==='damage').map(event=>event.targetId)),cast=new Set(events.filter(event=>event.kind==='moveStarted').map(event=>event.actorId));
 const own=snapshot.own.filter(mon=>mon.activeSlot>=0).sort((a,b)=>a.activeSlot-b.activeSlot),foes=snapshot.opponent.filter(mon=>mon.activeSlot>=0).sort((a,b)=>a.activeSlot-b.activeSlot);
 const phase=playback?(playback.stage==='mega'?'MEGA':playback.stage==='endTurn'?'END TURN':`ACTION ${playback.action}/${playback.total}`):snapshot.phase,commandingId=!playback&&snapshot.phase==='COMMAND'?screen.commandUi.currentActorId(view):null,presentation=playback?.presentation||null,presentationClass=cameraPresentationClass(presentation),presentationTargets=playback?.targetIds||[];
 const log=battleLog(history,view.snapshot,catalog).slice(-80).map(entry=>`<p class="log-${entry.kind}"><small>T${entry.turn}</small>${esc(entry.text)}</p>`).join('');
 const logPanel=screen.commandUi.logOpen?renderAetherWindow({variant:'thin',className:'pokemon-battle-log',title:'Battle Log',body:log||'<p>The battle begins.</p>'}):'';
 return `<div class="v3-battle-ui-foundation pokemon-battle-ui"><div class="pokemon-battle-statusbar"><div><small>REGULATION M-A · ${esc(view.difficulty)} AI</small><strong>${view.mode==='double'?'Double':'Single'} Battle · Turn ${snapshot.turn}</strong></div><span class="phase-chip">${phase}</span>${renderV3PlaybackControls({speed:screen.playbackSpeed,playing:!!playback})}</div><div class="pokemon-battle-stage${presentationClass}"><div class="v2-arena v3-battle-arena format-${view.mode} playback-speed-${screen.playbackSpeed}">${renderV3FieldEffects(snapshot)}${renderV3BattleFx(playback,catalog)}<div class="v2-side enemy-side">${foes.map(mon=>fighter(mon,false,{...helpers,hit,cast,commandingId,presentation,actorId:playback?.actorId,targetIds:presentationTargets})).join('')}</div><div class="v2-side own-side">${own.map(mon=>fighter(mon,true,{...helpers,hit,cast,commandingId,presentation,actorId:playback?.actorId,targetIds:presentationTargets})).join('')}</div></div>${logPanel}</div><div class="pokemon-battle-dock">${battleControls(screen,view,catalog)}</div></div>`;
}

export class V3BattleScreen{
 constructor({onChange,sendAction,wait,playbackSpeed=1,onPlaybackSpeedChange=()=>{},onPresentationCue=()=>{},onAudioCue=()=>{}}){
  this.onChange=onChange;this.send=sendAction;this.selection=[];this.commands={};this.replacements={};this.difficulty='normal';this.playback=null;this.playbackToken=0;this.playedTurnKey=null;this.playbackSpeed=playbackSpeed===2?2:1;this.onPlaybackSpeedChange=onPlaybackSpeedChange;this.runner=new V3PlaybackRunner({waitImpl:wait});this.presentationRuntime=new BattlePresentationRuntime({onCue:onPresentationCue,onAudio:onAudioCue});this.commandUi=new BattleCommandUiHandler({onChange});
 }
 uiMode(state){const view=state?.battleV3;if(!view||this.dismissedId===view?.id)return 'BATTLE_LANDING';if(view.phase==='PREVIEW')return 'BATTLE_PREVIEW';if(this.playback)return 'BATTLE_ANIMATION';if(view.snapshot?.phase==='COMMAND')return this.commandUi.uiMode(view)||'BATTLE_COMMAND';if(view.snapshot?.phase==='REPLACE')return 'BATTLE_REPLACEMENT';if(view.snapshot?.phase==='FINISHED')return 'BATTLE_RESULT';return 'BATTLE_MESSAGE';}
 render(state,catalog,helpers){if(!catalog)return '<div class="empty">Loading beta catalog…</div>';const view=state.battleV3,body=!view||this.dismissedId===view?.id?renderV3BattleLanding(this,state):view.phase==='PREVIEW'?renderV3BattlePreview(this,view,catalog,helpers):arena(this,view,catalog,helpers);return `<div class="pokemon-game-surface pokemon-battle-shell" data-game-ui-scope="battle" data-ui-mode="${this.uiMode(state)}"><header class="pokemon-game-header"><div><img class="pokemon-game-logo" src="/logo.png" alt="" aria-hidden="true"><span><small>POKÉMON VANGUARD</small><b>Vanguard Arena</b></span></div><div class="pokemon-game-header-actions"><span>M-A · SCHEMA 3</span><button class="small ghost" data-action="nav:home">Exit Arena</button></div></header><div class="pokemon-game-body">${body}</div></div>`;}
 async playTurn(view,{reduced=false,speed=this.playbackSpeed,catalog}={}){
  const events=view.events||[],key=events.at(-1)?.id;if(!view.turnSnapshots?.initial||!events.some(event=>event.kind==='turnStarted')||!key||key===this.playedTurnKey)return false;
  this.playedTurnKey=key;this.commands={};this.playbackSpeed=speed===2?2:1;this.runner.configure({speed:this.playbackSpeed,reduced});
  const token=++this.playbackToken,currentIds=new Set(events.map(event=>event.id)),priorEvents=(view.history||[]).filter(event=>!currentIds.has(event.id)),frames=createTurnFrames(view.turnSnapshots.initial,events,{reduced,catalog});
  for(const frame of frames){if(token!==this.playbackToken)return true;const presentation=this.presentationRuntime.plan(frame,catalog);this.playback={...frame,priorEvents,speed:this.playbackSpeed,presentation};this.onChange();const completed=await this.runner.playTimeline(frame.duration,this.presentationRuntime.hookCues(presentation),cue=>this.presentationRuntime.dispatch(cue,{moveId:frame.moveId,stage:frame.stage,actorId:frame.actorId}));if(!completed)return true;}
  if(token===this.playbackToken){this.playback=null;this.onChange();}return true;
 }
 cancelPlayback(){this.playbackToken++;this.runner.cancel();this.playback=null;}
 skipPlayback(){if(!this.playback)return false;this.cancelPlayback();this.onChange();return true;}
 handleClick(el,state,catalog){
  const action=el.dataset.v3Battle;if(action==='skip')return this.skipPlayback();if(this.playback)return true;const view=state.battleV3;
  if(action?.startsWith('ui-')){const result=this.commandUi.handleClick(this,el,view,catalog);if(result.effect==='submit')this.submitCommands(view);if(result.effect==='surrender')this.send({type:'battleV3.surrender'});return true;}
  if(action==='start'){this.dismissedId=null;this.send({type:'battleV3.preview.start',mode:el.dataset.mode,difficulty:this.difficulty});}
  if(action==='pick'){const id=el.dataset.buildId,index=this.selection.indexOf(id);index>=0?this.selection.splice(index,1):this.selection.push(id);this.onChange();}
  if(action==='lock')this.send({type:'battleV3.preview.lock',buildIds:[...this.selection]});if(action==='move')this.selectMove(el,view,catalog);
  if(action==='submit')this.submitCommands(view);
  if(action==='replacement-choice'){const slot=Number(el.dataset.slot),actorId=el.dataset.reserveId;if(this.replacements[slot]===actorId)delete this.replacements[slot];else this.replacements[slot]=actorId;this.onChange();}
  if(action==='replace')this.send({type:'battleV3.replacements',phaseRevision:view.snapshot.phaseRevision,replacements:Object.entries(this.replacements).map(([slot,actorId])=>({slot:Number(slot),actorId})).filter(entry=>entry.actorId)});
  if(action==='surrender')this.send({type:'battleV3.surrender'});if(action==='new'){this.dismissedId=view.id;this.commandUi.reset();this.onChange();}return true;
 }
 submitCommands(view){const active=new Set(view.snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp>0).map(mon=>mon.actorId));this.send({type:'battleV3.commands',phaseRevision:view.snapshot.phaseRevision,commands:Object.values(this.commands).filter(command=>active.has(command.actorId))});}
 handleCancel(state){const view=state?.battleV3;if(this.playback)return false;return this.commandUi.cancel(this,view);}
 handleUiAction(action,state){if(action==='DETAIL'&&state?.battleV3?.snapshot?.phase==='COMMAND')return this.commandUi.toggleLog();return false;}
 selectMove(el,view,catalog){
  const actorId=el.dataset.actorId,mon=view.snapshot.own.find(entry=>entry.actorId===actorId);if(mon?.volatiles?.['must-recharge']||mon?.volatiles?.['two-turn-move'])return;const move=catalog.moves.find(entry=>entry.id===el.dataset.moveId),snapshot=view.snapshot,index=snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp>0).findIndex(mon=>mon.actorId===actorId),reserves=snapshot.own.filter(mon=>mon.activeSlot<0&&mon.hp>0),targetMode=move.actionProfile.dynamicTargetMode==='ghost-or-self'?(mon.types||[]).includes('ghost')?'anyAdjacent':'self':move.actionProfile.targetMode,automatic=['self','userSide','field','allAdjacentFoes','allAdjacent','foeSide'].includes(targetMode),mega=this.commands[actorId]?.mega===true;
  this.commands[actorId]={kind:'move',actorId,moveId:move.id,...(mega?{mega:true}:{}),...(automatic?{}:{target:{side:'B',slot:0}}),...(move.actionProfile.requiresPivotTarget&&reserves[index]?{switchToId:reserves[index].actorId}:{})};this.onChange();
 }
 handleInput(target){
  if(target.dataset.v3PlaybackSpeed!==undefined){this.playbackSpeed=Number(target.value)===2?2:1;this.onPlaybackSpeedChange(this.playbackSpeed);this.onChange();return true;}
  if(target.dataset.v3BattleField==='difficulty'){this.difficulty=target.value;return true;}if(target.dataset.v3Mega){const command=this.commands[target.dataset.v3Mega];if(command?.kind==='move')command.mega=target.checked;this.onChange();return true;}
  if(target.dataset.v3Target){const command=this.commands[target.dataset.v3Target];if(command?.kind==='move')command.target={side:'B',slot:Number(target.value)};return true;}
  if(target.dataset.v3Switch){const actorId=target.dataset.v3Switch;if(target.value)this.commands[actorId]={kind:'switch',actorId,toId:target.value};else delete this.commands[actorId];this.onChange();return true;}
  if(target.dataset.v3Replacement!==undefined){this.replacements[target.dataset.v3Replacement]=target.value;this.onChange();return true;}return false;
 }
}
