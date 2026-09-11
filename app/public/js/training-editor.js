const clone=value=>JSON.parse(JSON.stringify(value));
const statKeys=['hp','atk','def','spa','spd','spe'];
const labels={hp:'HP',atk:'ATK',def:'DEF',spa:'SPA',spd:'SPD',spe:'SPE'};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function statsFor(species,build){
 const result={hp:100+species.baseStats.hp+2*build.points.hp};
 for(const key of statKeys.slice(1)){const alignment=build.alignment.up===key?1.1:build.alignment.down===key?.9:1;result[key]=Math.floor((species.baseStats[key]+20+2*build.points[key])*alignment);}
 return result;
}

export class TrainingEditor{
 constructor({fetchImpl,onChange,sendAction}){this.fetch=fetchImpl;this.onChange=onChange;this.send=sendAction;this.catalog=null;this.monId=null;this.buildId=null;this.draft=null;this.base=null;}
 async load(){const response=await this.fetch('/api/v2/catalog');if(!response.ok)throw new Error('Unable to load the Training catalog');this.catalog=await response.json();this.onChange();}
 select(view,monId,buildId){const builds=view.builds.filter(build=>build.monId===monId),saved=builds.find(build=>build.buildId===buildId)||builds[0];this.monId=monId;this.buildId=saved?.buildId||null;this.base=saved?clone(saved):null;this.draft=saved?clone(saved):null;this.onChange();}
 reconcile(view){
  if(!this.monId)this.monId=view.mons[0]?.monId||null;
  const builds=view.builds.filter(build=>build.monId===this.monId),saved=builds.find(build=>build.buildId===this.buildId)||builds.find(build=>this.draft&&this.sameContent(build,this.draft))||builds[0];
  if(!this.draft&&saved){this.buildId=saved.buildId;this.base=clone(saved);this.draft=clone(saved);}
  if(saved&&this.draft&&this.sameContent(saved,this.draft)){this.buildId=saved.buildId;this.base=clone(saved);this.draft=clone(saved);}
 }
 sameContent(a,b){const clean=value=>({monId:value.monId,name:value.name,points:value.points,alignment:value.alignment,abilityId:value.abilityId,moveIds:value.moveIds,itemId:value.itemId});return JSON.stringify(clean(a))===JSON.stringify(clean(b));}
 saveCost(){const cost=Math.max(0,Number(this.catalog?.economy?.build?.saveCostCoins??10));if(!this.base)return cost;const battle=value=>JSON.stringify({points:value.points,alignment:value.alignment,abilityId:value.abilityId,moveIds:value.moveIds,itemId:value.itemId});return battle(this.base)===battle(this.draft)?0:cost;}
 render(state,{art}){
  if(!this.catalog)return '<div class="training-loading">Loading training data…</div>';
  const view=state.trainingV2;this.reconcile(view);const mon=view.mons.find(entry=>entry.monId===this.monId),species=this.catalog.species.find(entry=>entry.id===mon?.speciesId);
  if(!mon||!species)return '<div class="empty">No Pokémon are available for training.</div>';
  const builds=view.builds.filter(build=>build.monId===mon.monId),draft=this.draft,current=statsFor(species,draft),before=statsFor(species,this.base||draft),used=statKeys.reduce((sum,key)=>sum+draft.points[key],0);
  const moveOptions=slot=>species.moveIds.map(id=>{const move=this.catalog.moves.find(entry=>entry.id===id);return `<option value="${id}" ${draft.moveIds[slot]===id?'selected':''}>${escapeHtml(move.name)} · ${move.type} · ${move.maxPP} PP</option>`;}).join('');
  const selectedAbility=this.catalog.abilities.find(ability=>ability.id===draft.abilityId),selectedItem=this.catalog.items.find(item=>item.id===draft.itemId);
  return `<div class="training-layout"><aside class="training-roster panel"><h2>Owned Pokémon</h2>${view.mons.map(entry=>{const data=this.catalog.species.find(item=>item.id===entry.speciesId);return `<button data-training="mon" data-mon-id="${entry.monId}" class="training-mon ${entry.monId===mon.monId?'selected':''}">${art(data.artId)}<span><b>${escapeHtml(data.name)}</b><small>${data.role} · ${data.types.join(' / ')}</small></span></button>`;}).join('')}</aside><section class="training-workspace panel"><div class="training-title">${art(species.artId)}<div><small>BUILD EDITOR · ${species.role}</small><h2>${escapeHtml(species.name)}</h2><div class="training-tabs">${builds.map(build=>`<button data-training="build" data-build-id="${build.buildId}" class="${build.buildId===this.buildId?'selected':''}">${escapeHtml(build.name)}</button>`).join('')}<button data-training="copy" ${builds.length>=3?'disabled':''}>＋ Build</button></div></div></div><label>Build name<input data-training-field="name" maxlength="40" value="${escapeHtml(draft.name)}"></label><div class="point-head"><b>Stat allocation</b><span>Remaining ${66-used}/66 points</span></div><div class="training-stats">${statKeys.map(key=>`<label><span>${labels[key]} <b>${current[key]}</b><small>${current[key]-before[key]>=0?'+':''}${current[key]-before[key]}</small></span><input type="range" min="0" max="32" step="1" value="${draft.points[key]}" data-training-stat="${key}"></label>`).join('')}</div><div class="training-row"><label>Raised stat<select data-training-field="alignment-up"><option value="">Neutral</option>${statKeys.slice(1).map(key=>`<option value="${key}" ${draft.alignment.up===key?'selected':''}>${labels[key]}</option>`).join('')}</select></label><label>Lowered stat<select data-training-field="alignment-down" ${draft.alignment.up?'':'disabled'}><option value="">Select</option>${statKeys.slice(1).filter(key=>key!==draft.alignment.up).map(key=>`<option value="${key}" ${draft.alignment.down===key?'selected':''}>${labels[key]}</option>`).join('')}</select></label><label>Ability<select data-training-field="abilityId">${species.abilityIds.map(id=>{const ability=this.catalog.abilities.find(entry=>entry.id===id);return `<option value="${id}" ${draft.abilityId===id?'selected':''}>${escapeHtml(ability.name)}</option>`;}).join('')}</select><small>${escapeHtml(selectedAbility?.description)}</small></label><label>Held item<select data-training-field="itemId">${this.catalog.items.map(item=>`<option value="${item.id}" ${draft.itemId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select><small>${escapeHtml(selectedItem?.description)}</small></label></div><div class="training-moves">${[0,1,2,3].map(slot=>`<label>Move ${slot+1}<select data-training-move="${slot}">${moveOptions(slot)}</select><small>${escapeHtml(this.catalog.moves.find(move=>move.id===draft.moveIds[slot])?.description)}</small></label>`).join('')}</div><div class="training-actions"><button data-training="reset">Reset draft</button><button class="primary" data-training="save" ${used>66||new Set(draft.moveIds).size!==4||draft.alignment.up&&!draft.alignment.down?'disabled':''}>Save build · ${this.saveCost()} coins</button></div></section></div>`;
 }
 handleClick(element,state){
  const action=element.dataset.training;if(!action)return false;const view=state.trainingV2;
  if(action==='mon')this.select(view,element.dataset.monId);if(action==='build')this.select(view,this.monId,element.dataset.buildId);
  if(action==='copy'){const builds=view.builds.filter(build=>build.monId===this.monId);this.base=null;this.buildId=null;this.draft={...clone(builds[0]),buildId:undefined,name:`Build ${builds.length+1}`,revision:undefined};this.onChange();}
  if(action==='reset'){this.draft=clone(this.base);this.onChange();}
  if(action==='save')this.send({type:'build.save',build:clone(this.draft),expectedRevision:this.base?.revision});
  return true;
 }
 handleInput(target){
  if(!this.draft)return false;
  if(target.dataset.trainingStat){this.draft.points[target.dataset.trainingStat]=Number(target.value);this.onChange();return true;}
  if(target.dataset.trainingMove!==undefined){this.draft.moveIds[Number(target.dataset.trainingMove)]=target.value;this.onChange();return true;}
  const field=target.dataset.trainingField;if(!field)return false;
  if(field==='alignment-up')this.draft.alignment={up:target.value||null,down:null};else if(field==='alignment-down')this.draft.alignment.down=target.value||null;else this.draft[field]=target.value;this.onChange();return true;
 }
}
