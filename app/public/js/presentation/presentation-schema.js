export const PRESENTATION_LAYERS=['BACKGROUND','FIELD_BACK','ACTOR_BACK','ACTOR','ACTOR_FRONT','FX_FRONT','UI'];
export const PRESENTATION_ANCHORS=['USER_CENTER','USER_GROUND','USER_FRONT','USER_BACK','TARGET_CENTER','TARGET_GROUND','TARGET_FRONT','TARGET_BACK','FIELD_CENTER','USER_SIDE_CENTER','TARGET_SIDE_CENTER','USER_TO_TARGET','TARGET_TO_USER'];
export const PRESENTATION_CUE_TYPES=['effect','actor','camera','screen','audio','commit'];
export const PRESENTATION_PRIMITIVES=['orb','trail','beam','slash','rush','pellet','ring','burst','spark','shield','note','seed','vine','wave','electric-bolt','flame-stream','water-wave','solar-flare','hyper-beam-core','quake-ring','shadow-orb','combat-hit','dragon-wave','hazard','weather-particle','actor-lunge','actor-pulse','actor-shake','actor-morph','actor-shatter','actor-break','actor-vanish','actor-emerge','actor-faint','actor-mega','screen-flash','camera-shake','ice-crystal','ice-beam','ice-burst','psychic-wave','moon-orb','moon-burst','sludge-orb','sludge-splash','steel-charge','flash-cannon','steel-burst','air-blade','stone-spike','sonic-ring','dark-ring','aura-sphere','aura-burst','hydro-jet','water-charge','water-burst','fire-star','thunder-strike','leaf-slash','iron-impact','speed-streak','blizzard-flurry','focus-orb','focus-burst','gem-burst','ghost-flame'];

const fail=(message)=>({ok:false,error:message});
export function validatePresentationDefinition(definition){
 if(!definition||typeof definition!=='object')return fail('definition must be an object');
 if(!definition.id||typeof definition.id!=='string')return fail('definition.id is required');
 if(!Number.isFinite(definition.duration)||definition.duration<0)return fail('definition.duration must be a non-negative number');
 if(!Array.isArray(definition.cues))return fail('definition.cues must be an array');
 const ids=new Set();let commits=0;
 for(const cue of definition.cues){
  if(!cue?.id||typeof cue.id!=='string')return fail('every cue needs an id');
  if(ids.has(cue.id))return fail(`duplicate cue id: ${cue.id}`);ids.add(cue.id);
  if(!PRESENTATION_CUE_TYPES.includes(cue.type))return fail(`unsupported cue type: ${cue.type}`);
  if(!Number.isFinite(cue.at)||cue.at<0||cue.at>definition.duration)return fail(`cue ${cue.id} has invalid at`);
  if(cue.duration!==undefined&&(!Number.isFinite(cue.duration)||cue.duration<0))return fail(`cue ${cue.id} has invalid duration`);
  if(Number.isFinite(cue.duration)&&cue.at+cue.duration>definition.duration)return fail(`cue ${cue.id} exceeds definition duration`);
  if(cue.layer!==undefined&&!PRESENTATION_LAYERS.includes(cue.layer))return fail(`cue ${cue.id} has invalid layer`);
  if(cue.anchor!==undefined&&!PRESENTATION_ANCHORS.includes(cue.anchor))return fail(`cue ${cue.id} has invalid anchor`);
  if(cue.primitive!==undefined&&!PRESENTATION_PRIMITIVES.includes(cue.primitive))return fail(`cue ${cue.id} has invalid primitive`);
  if(cue.type==='commit')commits++;
 }
 if(commits>1)return fail('a presentation definition may contain at most one commit cue');
 return {ok:true};
}

export function assertPresentationDefinition(definition){const result=validatePresentationDefinition(definition);if(!result.ok)throw new Error(`Invalid presentation definition ${definition?.id||'<unknown>'}: ${result.error}`);return definition;}
