const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export class V3RecruitmentView{
 render(state,catalog,{art}){
  if(!catalog||!state.trainingV3)return '<div class="empty">Loading Pokémon catalog…</div>';
  const builds=new Map(state.trainingV3.builds.map(build=>[build.monId,build])),mons=new Map(state.trainingV3.mons.map(mon=>[mon.speciesId,mon]));
  const ability=id=>catalog.abilities.find(entry=>entry.id===id)?.name||id,move=id=>catalog.moves.find(entry=>entry.id===id)?.name||id;
  const cards=catalog.species.map(species=>{const mon=mons.get(species.id),build=builds.get(mon?.monId)||species.defaultBuild;return `<article class="recruit-card permanent"><div class="recruit-card-top"><span>#${String(species.dexNumber).padStart(3,'0')}</span><span>M-A BETA</span></div>${art(species.id)}<h3>${esc(species.name)}</h3><div class="recruit-types">${species.types.map(type=>`<span>${esc(type)}</span>`).join('')}</div><div class="recruit-spec"><small>Ability</small><b>${esc(ability(build.abilityId))}</b></div><div class="recruit-spec"><small>Current beta moves</small><span>${build.moveIds.map(move).map(esc).join(' · ')}</span></div><div class="recruit-price"><span>Playable beta roster</span><b>${mon?'Unlocked':'Unavailable'}</b></div><div class="recruit-actions"><button data-action="nav:training">Edit build</button><button class="primary" data-action="nav:teams">Add to team</button></div></article>`;}).join('');
  return `<section class="panel recruit-guide"><b>Regulation M-A beta roster</b><span>Six reviewed Pokémon are unlocked so the battle beta can be tested immediately.</span><span>Roster Ranch rotation, trials and permanent recruitment will be enabled in R5 after beta feedback.</span></section><section class="panel recruit-status"><div><div class="eyebrow">LOCAL POKÉMON CATALOG</div><h2>Recruitment</h2><p>Every Pokémon below uses the promoted schema-3 catalog and a local idle sprite.</p></div><span class="pill">${catalog.species.length} BETA POKÉMON</span></section><div class="recruit-grid">${cards}</div>`;
 }
}
