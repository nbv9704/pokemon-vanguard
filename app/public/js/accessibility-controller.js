const ROUTE_LABELS={home:'Home',battle:'Arena',collection:'Pokedex',teams:'Box',recruitment:'Recruitment',shop:'Shop',missions:'Missions',friends:'Friends',gym:'Gym Challenge',training:'Training',mail:'Mailbox',bag:'Bag',profile:'Profile',settings:'Settings'};

export function routeLabel(route){return ROUTE_LABELS[route]||'Vanguard';}

export class AccessibilityController{
 constructor({documentRef=document}={}){this.document=documentRef;this.pendingRoute=null;}
 routeChanged(route){this.pendingRoute=route;}
 afterRender(page){
  const label=routeLabel(page);this.document.title=`Pokémon Vanguard · ${label}`;
  if(this.pendingRoute!==page)return false;
  this.pendingRoute=null;const main=this.document.querySelector?.('#main-content');
  main?.focus?.({preventScroll:true});return !!main;
 }
 handleMenuKey(event,{onClose}={}){
  const menu=this.document.querySelector?.('#account-dropdown');if(!menu||menu.hidden)return false;
  const items=[...(menu.querySelectorAll?.('[role="menuitem"]')||[])].filter(item=>!item.disabled);
  if(event.key==='Escape'){event.preventDefault?.();onClose?.();this.document.querySelector?.('[data-action="account-menu"]')?.focus?.({preventScroll:true});return true;}
  if(event.key==='Tab'){onClose?.();return false;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||!items.length)return false;
  event.preventDefault?.();const active=this.document.activeElement,index=items.indexOf(active),last=items.length-1;
  const next=event.key==='Home'?0:event.key==='End'?last:event.key==='ArrowDown'?(index+1+items.length)%items.length:index<0?last:(index-1+items.length)%items.length;
  items[next].focus?.({preventScroll:true});return true;
 }
}
