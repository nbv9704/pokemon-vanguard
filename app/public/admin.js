import {adminSearchMatch} from './js/admin-search.js';
import {AdminPendingAction} from './js/admin-pending-action.js';
import {createAdminViews} from './js/admin-views.js';

const app=document.querySelector('#admin-app'),toast=document.querySelector('#admin-toast');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number(value||0).toLocaleString();
const state={auth:null,overview:null,catalog:null,players:[],total:0,search:'',selected:null,tab:'summary',view:'players',live:null};
const PENDING_GIFT_KEY='pv-admin-gift-pending-v1';
function restorePendingGift(){try{const value=JSON.parse(sessionStorage.getItem(PENDING_GIFT_KEY));return value?.campaignId&&value?.target&&value?.gift?value:null;}catch{return null;}}
function pendingGift(value){state.pendingGiftCampaign=value;try{if(value)sessionStorage.setItem(PENDING_GIFT_KEY,JSON.stringify(value));else sessionStorage.removeItem(PENDING_GIFT_KEY);}catch{}}
state.pendingGiftCampaign=restorePendingGift();
let pendingAdminAction=null,adminActionBusy=false;
let toastTimer,searchTimer;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3200);}
async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;}
const avatar=(url,name)=>url?`<img class="avatar" src="${esc(url)}" alt="">`:`<span class="avatar">${esc((name||'?').slice(0,1).toUpperCase())}</span>`;
const button=(label,attrs='',cls='')=>`<button class="btn ${cls}" ${attrs}>${label}</button>`;
const {metrics,header,playersView,giftsView,liveRows,pendingActionBanner}=createAdminViews({state,esc,number,avatar,button,getPendingAction:()=>pendingAdminAction});
function render(){const content=state.view==='gifts'?giftsView():state.view==='live'?liveRows():playersView();app.innerHTML=`<div class="admin-shell">${header()}<main class="admin-main">${pendingActionBanner()}${metrics()}${content}</main></div>`;syncGiftScope();}
async function refreshOverview(){state.overview=await api('/api/admin/overview');}
async function loadPlayers({selectFirst=false,append=false}={}){const data=await api(`/api/admin/players?limit=50&offset=${append?state.players.length:0}&search=${encodeURIComponent(state.search)}`);state.players=append?[...state.players,...data.players.filter(player=>!state.players.some(prior=>prior.userId===player.userId))]:data.players;state.total=data.total;if(selectFirst&&!state.selected&&state.players[0])await selectPlayer(state.players[0].userId);render();}
async function selectPlayer(id){state.selected=await api(`/api/admin/players/${encodeURIComponent(id)}`);render();}
async function submitPendingAdminAction(pending){if(adminActionBusy)return;adminActionBusy=true;try{const data=await api(`/api/admin/players/${encodeURIComponent(pending.userId)}/action`,{method:'POST',body:JSON.stringify(pending.action)});pendingAdminAction?.complete(pending.action.actionId);if(data.player&&state.selected?.userId===pending.userId)state.selected=data.player;await refreshOverview();notify(data.duplicate?'Already saved (retry confirmed)':'Saved');render();}finally{adminActionBusy=false;}}
async function action(type,extra={}){
 if(!state.selected)return;if(pendingAdminAction?.get())throw new Error('Resolve the pending Admin action first.');
 const userId=state.selected.userId,payload={type,...extra};
 if(['save.backup','battle.stop','session.disconnect'].includes(type)){
  const data=await api(`/api/admin/players/${encodeURIComponent(userId)}/action`,{method:'POST',body:JSON.stringify(payload)});
  if(data.player)state.selected=data.player;await refreshOverview();notify(data.reference?'Backup created':'Saved');render();return;
 }
 const pending=pendingAdminAction.begin(userId,payload,()=>crypto.randomUUID());render();return submitPendingAdminAction(pending);
}
async function loadLive(){state.live=await api('/api/admin/live');render();}
function syncGiftScope(){const scope=document.querySelector('[data-gift-scope]')?.value;document.querySelector('[data-gift-selected]')?.toggleAttribute('hidden',scope!=='selected');document.querySelector('[data-gift-rank]')?.toggleAttribute('hidden',scope!=='rank');}
function syncGiftRetention(){const selected=document.querySelector('[data-gift-mail-type]')?.selectedOptions?.[0],unread=document.querySelector('[data-gift-unread-days]'),read=document.querySelector('[data-gift-read-days]');if(!selected||!unread||!read)return;unread.value=selected.dataset.unreadDays||unread.value;read.value=selected.dataset.readDays||read.value;}

async function handleClick(target){
 if(target.dataset.adminMore!==undefined)return loadPlayers({append:true});
 if(target.dataset.adminView){state.view=target.dataset.adminView;if(state.view==='live')await loadLive();else render();return;}
 if(target.dataset.playerId)return selectPlayer(target.dataset.playerId);
 if(target.dataset.tab){state.tab=target.dataset.tab;render();return;}
 if(target.dataset.itemOp)return action(`item.${target.dataset.itemOp}`,{itemId:target.dataset.itemId});
 if(target.dataset.pokemonOp){if(target.dataset.pokemonOp==='revoke'&&!confirm('Revoke this Pokémon from the account?'))return;return action(`pokemon.${target.dataset.pokemonOp}`,{speciesId:target.dataset.speciesId});}
 if(target.dataset.teamId)return action('team.activate',{teamId:target.dataset.teamId});
 if(target.dataset.missionOp)return action(`missions.${target.dataset.missionOp}`,{category:target.dataset.category,missionId:target.dataset.missionId});
 if(target.dataset.missionCategoryOp){if(target.dataset.missionCategoryOp==='resetCategory'&&!confirm(`Reset ${target.dataset.category} progress?`))return;return action(`missions.${target.dataset.missionCategoryOp}`,{category:target.dataset.category});}
 if(target.dataset.liveRefresh!==undefined)return loadLive();
 if(target.dataset.livePlayer){state.view='players';await selectPlayer(target.dataset.livePlayer);return;}
 if(target.dataset.liveStop){state.view='players';await selectPlayer(target.dataset.liveStop);if(confirm('Stop this trainer’s active battle/queue as a no-contest?'))await action('battle.stop',{reason:'Stopped from Live Operations'});return;}
 const op=target.dataset.adminOp;if(!op)return;
 if(op==='mutation.retry'){const pending=pendingAdminAction?.get();if(pending)return submitPendingAdminAction(pending);return;}
 if(op==='mutation.discard'){if(confirm('Discard this request? The server MAY have already applied it. Check the account before making any new change.')){pendingAdminAction?.set(null);render();}return;}
 if(op==='gift.discard'){if(confirm('Discard the pending campaign? Previous successful deliveries will remain, and starting a new campaign may send another gift.')){pendingGift(null);render();}return;}
 if(op==='ranked.reset'&&!confirm('Reset this trainer’s Ranked rating and record?'))return;
 if(op==='missions.reset'&&!confirm('Reset all mission and achievement progress for this trainer?'))return;
 if(op==='battle.stop'){const reason=document.querySelector('[data-battle-stop-reason]')?.value||'Administrative stop';if(!confirm('Stop this active battle/queue as a no-contest?'))return;return action(op,{reason});}
 if(op==='session.disconnect'){if(!confirm('Disconnect this trainer’s current game session?'))return;return action(op,{reason:'Admin disconnect'});}
 if(op==='account.suspend'){const suspended=target.dataset.suspended==='true',reason=document.querySelector('[data-suspend-reason]')?.value||'';if(suspended&&!confirm('Suspend this account now? Active sessions will be disconnected.'))return;return action(op,{suspended,reason});}
 return action(op);
}

document.addEventListener('click',async event=>{const target=event.target.closest('[data-admin-view],[data-player-id],[data-tab],[data-admin-op],[data-item-op],[data-pokemon-op],[data-team-id],[data-mission-op],[data-mission-category-op],[data-live-refresh],[data-live-player],[data-live-stop],[data-admin-more]');if(!target)return;try{await handleClick(target);}catch(error){notify(error.message);}});
function giftDraft(form){
 const scope=form.scope.value,target={scope};if(scope==='player')target.userId=state.selected?.userId||'';
 if(scope==='selected')target.userIds=form.userIds.value.split(/\s+/).filter(Boolean);
 if(scope==='rank')target.tierId=form.tierId.value;
 const gift={title:form.title.value,message:form.message.value,mailType:form.mailType.value,unreadDays:Number(form.unreadDays.value),readDays:Number(form.readDays.value),coins:Number(form.coins.value),crystals:Number(form.crystals.value),recruitmentTickets:Number(form.tickets.value),shopTickets:Number(form.shopTickets.value),trainingTickets:Number(form.trainingTickets.value),rankTickets:Number(form.rankTickets.value),itemIds:[...form.itemIds.selectedOptions].map(option=>option.value),speciesIds:[...form.speciesIds.selectedOptions].map(option=>option.value)};
 return {campaignId:crypto.randomUUID(),target,gift};
}
async function submitGift(form){
 if(pendingAdminAction?.get())throw new Error('Resolve the pending Admin action before sending gifts.');
 if(!state.pendingGiftCampaign){const payload=giftDraft(form),scope=payload.target.scope;
  if(scope!=='player'&&!confirm(`Send this gift to ${scope==='all'?'the entire server':scope+' trainers'}?`))return;
  pendingGift(payload);
 }
 const payload=state.pendingGiftCampaign,result=await api('/api/admin/gifts',{method:'POST',body:JSON.stringify(payload)});
 if(result.failed){notify(`Campaign ${result.campaignId}: ${result.failed} failed in this batch. Retry the same batch.`);render();return;}
 if(result.nextCursor!==null&&result.nextCursor!==undefined){pendingGift({...payload,cursor:result.nextCursor});notify(`Campaign ${result.campaignId}: processed ${result.processed} accounts; ${result.remaining} remaining. Continue sending.`);render();return;}
 pendingGift(null);notify(`Campaign ${result.campaignId}: ${result.targeted} delivered (${result.duplicates||0} duplicates skipped).`);await refreshOverview();render();
}
document.addEventListener('submit',async event=>{event.preventDefault();try{const form=event.target;if(form.matches('[data-economy-form]'))await action('economy.set',{coins:Number(form.coins.value),crystals:Number(form.crystals.value)});else if(form.matches('[data-tickets-form]'))await action('tickets.set',{recruitmentTickets:Number(form.recruitmentTickets.value),shopTickets:Number(form.shopTickets.value),trainingTickets:Number(form.trainingTickets.value),rankTickets:Number(form.rankTickets.value),rankProtectionArmed:form.rankProtectionArmed.value==='true'});else if(form.matches('[data-rating-form]'))await action('ranked.setRating',{rating:Number(form.rating.value)});else if(form.matches('[data-note-form]'))await action('account.note',{note:form.note.value});else if(form.matches('[data-gift-form]'))await submitGift(form);}catch(error){notify(error.message);}});
document.addEventListener('input',event=>{const target=event.target;if(target.matches('[data-admin-search]')){state.search=target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadPlayers(),250);return;}const key=target.dataset.filterList;if(key){const rows=[...document.querySelectorAll(`[data-filter-target="${key}"] [data-search-text]`)];let visible=0;for(const row of rows){const match=adminSearchMatch(row.dataset.searchText,target.value);row.hidden=!match;row.style.display=match?'':'none';if(match)visible++;}const empty=document.querySelector(`[data-filter-empty="${key}"]`);if(empty)empty.hidden=visible!==0;}});
document.addEventListener('change',event=>{if(event.target.matches('[data-gift-scope]'))syncGiftScope();if(event.target.matches('[data-gift-mail-type]'))syncGiftRetention();});

try{const session=await api('/api/auth/session');if(!session.authenticated||!session.user?.admin){location.replace('/');throw new Error('ADMIN_REQUIRED');}state.auth=session.user;pendingAdminAction=new AdminPendingAction(typeof sessionStorage==='undefined'?null:sessionStorage,state.auth.accountId);[state.overview,state.catalog]=await Promise.all([api('/api/admin/overview'),api('/api/admin/catalog')]);await loadPlayers({selectFirst:true});render();}catch(error){if(error.message!=='ADMIN_REQUIRED')app.innerHTML=`<div class="admin-loading">Admin console unavailable: ${esc(error.message)}. <a href="/">Return to game</a></div>`;}
