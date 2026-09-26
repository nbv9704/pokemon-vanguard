import {moveFxProfile,PROFILE_PRIMITIVES} from '../v3-move-fx-profile.js';
import {assertPresentationDefinition} from './presentation-schema.js';
import {buildMovePresentationDefinition,movePresentationTemplate,presentationMigrationSummary} from './move-presentation-library.js';

const CAST_DURATION=1050,IMPACT_DURATION=420;
const HEAVY_PROFILES=new Set(['beam','rush','impact','field-burst','drain-contact']);
const USER_MOTION={rush:'actor-lunge',slash:'actor-lunge',impact:'actor-lunge','drain-contact':'actor-lunge',projectile:'actor-pulse',beam:'actor-pulse',barrage:'actor-pulse',aura:'actor-pulse',orb:'actor-pulse',drain:'actor-pulse',seed:'actor-pulse',notes:'actor-pulse','field-burst':'actor-pulse',barrier:'actor-pulse'};

function localCue(id,type,at,{duration=0,layer,anchor,primitive,role,targetIndex,sound,commit,meta}={}){return {id,type,at,duration,...(layer?{layer}:{}),...(anchor?{anchor}:{}),...(primitive?{primitive}:{}),...(role?{role}:{}),...(Number.isInteger(targetIndex)?{targetIndex}:{}),...(sound?{sound}:{}),...(commit?{commit}:{}),...(meta?{meta}:{})};}

function legacyCastDefinition(move,profile,targetCount){
 const primitives=PROFILE_PRIMITIVES[profile.id]||['orb','ring','spark'],cues=[];
 cues.push(localCue('user-motion','actor',40,{duration:420,layer:'ACTOR',anchor:'USER_CENTER',primitive:USER_MOTION[profile.id]||'actor-pulse',role:'user'}));
 cues.push(localCue('cast-audio','audio',100,{sound:`move:${move?.type||'normal'}:cast`,meta:{semantic:true}}));
 for(let targetIndex=0;targetIndex<Math.max(1,targetCount);targetIndex++)for(let index=0;index<primitives.length;index++)cues.push(localCue(`cast-${targetIndex}-${index}`,'effect',130+index*70,{duration:760,layer:index===0?'ACTOR_FRONT':'FX_FRONT',anchor:'USER_TO_TARGET',primitive:primitives[index],role:'target',targetIndex}));
 return assertPresentationDefinition({id:`legacy-${profile.id}-cast`,tier:'legacy-adapter',template:'legacy',profile:profile.id,stage:'cast',duration:CAST_DURATION,cues});
}

function legacyImpactDefinition(move,profile,targetCount){
 const primitives=PROFILE_PRIMITIVES[profile.id]||['orb','ring','spark'],cues=[localCue('commit','commit',0,{commit:'authoritative-impact'})];
 cues.push(localCue('impact-audio','audio',35,{sound:`move:${move?.type||'normal'}:impact`,meta:{semantic:true}}));
 if(HEAVY_PROFILES.has(profile.id))cues.push(localCue('camera-impact','camera',20,{duration:150,layer:'UI',anchor:'FIELD_CENTER',primitive:'camera-shake'}));
 if(['beam','field-burst','aura','barrier'].includes(profile.id))cues.push(localCue('screen-accent','screen',15,{duration:120,layer:'FX_FRONT',anchor:'FIELD_CENTER',primitive:'screen-flash'}));
 for(let targetIndex=0;targetIndex<Math.max(1,targetCount);targetIndex++){
  cues.push(localCue(`target-${targetIndex}-shake`,'actor',20,{duration:220,layer:'ACTOR',anchor:'TARGET_CENTER',primitive:'actor-shake',role:'target',targetIndex}));
  for(let index=0;index<primitives.length;index++)cues.push(localCue(`impact-${targetIndex}-${index}`,'effect',15+index*35,{duration:300,layer:'FX_FRONT',anchor:'TARGET_CENTER',primitive:primitives[index],role:'target',targetIndex}));
 }
 return assertPresentationDefinition({id:`legacy-${profile.id}-impact`,tier:'legacy-adapter',template:'legacy',profile:profile.id,stage:'impact',duration:IMPACT_DURATION,cues});
}

export function movePresentationDefinition(move,{stage='cast',targetCount=1}={}){
 const profile=moveFxProfile(move),migrated=buildMovePresentationDefinition(move,profile,{stage,targetCount});
 if(migrated)return migrated;
 return stage==='impact'?legacyImpactDefinition(move,profile,targetCount):legacyCastDefinition(move,profile,targetCount);
}

export function createMovePresentationPlan(playback,catalog){
 if(!playback||!['cast','impact'].includes(playback.stage)||!playback.moveId)return null;
 const move=catalog?.moves?.find(entry=>entry.id===playback.moveId)||{id:playback.moveId,name:playback.moveId,type:'normal',category:'status',actionProfile:{targetMode:'field'}},targetCount=Math.max(1,playback.targetIds?.length||0),definition=movePresentationDefinition(move,{stage:playback.stage,targetCount});
 return {...definition,moveId:move.id,moveName:move.name||move.id,moveType:move.type||'normal',profile:moveFxProfile(move),targetIds:[...(playback.targetIds||[])]};
}

export function presentationCoverage(moves=[]){return moves.map(move=>{const cast=movePresentationDefinition(move,{stage:'cast'}),impact=movePresentationDefinition(move,{stage:'impact'});return {moveId:move.id,tier:cast.tier,template:cast.template||movePresentationTemplate(move,moveFxProfile(move)),profile:cast.profile,castCues:cast.cues.length,impactCues:impact.cues.length,commit:impact.cues.some(cue=>cue.type==='commit')};});}
export function presentationMigrationCoverage(moves=[]){return presentationMigrationSummary(moves,moveFxProfile);}
