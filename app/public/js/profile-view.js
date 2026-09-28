import {imageAttributes} from './image-variants.js';
import {presentationAsset,hasBespokeAsset} from './presentation-assets.js';
import {rankedTierEmblem,rankedTierLine,rankedTierNext} from './ranked-tier-view.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const title=value=>String(value||'').replace(/(^|-)(\w)/g,(_,dash,char)=>`${dash?' ':''}${char.toUpperCase()}`);
const providerLabel=provider=>({google:'Google',discord:'Discord',local:'Local Beta',browser:'Browser'})[provider]||title(provider||'Account');
const avatar=(auth,size='large')=>auth?.avatar?`<img src="${esc(auth.avatar)}" alt="">`:`<span>${esc((auth?.name||'V').slice(0,1).toUpperCase())}</span>`;
const pokemonPortrait=member=>{const id=member?.spriteKey||member?.speciesId||'missing';return `<span class="profile-team-portrait ${hasBespokeAsset(id,'artwork')?'':'pokemon-art-missing'}"><img ${imageAttributes(presentationAsset(id,'artwork'),{size:52})} alt=""></span>`;};
const progress=(value,max)=>Math.max(0,Math.min(100,Math.round((Number(value)||0)/Math.max(1,Number(max)||1)*100)));

export class ProfileView{
 render(state,auth,{connected=false}={}){
  const profile=state?.profileV1;if(!profile)return '<div class="empty">Loading trainer profile…</div>';
  const stats=profile.stats||{},ranked=profile.ranked||{},team=profile.activeTeam,achievements=profile.achievements||{entries:[]},name=auth?.name||'Vanguard Trainer',provider=providerLabel(auth?.provider),accountLinked=['google','discord'].includes(auth?.provider);
  const metrics=[
   ['⚔','Battle Wins',stats.wins||0,'Victories'],
   ['◎','Battles',stats.battles||0,'Tracked matches'],
   ['▦','Pokémon',`${stats.ownedPokemon||0}/${stats.totalPokemon||0}`,'Permanent roster'],
   ['◆','Items',`${stats.ownedItems||0}/${stats.totalItems||0}`,'Battle inventory'],
   ['✦','Mega Uses',stats.megaEvolutions||0,'Transformations'],
   ['♜','Badges',stats.badges||0,'League progress']
  ];
  const achievementEntries=(achievements.entries||[]).slice().sort((a,b)=>Number(b.claimable)-Number(a.claimable)||Number(b.complete)-Number(a.complete)||b.progress/b.target-a.progress/a.target).slice(0,4);
  return `<section class="trainer-profile-shell">
   <section class="trainer-profile-hero aether-window">
    <div class="trainer-profile-avatar">${avatar(auth)}</div>
    <div class="trainer-profile-identity"><small>VANGUARD TRAINER</small><h2>${esc(name)}</h2><div class="trainer-profile-badges"><span>${esc(provider)} ACCOUNT</span><span>REGULATION ${esc(profile.regulation||'M-A')}</span><span>RANKED ${rankedTierLine(ranked)}</span></div><p>${accountLinked?'Your adventure is linked to this account and saved through Vanguard account storage.':'Development profile. Public accounts use Google or Discord sign-in.'}</p></div>
    <div class="trainer-profile-side"><div class="trainer-profile-rank">${rankedTierEmblem(ranked)}<div><small>RANKED TIER</small><b>${esc(ranked.tier||'Poké Ball')}</b><span>${esc(ranked.rating??1000)} RP</span><em>${rankedTierNext(ranked)}</em></div></div><div class="trainer-profile-save ${connected?'online':'offline'}"><span>${connected?'●':'○'}</span><div><small>ADVENTURE SAVE</small><b>${connected?'SAVED':'RECONNECTING'}</b></div></div></div>
   </section>
   <section class="trainer-profile-stats">${metrics.map(([icon,label,value,note])=>`<article class="profile-stat-card aether-window"><span>${icon}</span><div><small>${esc(label)}</small><b>${esc(value)}</b><em>${esc(note)}</em></div></article>`).join('')}</section>
   <div class="trainer-profile-grid">
    <section class="profile-team-card aether-window"><header><div><small>ACTIVE BATTLE TEAM</small><h2>${esc(team?.name||'No active team')}</h2></div><button data-action="nav:teams">Manage Team</button></header><div class="profile-team-members">${team?.members?.length?team.members.map((member,index)=>`<article>${pokemonPortrait(member)}<span><small>SLOT ${index+1}</small><b>${esc(member.name)}</b><em>${(member.types||[]).map(type=>esc(title(type))).join(' · ')}</em></span></article>`).join(''):'<div class="profile-empty">Build a Battle Team to show it here.</div>'}</div></section>
    <section class="profile-achievement-card aether-window"><header><div><small>ACHIEVEMENT PROGRESS</small><h2>${achievements.complete||0} / ${achievements.total||0} complete</h2></div>${achievements.claimable?`<span class="profile-claimable">${achievements.claimable} READY</span>`:''}</header><div class="profile-achievement-list">${achievementEntries.map(entry=>`<article class="${entry.complete?'complete':''}"><div><b>${esc(entry.title)}</b><small>${esc(entry.description)}</small></div><span>${entry.claimed?'CLAIMED':entry.claimable?'READY':`${entry.progress}/${entry.target}`}</span><i><span style="width:${progress(entry.progress,entry.target)}%"></span></i></article>`).join('')}</div><button data-action="nav:missions">Open Missions</button></section>
   </div>
   <section class="profile-account-card aether-window"><div><small>ACCOUNT</small><h3>${esc(provider)} sign-in</h3><p>${accountLinked?`Profile name and avatar come from your connected sign-in provider. Ranked record: ${ranked.wins||0}W · ${ranked.losses||0}L · ${ranked.draws||0}D, peak ${ranked.peakRating??ranked.rating??1000}.`:'Local Beta is intended for development only. Ranked matchmaking requires Google or Discord sign-in.'}</p></div><button data-action="settings">Settings</button></section>
  </section>`;
 }
}
