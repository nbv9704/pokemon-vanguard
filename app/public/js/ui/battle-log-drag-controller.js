const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class BattleLogDragController{
 constructor(){this.position=null;this.drag=null;}
 panel(root=document){return root.querySelector('.pokemon-battle-log');}
 stage(root=document){return root.querySelector('.pokemon-battle-stage');}
 apply(root=document){
  const stage=this.stage(root),panel=this.panel(root);if(!stage||!panel)return false;
  panel.dataset.battleLogDraggable='true';panel.querySelector('.aether-window-title')?.setAttribute('title','Drag to move · double-click to reset');
  if(!this.position){panel.classList.remove('battle-log-dragged');panel.style.removeProperty('--battle-log-left');panel.style.removeProperty('--battle-log-top');return true;}
  const maxX=Math.max(0,stage.clientWidth-panel.offsetWidth),maxY=Math.max(0,stage.clientHeight-panel.offsetHeight),x=clamp(this.position.x*maxX,0,maxX),y=clamp(this.position.y*maxY,0,maxY);
  panel.classList.add('battle-log-dragged');panel.style.setProperty('--battle-log-left',`${Math.round(x)}px`);panel.style.setProperty('--battle-log-top',`${Math.round(y)}px`);return true;
 }
 start(event,root=document){
  if(event.button!==0)return false;const handle=event.target?.closest?.('.pokemon-battle-log .aether-window-title');if(!handle)return false;
  const panel=handle.closest('.pokemon-battle-log'),stage=panel?.closest('.pokemon-battle-stage');if(!panel||!stage)return false;
  const stageRect=stage.getBoundingClientRect(),panelRect=panel.getBoundingClientRect(),scaleX=stage.clientWidth/stageRect.width,scaleY=stage.clientHeight/stageRect.height,localX=(event.clientX-stageRect.left)*scaleX,localY=(event.clientY-stageRect.top)*scaleY;
  this.drag={panel,stage,pointerId:event.pointerId,grabX:localX-panel.offsetLeft,grabY:localY-panel.offsetTop};handle.setPointerCapture?.(event.pointerId);panel.classList.add('battle-log-dragging');event.preventDefault();return true;
 }
 move(event){
  const drag=this.drag;if(!drag||event.pointerId!==drag.pointerId)return false;const {panel,stage}=drag,rect=stage.getBoundingClientRect(),scaleX=stage.clientWidth/rect.width,scaleY=stage.clientHeight/rect.height,maxX=Math.max(0,stage.clientWidth-panel.offsetWidth),maxY=Math.max(0,stage.clientHeight-panel.offsetHeight),x=clamp((event.clientX-rect.left)*scaleX-drag.grabX,0,maxX),y=clamp((event.clientY-rect.top)*scaleY-drag.grabY,0,maxY);
  this.position={x:maxX?x/maxX:0,y:maxY?y/maxY:0};panel.classList.add('battle-log-dragged');panel.style.setProperty('--battle-log-left',`${Math.round(x)}px`);panel.style.setProperty('--battle-log-top',`${Math.round(y)}px`);event.preventDefault();return true;
 }
 end(event){if(!this.drag||event.pointerId!==this.drag.pointerId)return false;this.drag.panel.classList.remove('battle-log-dragging');this.drag=null;return true;}
 reset(root=document){this.position=null;this.drag=null;this.apply(root);}
}
