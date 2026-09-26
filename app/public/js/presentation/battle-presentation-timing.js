export const LEGACY_CAST_DURATION=1050;
export const LEGACY_IMPACT_DURATION=420;

export const BATTLE_PRESENTATION_TIMING=Object.freeze({
 cast:1450,
 impact:720,
 mega:1320,
 switch:760,
 cancelled:620,
 recharge:700,
 endTurn:760,
 system:620
});

export function presentationDuration(stage,{reduced=false}={}){
 if(reduced)return 0;
 return BATTLE_PRESENTATION_TIMING[stage]??BATTLE_PRESENTATION_TIMING.system;
}

export function retimePresentationCues(cues=[],stage){
 const source=stage==='impact'?LEGACY_IMPACT_DURATION:LEGACY_CAST_DURATION;
 const target=stage==='impact'?BATTLE_PRESENTATION_TIMING.impact:BATTLE_PRESENTATION_TIMING.cast;
 const scale=target/source;
 return cues.map(cue=>{
  const at=Math.round((Number(cue.at)||0)*scale);let duration=Math.round((Number(cue.duration)||0)*scale);
  if(stage==='cast'&&cue.type==='effect'&&cue.anchor==='USER_TO_TARGET'&&!String(cue.id||'').startsWith('drain-out'))duration=Math.max(duration,Math.max(0,target-at-90));
  return {...cue,at,duration};
 });
}
