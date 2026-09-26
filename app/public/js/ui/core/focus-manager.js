import {InputAction} from './input-manager.js';

const directions=new Set([InputAction.UP,InputAction.DOWN,InputAction.LEFT,InputAction.RIGHT]);
const value=(entry,key,fallback)=>Number.isFinite(Number(entry?.[key]))?Number(entry[key]):fallback;

export function chooseDirectionalTarget(entries,currentId,action,{wrap=true}={}){
 const enabled=(entries||[]).filter(entry=>entry&&!entry.disabled);
 if(!enabled.length)return null;
 const current=enabled.find(entry=>entry.id===currentId)||enabled[0];
 if(!directions.has(action))return current.id;
 const cr=value(current,'row',0),cc=value(current,'col',enabled.indexOf(current));
 const scored=enabled.filter(entry=>entry.id!==current.id).map((entry,index)=>{
  const er=value(entry,'row',0),ec=value(entry,'col',index),dr=er-cr,dc=ec-cc;
  const valid=action===InputAction.UP?dr<0:action===InputAction.DOWN?dr>0:action===InputAction.LEFT?dc<0:dc>0;
  const primary=action===InputAction.UP||action===InputAction.DOWN?Math.abs(dr):Math.abs(dc);
  const secondary=action===InputAction.UP||action===InputAction.DOWN?Math.abs(dc):Math.abs(dr);
  return {entry,valid,score:primary*100+secondary};
 }).filter(item=>item.valid).sort((a,b)=>a.score-b.score);
 if(scored.length)return scored[0].entry.id;
 if(!wrap)return current.id;
 const ordered=[...enabled].sort((a,b)=>value(a,'row',0)-value(b,'row',0)||value(a,'col',0)-value(b,'col',0));
 const pos=ordered.findIndex(entry=>entry.id===current.id);
 if(action===InputAction.UP||action===InputAction.LEFT)return ordered[(pos-1+ordered.length)%ordered.length].id;
 return ordered[(pos+1)%ordered.length].id;
}

const elementsIn=root=>[...(root?.querySelectorAll?.('[data-ui-focusable]:not([disabled])')||[])];
export class FocusManager{
 constructor({wrap=true}={}){this.wrap=wrap;this.lastId=null;}
 entries(root){return elementsIn(root).map((el,index)=>({id:el.dataset.uiFocusId||`focus-${index}`,row:el.dataset.uiRow??0,col:el.dataset.uiCol??index,disabled:el.disabled,el}));}
 currentId(root){const entries=this.entries(root),active=root?.ownerDocument?.activeElement,match=entries.find(entry=>entry.el===active);return match?.id||this.lastId||entries[0]?.id||null;}
 focus(root,id){const entries=this.entries(root),entry=entries.find(item=>item.id===id);if(!entry)return false;for(const item of entries)item.el.classList?.remove?.('ui-cursor-focus');entry.el.focus?.({preventScroll:true});entry.el.classList?.add('ui-cursor-focus');const scroller=entry.el.closest?.('[data-ui-scroll-container]');if(scroller){const top=entry.el.offsetTop,bottom=top+entry.el.offsetHeight;if(top<scroller.scrollTop)scroller.scrollTop=Math.max(0,top-6);else if(bottom>scroller.scrollTop+scroller.clientHeight)scroller.scrollTop=Math.max(0,bottom-scroller.clientHeight+6);}this.lastId=entry.id;return true;}
 ensure(root){const entries=this.entries(root);if(!entries.length)return false;const active=root?.ownerDocument?.activeElement;if(entries.some(entry=>entry.el===active))return true;return this.focus(root,this.lastId&&entries.some(entry=>entry.id===this.lastId)?this.lastId:entries[0].id);}
 move(root,action){const entries=this.entries(root);if(!entries.length)return false;const active=root?.ownerDocument?.activeElement,hasActive=entries.some(entry=>entry.el===active),hasLast=this.lastId&&entries.some(entry=>entry.id===this.lastId);if(!hasActive&&!hasLast)return this.focus(root,entries[0].id);const current=this.currentId(root),next=chooseDirectionalTarget(entries,current,action,{wrap:this.wrap});return next?this.focus(root,next):false;}
 activate(root){const entries=this.entries(root),active=root?.ownerDocument?.activeElement,entry=entries.find(item=>item.el===active)||entries.find(item=>item.id===this.lastId);if(!entry)return false;entry.el.click?.();return true;}
 clear(){this.lastId=null;}
}
