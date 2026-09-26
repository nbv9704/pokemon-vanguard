import {sceneTracks,sceneTrackStyle} from '../v3-scene-anchors.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cueStyle=cue=>`--cue-at:${cue.at}ms;--cue-duration:${cue.duration||1}ms`;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const sideCenter=side=>side==='enemy'?{x:70,y:28,side}:{x:30,y:72,side};
const offsetPoint=(point,anchor)=>{
 const out={...point};
 if(anchor?.endsWith('_GROUND'))out.y=clamp(out.y+7,0,100);
 if(anchor?.endsWith('_FRONT'))out.x=clamp(out.x+(out.side==='enemy'?-5:5),0,100);
 if(anchor?.endsWith('_BACK'))out.x=clamp(out.x+(out.side==='enemy'?5:-5),0,100);
 return out;
};
function cueTrack(track,anchor){
 let start={...track.start},end={...track.end};
 if(anchor==='FIELD_CENTER')start=end={x:50,y:50,side:'field'};
 else if(anchor==='USER_SIDE_CENTER')start=end=sideCenter(track.start.side);
 else if(anchor==='TARGET_SIDE_CENTER')start=end=sideCenter(track.end.side);
 else if(anchor==='TARGET_TO_USER'){const original=start;start=end;end=original;}
 else if(anchor?.startsWith('USER_')&&anchor!=='USER_TO_TARGET')start=end=offsetPoint(start,anchor);
 else if(anchor?.startsWith('TARGET_')&&anchor!=='TARGET_TO_USER')start=end=offsetPoint(end,anchor);
 return {start,end};
}

export function actorPresentationClass(plan,{actorId,role,targetIndex}={}){
 const actors=(plan?.cues||[]).filter(entry=>entry.type==='actor');
 const cue=(actorId&&[...actors].reverse().find(entry=>entry.actorId===actorId))||actors.find(entry=>entry.role===role&&(targetIndex===undefined||entry.targetIndex===targetIndex));
 return cue?` presentation-${cue.primitive}`:'';
}

export function cameraPresentationClass(plan){const cues=plan?.cues||[];return `${cues.some(cue=>cue.type==='camera'&&cue.primitive==='camera-shake')?' presentation-camera-shake':''}${cues.some(cue=>cue.type==='screen'&&cue.primitive==='screen-flash')?' presentation-screen-flash':''}`;}

export function renderPresentationEffects(playback,plan,outcomes=[]){
 if(!plan)return '';
 const targetIds=playback.targetIds?.length?playback.targetIds:plan.targetIds,tracks=sceneTracks(playback.snapshot||{},playback.actorId,targetIds),effectCues=plan.cues.filter(cue=>cue.type==='effect'),screenCues=plan.cues.filter(cue=>cue.type==='screen');
 const effects=effectCues.map((cue,index)=>{
  const targetIndex=Math.min(cue.targetIndex||0,Math.max(0,tracks.length-1)),track=tracks[targetIndex]||tracks[0],positioned=cueTrack(track||{start:{x:50,y:50,side:'own'},end:{x:50,y:50,side:'enemy'}},cue.anchor),outcome=outcomes[targetIndex]||outcomes[0]||'pending',variant=cue.meta?.variant||'';
  return `<i class="presentation-cue fx-${esc(cue.primitive)} fx-outcome-${esc(outcome)}${variant?` variant-${esc(variant)}`:''}" data-fx-target="${esc(track?.targetId||'field')}" data-presentation-cue="${esc(cue.id)}" data-presentation-layer="${esc(cue.layer||'FX_FRONT')}" data-presentation-anchor="${esc(cue.anchor||'USER_TO_TARGET')}" data-presentation-primitive="${esc(cue.primitive||'')}" data-presentation-index="${index}"${variant?` data-presentation-variant="${esc(variant)}"`:''} style="${sceneTrackStyle(positioned)};${cueStyle(cue)};--cue-index:${index}"></i>`;
 }).join('');
 const screens=screenCues.map(cue=>`<i class="presentation-screen-cue ${esc(cue.primitive)}${cue.meta?.variant?` variant-${esc(cue.meta.variant)}`:''}" data-presentation-cue="${esc(cue.id)}" style="${cueStyle(cue)}"></i>`).join('');
 return `${effects}${screens}`;
}
