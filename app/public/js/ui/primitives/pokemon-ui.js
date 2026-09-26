const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderPokemonWindow({body='',title='',variant='normal',className='',tag='section',attrs=''}={}){
 return `<${tag} class="aether-window aether-window-${esc(variant)} ${className}" ${attrs}>${title?`<header class="aether-window-title">${esc(title)}</header>`:''}<div class="aether-window-body">${body}</div></${tag}>`;
}
export const renderAetherWindow=renderPokemonWindow;

export function renderMessageBox({title='',message='',className='',live='polite'}={}){
 return renderPokemonWindow({variant:'dialog',className:`aether-message-box ${className}`,attrs:`role="status" aria-live="${esc(live)}"`,body:`${title?`<b>${esc(title)}</b>`:''}<span>${esc(message)}</span><i class="aether-prompt-arrow" aria-hidden="true"></i>`});
}
export function renderPokemonHud(mon,{own=false,hpPercent,hpFromPercent=null,status='',mega=false}={}){
 const hp=Math.max(0,Math.min(100,Number(hpPercent)||0)),from=Number.isFinite(hpFromPercent)?Math.max(0,Math.min(100,hpFromPercent)):null,low=hp<=20?' low':hp<=50?' mid':'',committing=from!==null&&Math.abs(from-hp)>.01;
 return `<div class="pokemon-hud ${own?'pokemon-hud-player':'pokemon-hud-opponent'}"><div class="pokemon-hud-line"><strong>${esc(mon?.name||'Pokémon')}</strong>${mega?'<em class="v3-mega-badge">MEGA</em>':''}</div><div class="pokemon-hud-meta"><span>HP</span><span>${Math.round(hp)}%${status?` · ${esc(status)}`:''}</span></div><div class="pokemon-hp-track" aria-label="${Math.round(hp)} percent HP"><i class="pokemon-hp-fill${low}${committing?' hp-committing':''}" style="--hp:${hp}%;${committing?`--hp-from:${from}%;`:''}"></i></div></div>`;
}
