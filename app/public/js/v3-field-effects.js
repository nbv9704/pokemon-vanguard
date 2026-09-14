const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeId=value=>String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
const label=value=>String(value||'').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());
function condition(value){if(!value)return null;if(typeof value==='string')return {id:safeId(value)};if(typeof value==='object'&&value.id)return {id:safeId(value.id),remaining:Number.isInteger(value.remaining)?value.remaining:null};return null;}
function entries(value){return Object.entries(value||{}).flatMap(([id,data])=>{if(!data)return[];const remaining=Number.isInteger(data)?data:Number.isInteger(data?.remaining)?data.remaining:null;const layers=Number.isInteger(data?.layers)?data.layers:null;return [{id:safeId(data?.id||id),remaining,layers}];});}

export function v3FieldEffectState(snapshot={}){
 const field=snapshot.field||{},weather=condition(field.weather),terrain=condition(field.terrain),rooms=entries(field.rooms),legacyTrick=Number.isInteger(field.trickRoom)?field.trickRoom:Number.isInteger(field.trickRoom?.remaining)?field.trickRoom.remaining:0;
 if(legacyTrick>0&&!rooms.some(room=>room.id==='trick-room'))rooms.push({id:'trick-room',remaining:legacyTrick,layers:null});
 const trickRoom=rooms.find(room=>room.id==='trick-room')?.remaining||0;
 return {weather,terrain,rooms,trickRoom,own:entries(snapshot.sideConditions?.own),opponent:entries(snapshot.sideConditions?.opponent)};
}
function chip(kind,item,side=''){return `<span class="v3-field-chip ${side}" data-condition-kind="${kind}"><b>${escapeHtml(label(item.id))}</b>${item.remaining===null?'':` · ${item.remaining}T`}${item.layers===null?'':` · ×${item.layers}`}</span>`;}
export function renderV3FieldEffects(snapshot){
 const state=v3FieldEffectState(snapshot),classes=['v3-field-effects'];if(state.weather)classes.push(`weather-${state.weather.id}`);if(state.terrain)classes.push(`terrain-${state.terrain.id}`);for(const room of state.rooms)classes.push(`room-${room.id}`);
 const roomLayers=state.rooms.map(room=>`<i class="field-room room-${room.id}"></i>`).join(''),chips=[state.weather&&chip('weather',state.weather),state.terrain&&chip('terrain',state.terrain),...state.rooms.map(room=>chip('room',room)),...state.own.map(item=>chip('side',item,'own')),...state.opponent.map(item=>chip('side',item,'opponent'))].filter(Boolean).join('');
 return `<div class="${classes.join(' ')}" aria-hidden="true"><i class="field-weather"></i><i class="field-terrain"></i>${roomLayers}</div>${chips?`<div class="v3-field-chips" aria-label="Active battlefield conditions">${chips}</div>`:''}`;
}
