import {renderBattleArena} from './v2-battle-arena.js';
import {syncReplacementButton} from './v2-battle-commands.js';
import {renderBattleLanding,renderBattlePreview,syncPreviewSelection} from './v2-battle-preview.js';

export class V2BattleScreen{
 constructor({onChange,sendAction}){this.onChange=onChange;this.send=sendAction;this.previewId=null;this.selection=[];this.commands={};this.replacements={};this.difficulty='normal';}
 render(state,catalog,helpers){if(!catalog)return '<div class="empty">Đang tải battle catalog…</div>';const view=state.battleV2;if(!view||this.dismissedId===view.id)return renderBattleLanding(this,state);if(view.phase==='PREVIEW')return renderBattlePreview(this,view,catalog,helpers);return renderBattleArena(this,view,catalog,helpers);}
 handleClick(element,state,catalog){
  const action=element.dataset.v2battle;if(!action)return false;const view=state.battleV2;
  if(action==='start'){this.dismissedId=null;this.send({type:'battleV2.preview.start',mode:element.dataset.mode,regulationId:element.dataset.regulation,difficulty:this.difficulty});}
  if(action==='pick'){const id=element.dataset.buildId,index=this.selection.indexOf(id);if(index>=0)this.selection.splice(index,1);else this.selection.push(id);syncPreviewSelection(this,element,view,catalog);}
  if(action==='lock')this.send({type:'battleV2.preview.lock',buildIds:[...this.selection]});
  if(action==='move'){const actorId=element.dataset.actorId,move=catalog.moves.find(entry=>entry.id===element.dataset.moveId);this.commands[actorId]={kind:'move',actorId,moveId:move.id,...(move.targetMode==='foe'?{target:{side:'B',slot:0}}:{})};for(const button of element.closest('.v2-moves').querySelectorAll('button'))button.classList.toggle('selected',button===element);}
  if(action==='submit')this.send({type:'battleV2.commands',phaseRevision:view.snapshot.phaseRevision,commands:Object.values(this.commands).filter(command=>view.snapshot.own.some(mon=>mon.activeSlot>=0&&mon.hp>0&&mon.battleMonId===command.actorId))});
  if(action==='replace')this.send({type:'battleV2.replacements',phaseRevision:view.snapshot.phaseRevision,replacements:Object.entries(this.replacements).filter(([,monId])=>monId).map(([slot,monId])=>({slot:Number(slot),monId}))});
  if(action==='surrender')this.send({type:'battleV2.surrender'});if(action==='new'){this.dismissedId=view.id;this.onChange();}return true;
 }
 handleInput(target){if(target.dataset.v2Field==='difficulty'){this.difficulty=target.value;return true;}if(target.dataset.v2Target){const command=this.commands[target.dataset.v2Target];if(command?.kind==='move')command.target={side:'B',slot:Number(target.value)};return true;}if(target.dataset.v2Switch){const actorId=target.dataset.v2Switch;if(target.value)this.commands[actorId]={kind:'switch',actorId,toId:target.value};else delete this.commands[actorId];return true;}if(target.dataset.v2Replacement!==undefined){syncReplacementButton(this,target);return true;}return false;}
}
