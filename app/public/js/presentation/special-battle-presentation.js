import {assertPresentationDefinition} from './presentation-schema.js';

const SPECIAL_KINDS=new Set(['switchOut','switchIn','fainted','megaEvolved','transformed','transformEnded','illusionStarted','illusionBroken','disguiseBroken','abilityFormChanged','twoTurnMovePrepared','twoTurnMoveReleased','twoTurnMoveAborted']);
const actorCue=(id,at,primitive,actorId,meta={})=>({id,type:'actor',at,duration:Math.min(360,Math.max(160,meta.duration||280)),layer:'ACTOR',anchor:'USER_CENTER',primitive,actorId,meta});
const screenCue=(id,at=20,variant='form')=>({id,type:'screen',at,duration:120,layer:'FX_FRONT',anchor:'FIELD_CENTER',primitive:'screen-flash',meta:{variant}});
const audioCue=(id,at,sound)=>({id,type:'audio',at,duration:0,sound,meta:{semantic:true}});

function eventActor(event){return event.actorId||event.targetId||event.sourceId||null;}
function cueSet(event,index,duration){
 const actorId=eventActor(event),prefix=`special-${index}-${event.kind}`,out=[];
 if(!actorId)return out;
 if(event.kind==='switchOut')return [actorCue(`${prefix}-actor`,10,'actor-vanish',actorId,{variant:'switch-out'}),audioCue(`${prefix}-audio`,20,'special:switch-out')];
 if(event.kind==='switchIn')return [actorCue(`${prefix}-actor`,10,'actor-emerge',actorId,{variant:'switch-in'}),audioCue(`${prefix}-audio`,20,'special:switch-in')];
 if(event.kind==='fainted')return [actorCue(`${prefix}-actor`,10,'actor-faint',actorId,{variant:'faint',duration:360}),audioCue(`${prefix}-audio`,25,'special:faint')];
 if(event.kind==='heroEntry')return [actorCue(`${prefix}-actor`,20,'actor-morph',actorId,{variant:'zero-to-hero'}),screenCue(`${prefix}-flash`,30,'zero-to-hero'),audioCue(`${prefix}-audio`,25,'special:form:zero-to-hero')];
 if(event.kind==='megaEvolved')return [actorCue(`${prefix}-actor`,70,'actor-mega',actorId,{duration:760,variant:'mega'}),screenCue(`${prefix}-flash`,180,'mega'),{id:`${prefix}-camera`,type:'camera',at:180,duration:220,layer:'UI',anchor:'FIELD_CENTER',primitive:'camera-shake'},audioCue(`${prefix}-audio`,110,'special:mega-evolution')];
 if(event.kind==='transformed'||event.kind==='transformEnded')return [actorCue(`${prefix}-actor`,15,'actor-morph',actorId,{variant:'transform'}),screenCue(`${prefix}-flash`,25,'transform'),audioCue(`${prefix}-audio`,20,'special:transform')];
 if(event.kind==='illusionStarted')return [actorCue(`${prefix}-actor`,15,'actor-morph',actorId,{variant:'illusion'}),audioCue(`${prefix}-audio`,20,'special:illusion')];
 if(event.kind==='illusionBroken')return [actorCue(`${prefix}-actor`,10,'actor-shatter',actorId,{variant:'illusion'}),screenCue(`${prefix}-flash`,15,'illusion'),audioCue(`${prefix}-audio`,15,'special:illusion-break')];
 if(event.kind==='disguiseBroken')return [actorCue(`${prefix}-actor`,10,'actor-break',actorId,{variant:'disguise'}),screenCue(`${prefix}-flash`,15,'disguise'),audioCue(`${prefix}-audio`,15,'special:disguise-break')];
 if(event.kind==='abilityFormChanged'){
  if(event.trigger==='disguise-break')return [];
  const variant=event.abilityId||event.trigger||'form';
  return [actorCue(`${prefix}-actor`,10,'actor-morph',actorId,{variant}),screenCue(`${prefix}-flash`,18,variant),audioCue(`${prefix}-audio`,18,`special:form:${variant}`)];
 }
 if(event.kind==='twoTurnMovePrepared'&&event.semiInvulnerable)return [actorCue(`${prefix}-actor`,20,'actor-vanish',actorId,{variant:event.semiInvulnerable}),audioCue(`${prefix}-audio`,30,`special:semi:${event.semiInvulnerable}:enter`)];
 if((event.kind==='twoTurnMoveReleased'||event.kind==='twoTurnMoveAborted')&&event.semiInvulnerable)return [actorCue(`${prefix}-actor`,10,'actor-emerge',actorId,{variant:event.semiInvulnerable}),audioCue(`${prefix}-audio`,20,`special:semi:${event.semiInvulnerable}:exit`)];
 return out;
}

export function specialBattleEvents(frame){const events=(frame?.events||[]).filter(event=>SPECIAL_KINDS.has(event?.kind)),all=[...(frame?.snapshot?.own||[]),...(frame?.snapshot?.opponent||[])];for(const event of frame?.events||[])if(event?.kind==='switchIn'){const unit=all.find(mon=>mon.actorId===event.actorId);if(unit?.speciesId==='palafin-hero')events.push({kind:'heroEntry',actorId:event.actorId});}return events;}
export function mergeSpecialBattlePresentation(base,frame){
 const events=specialBattleEvents(frame);if(!events.length)return base;
 const duration=base?.duration??frame?.duration??500,cues=events.flatMap((event,index)=>cueSet(event,index,duration)).map(cue=>({...cue,at:Math.min(cue.at,duration),duration:Math.min(cue.duration||0,Math.max(0,duration-Math.min(cue.at,duration)))}));
 const definition={id:base?.id?`${base.id}+special`:`special-${frame?.stage||'event'}`,tier:base?.tier||'special-event',template:base?.template||'special-event',stage:base?.stage||frame?.stage||'system',duration,cues:[...(base?.cues||[]),...cues],specialEvents:events.map(event=>event.kind)};
 return assertPresentationDefinition(definition);
}
