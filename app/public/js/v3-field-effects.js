const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeId=value=>String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
const label=value=>String(value||'').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());
function condition(value){if(!value)return null;if(typeof value==='string')return {id:safeId(value)};if(typeof value==='object'&&value.id)return {id:safeId(value.id),remaining:Number.isInteger(value.remaining)?value.remaining:null};return null;}
function entries(value){return Object.entries(value||{}).flatMap(([id,data])=>{if(!data)return[];const remaining=Number.isInteger(data)?data:Number.isInteger(data?.remaining)?data.remaining:null;return [{id:safeId(data?.id||id),remaining}];});}

export function v3FieldEffectState(snapshot={}){
 const field=snapshot.field||{},weather=condition(field.weather),terrain=condition(field.terrain),trickRoom=Number.isInteger(field.trickRoom)?field.trickRoom:Number.isInteger(field.trickRoom?.remaining)?field.trickRoom.remaining:0;
 return {weather,terrain,trickRoom,own:entries(snapshot.sideConditions?.own),opponent:entries(snapshot.sideConditions?.opponent)};
}
function chip(kind,item,side=''){return `<span class="v3-field-chip ${side}" data-condition-kind="${kind}"><b>${escapeHtml(label(item.id))}</b>${item.remaining===null?'':` · ${item.remaining}T`}</span>`;}
export function renderV3FieldEffects(snapshot){
 const state=v3FieldEffectState(snapshot),classes=['v3-field-effects'];if(state.weather)classes.push(`weather-${state.weather.id}`);if(state.terrain)classes.push(`terrain-${state.terrain.id}`);if(state.trickRoom>0)classes.push('trick-room');
 const chips=[state.weather&&chip('weather',state.weather),state.terrain&&chip('terrain',state.terrain),state.trickRoom>0&&chip('room',{id:'trick-room',remaining:state.trickRoom}),...state.own.map(item=>chip('side',item,'own')),...state.opponent.map(item=>chip('side',item,'opponent'))].filter(Boolean).join('');
 return `<div class="${classes.join(' ')}" aria-hidden="true"><i class="field-weather"></i><i class="field-terrain"></i><i class="field-room"></i></div>${chips?`<div class="v3-field-chips" aria-label="Active battlefield conditions">${chips}</div>`:''}`;
}
