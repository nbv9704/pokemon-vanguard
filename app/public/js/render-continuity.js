// Preserve focus and scroll across server-pushed UI renders.
const continuityAttributes=['data-replica-code','data-shop-field','data-v3-archive-input','data-v3-field','data-v3-stat','data-v3-move','data-v3-team-field','data-v3-battle-field','data-box-field','data-team-field','data-team-slot','data-training-field','data-training-stat','data-training-move','data-damage-field','data-v2-field','data-arena-field','data-social-field','data-ui-focus-id'];
function continuitySelector(element){
 if(!element||element===document.body)return null;
 if(element.id)return `#${CSS.escape(element.id)}`;
 for(const name of continuityAttributes)if(element.hasAttribute?.(name))return `[${name}="${CSS.escape(element.getAttribute(name))}"]`;
 return null;
}
export function captureRenderContinuity(page,renderedPage){
 if(renderedPage!==page)return null;
 const active=document.activeElement,selector=continuitySelector(active);
 return {selector,selectionStart:Number.isInteger(active?.selectionStart)?active.selectionStart:null,selectionEnd:Number.isInteger(active?.selectionEnd)?active.selectionEnd:null,windowX:window.scrollX,windowY:window.scrollY,scroll:[...document.querySelectorAll('[data-ui-scroll-container]')].map((element,index)=>({key:element.dataset.uiScrollKey||String(index),top:element.scrollTop,left:element.scrollLeft}))};
}
export function restoreRenderContinuity(value){
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
