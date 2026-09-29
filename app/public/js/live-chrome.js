/**
 * Patch shell values that can change without rebuilding active route content.
 * @param {{root:Document,view:import('./types/browser-contracts.d.ts').PublicView,connectionText:string,unreadMailCount:number}} input
 */
export function patchLiveChrome({root,view,connectionText,unreadMailCount}){
 for(const [selector,value,label] of [['[data-live-vp]',view.coins,'VP balance'],['[data-live-gems]',view.gems,'PokéGem balance']]){
  const node=root.querySelector(selector),liveValue=node?.querySelector('[data-live-value]');if(!node||!liveValue)continue;
  const formatted=Number(value||0).toLocaleString();liveValue.textContent=formatted;node.setAttribute('aria-label',`${label}: ${formatted}`);
 }
 const online=root.querySelector('[data-live-connection]');if(online)online.textContent=`● ${connectionText}`;
 const badges=[['friends',(view.socialV1?.incomingRequests?.length||0)+(view.trainingPvpV1?.incomingInvites?.length||0),'notifications'],['mail',unreadMailCount,'unread messages'],['missions',view.missions?.claimableCount||0,'notifications']];
 for(const [route,count,label] of badges){const button=root.querySelector(`[data-nav-route="${route}"]`);if(!button)continue;let badge=button.querySelector('.badge');if(!count){badge?.remove();continue;}if(!badge){badge=root.createElement('span');badge.className=`badge ${route==='friends'?'social-badge':''}`;button.append(badge);}badge.textContent=String(count);badge.setAttribute('aria-label',`${count} ${label}`);}
}
