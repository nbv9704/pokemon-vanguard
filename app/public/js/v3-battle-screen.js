import {renderV3BattleLanding,renderV3BattlePreview} from './v3-battle-preview.js';
import {renderV3Commands,renderV3Replacements} from './v3-battle-commands.js';
import {battleLog,createTurnFrames} from './v3-battle-timeline.js';
import {renderV3BattleFx} from './v3-move-fx.js';
import {renderV3FieldEffects} from './v3-field-effects.js';
import {renderV3PlaybackControls} from './v3-playback-controls.js';
import {V3PlaybackRunner} from './v3-playback-runner.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function fighter(mon,own,{art,battleArt=art,hit,cast}){
 const hp=own?mon.hp/mon.maxHp*100:mon.hpPercent,status=typeof mon.status==='object'?mon.status?.id:mon.status;
 return `<article class="v2-fighter v3-fighter ${own?'player-fighter':'opponent-fighter'} slot-${mon.activeSlot} ${hit.has(mon.actorId)?'hit':''} ${cast.has(mon.actorId)?'cast':''}">${battleArt(mon.speciesId,own?'back':'front')}<div class="v3-battle-hud"><b>${esc(mon.name)}</b><span>${Math.round(hp)}% HP${status?' · '+esc(status):''}</span><i><u style="width:${Math.max(0,hp)}%"></u></i></div></article>`;
}

function resolutionPanel(playback){
 const title=playback.stage==='mega'?'Mega Evolution':playback.stage==='endTurn'?'Resolving end-of-turn effects':`Resolving action ${playback.action} / ${playback.total}`;
 const detail=playback.stage==='mega'?'The form, stats and Ability update before the move order continues.':playback.stage==='cast'?'Move animation is playing. Damage and effects apply on impact.':playback.stage==='impact'?'Impact resolved.':'Battle state updated.';
 return `<div class="panel v3-resolving" role="status"><div><b>${title}</b><span>${detail}</span></div></div>`;
}

function battleControls(screen,view,catalog){
 const snapshot=view.snapshot;if(screen.playback)return resolutionPanel(screen.playback);
 if(snapshot.phase==='COMMAND')return renderV3Commands(screen,view,catalog);
 if(snapshot.phase==='REPLACE')return renderV3Replacements(screen,view);
 if(snapshot.phase==='FINISHED')return `<section class="panel v2-result"><small>BETA BATTLE COMPLETE</small><h2>${snapshot.result?.winner==='A'?'Victory':snapshot.result?.winner==='B'?'Defeat':'Draw'}</h2><p>${esc(snapshot.result?.reason)} · ${snapshot.turn} turns</p>${view.reward?`<p>+${view.reward.coins} coins · +${view.reward.crystals} crystals</p>`:''}<button class="primary" data-v3-battle="new">New battle</button></section>`;
 return '<div class="panel">Resolving…</div>';
}

function arena(screen,view,catalog,helpers){
 const playback=screen.playback,snapshot=playback?.snapshot||view.snapshot,events=playback?.events||[],history=playback?[...playback.priorEvents,...playback.visibleEvents]:(view.history||view.events||[]);
 const hit=new Set(events.filter(event=>event.kind==='damage').map(event=>event.targetId)),cast=new Set(events.filter(event=>event.kind==='moveStarted').map(event=>event.actorId));
 const own=snapshot.own.filter(mon=>mon.activeSlot>=0).sort((a,b)=>a.activeSlot-b.activeSlot),foes=snapshot.opponent.filter(mon=>mon.activeSlot>=0).sort((a,b)=>a.activeSlot-b.activeSlot);
 const phase=playback?(playback.stage==='mega'?'MEGA':playback.stage==='endTurn'?'END TURN':`ACTION ${playback.action}/${playback.total}`):snapshot.phase;
 const log=battleLog(history,view.snapshot,catalog).slice(-80).map(entry=>`<p class="log-${entry.kind}"><small>T${entry.turn}</small>${esc(entry.text)}</p>`).join('');
 return `<div class="v2-battle-head"><div><small>SCHEMA 3 · ${esc(view.difficulty)} AI</small><h2>${view.mode==='double'?'Double':'Single'} Battle · Turn ${snapshot.turn}</h2></div><span class="phase-chip">${phase}</span></div>${renderV3PlaybackControls({speed:screen.playbackSpeed,playing:!!playback})}<div class="v2-arena v3-battle-arena format-${view.mode} playback-speed-${screen.playbackSpeed}">${renderV3FieldEffects(snapshot)}${renderV3BattleFx(playback,catalog)}<div class="v2-side enemy-side">${foes.map(mon=>fighter(mon,false,{...helpers,hit,cast})).join('')}</div><div class="v2-side own-side">${own.map(mon=>fighter(mon,true,{...helpers,hit,cast})).join('')}</div></div>${battleControls(screen,view,catalog)}<aside class="panel v2-log" aria-live="polite"><h3>Battle log · ordered timeline</h3>${log||'<p>The battle begins.</p>'}</aside>${!playback&&snapshot.phase!=='FINISHED'?'<button data-v3-battle="surrender" class="small ghost">Surrender</button>':''}`;
}

export class V3BattleScreen{
 constructor({onChange,sendAction,wait,playbackSpeed=1,onPlaybackSpeedChange=()=>{}}){
  this.onChange=onChange;this.send=sendAction;this.selection=[];this.commands={};this.replacements={};this.difficulty='normal';this.playback=null;this.playbackToken=0;this.playedTurnKey=null;this.playbackSpeed=playbackSpeed===2?2:1;this.onPlaybackSpeedChange=onPlaybackSpeedChange;this.runner=new V3PlaybackRunner({waitImpl:wait});
 }
 render(state,catalog,helpers){if(!catalog)return '<div class="empty">Loading beta catalog…</div>';const view=state.battleV3;if(!view||this.dismissedId===view.id)return renderV3BattleLanding(this,state);if(view.phase==='PREVIEW')return renderV3BattlePreview(this,view,catalog,helpers);return arena(this,view,catalog,helpers);}
 async playTurn(view,{reduced=false,speed=this.playbackSpeed}={}){
  const events=view.events||[],key=events.at(-1)?.id;if(!view.turnSnapshots?.initial||!events.some(event=>event.kind==='turnStarted')||!key||key===this.playedTurnKey)return false;
  this.playedTurnKey=key;this.commands={};this.playbackSpeed=speed===2?2:1;this.runner.configure({speed:this.playbackSpeed,reduced});
  const token=++this.playbackToken,currentIds=new Set(events.map(event=>event.id)),priorEvents=(view.history||[]).filter(event=>!currentIds.has(event.id)),frames=createTurnFrames(view.turnSnapshots.initial,events,{reduced});
  for(const frame of frames){if(token!==this.playbackToken)return true;this.playback={...frame,priorEvents,speed:this.playbackSpeed};this.onChange();await this.runner.wait(frame.duration);}
  if(token===this.playbackToken){this.playback=null;this.onChange();}return true;
 }
 cancelPlayback(){this.playbackToken++;this.runner.cancel();this.playback=null;}
 skipPlayback(){if(!this.playback)return false;this.cancelPlayback();this.onChange();return true;}
 handleClick(el,state,catalog){
  const action=el.dataset.v3Battle;if(action==='skip')return this.skipPlayback();if(this.playback)return true;const view=state.battleV3;
  if(action==='start'){this.dismissedId=null;this.send({type:'battleV3.preview.start',mode:el.dataset.mode,difficulty:this.difficulty});}
  if(action==='pick'){const id=el.dataset.buildId,index=this.selection.indexOf(id);index>=0?this.selection.splice(index,1):this.selection.push(id);this.onChange();}
  if(action==='lock')this.send({type:'battleV3.preview.lock',buildIds:[...this.selection]});if(action==='move')this.selectMove(el,view,catalog);
  if(action==='submit'){const active=new Set(view.snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp>0).map(mon=>mon.actorId));this.send({type:'battleV3.commands',phaseRevision:view.snapshot.phaseRevision,commands:Object.values(this.commands).filter(command=>active.has(command.actorId))});}
  if(action==='replace')this.send({type:'battleV3.replacements',phaseRevision:view.snapshot.phaseRevision,replacements:Object.entries(this.replacements).map(([slot,actorId])=>({slot:Number(slot),actorId})).filter(entry=>entry.actorId)});
  if(action==='surrender')this.send({type:'battleV3.surrender'});if(action==='new'){this.dismissedId=view.id;this.onChange();}return true;
 }
 selectMove(el,view,catalog){
  const actorId=el.dataset.actorId,mon=view.snapshot.own.find(entry=>entry.actorId===actorId);if(mon?.volatiles?.['must-recharge']||mon?.volatiles?.['two-turn-move'])return;const move=catalog.moves.find(entry=>entry.id===el.dataset.moveId),snapshot=view.snapshot,index=snapshot.own.filter(mon=>mon.activeSlot>=0&&mon.hp>0).findIndex(mon=>mon.actorId===actorId),reserves=snapshot.own.filter(mon=>mon.activeSlot<0&&mon.hp>0),automatic=['self','userSide','field','allAdjacentFoes','allAdjacent','foeSide'].includes(move.actionProfile.targetMode),mega=this.commands[actorId]?.mega===true;
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
