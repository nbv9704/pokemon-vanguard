import {assertPresentationDefinition} from './presentation-schema.js';
import {SIGNATURE_MOVE_IDS,signatureMoveSpec} from './signature-move-specs.js';

export {SIGNATURE_MOVE_IDS} from './signature-move-specs.js';
export const WEATHER_MOVE_IDS=['chilly-reception','rain-dance','sandstorm','snowscape','sunny-day'];
export const HAZARD_MOVE_IDS=['spikes','stealth-rock','sticky-web','toxic-spikes'];
export const MULTI_HIT_MOVE_IDS=['bone-rush','bullet-seed','double-hit','dual-wingbeat','icicle-spear','pin-missile','rock-blast','scale-shot','tail-slap','twin-beam','water-shuriken','triple-axel','population-bomb','dragon-darts','beat-up'];

const signatures=new Set(SIGNATURE_MOVE_IDS),weather=new Set(WEATHER_MOVE_IDS),hazards=new Set(HAZARD_MOVE_IDS),multiHit=new Set(MULTI_HIT_MOVE_IDS);
const PROFILE_TO_TEMPLATE={
 projectile:'projectile',beam:'beam',slash:'slash',rush:'rush',barrage:'multi-hit',impact:'impact',aura:'aura',barrier:'barrier',drain:'drain','drain-contact':'drain',seed:'projectile',notes:'aura',orb:'projectile','field-burst':'field-wave'
};
const TARGETED_TEMPLATES=new Set(['projectile','beam','slash','rush','multi-hit','impact','drain']);

const cue=(id,type,at,{duration=0,layer,anchor,primitive,role,targetIndex,sound,commit,meta}={})=>({id,type,at,duration,...(layer?{layer}:{}),...(anchor?{anchor}:{}),...(primitive?{primitive}:{}),...(role?{role}:{}),...(Number.isInteger(targetIndex)?{targetIndex}:{}),...(sound?{sound}:{}),...(commit?{commit}:{}),...(meta?{meta}:{})});
const targetLoop=(targetCount,fn)=>{const out=[];for(let i=0;i<Math.max(1,targetCount);i++)out.push(...fn(i));return out;};

export function movePresentationTemplate(move,profile){
 if(signatures.has(move?.id))return `signature:${move.id}`;
 if(weather.has(move?.id))return 'weather';
 if(hazards.has(move?.id))return 'hazard';
 if(multiHit.has(move?.id))return 'multi-hit';
 return PROFILE_TO_TEMPLATE[profile?.id]||'legacy';
}

function definition({move,profile,stage,targetCount,template,tier,cues,duration}){
 return assertPresentationDefinition({id:`${tier==='signature-timeline'?'signature':'template'}-${template.replace(':','-')}-${stage}`,tier,template,profile:profile.id,stage,duration,cues,moveId:move.id});
}

function commonAudio(move,stage,at=stage==='cast'?80:30){return cue(`${stage}-audio`,'audio',at,{sound:`move:${move?.type||'normal'}:${stage}`,meta:{semantic:true}});}
function actorStart(template){return ['slash','rush','impact','drain','multi-hit'].includes(template)?'actor-lunge':'actor-pulse';}

function templateCast(move,profile,targetCount,template){
 const cues=[cue('user-motion','actor',20,{duration:360,layer:'ACTOR',anchor:'USER_CENTER',primitive:actorStart(template),role:'user'}),commonAudio(move,'cast')];
 if(template==='weather'){
  cues.push(cue('weather-field','effect',100,{duration:760,layer:'FIELD_BACK',anchor:'FIELD_CENTER',primitive:'weather-particle',meta:{variant:move.id}}));
  cues.push(cue('weather-wave','effect',180,{duration:620,layer:'ACTOR_BACK',anchor:'FIELD_CENTER',primitive:'wave',meta:{variant:move.id}}));
  cues.push(cue('weather-accent','screen',210,{duration:260,layer:'FX_FRONT',anchor:'FIELD_CENTER',primitive:'screen-flash',meta:{variant:move.id}}));
 }else if(template==='hazard'){
  cues.push(cue('hazard-wave','effect',100,{duration:580,layer:'FIELD_BACK',anchor:'TARGET_SIDE_CENTER',primitive:'wave',meta:{variant:move.id}}));
  cues.push(...[0,1,2].map(index=>cue(`hazard-${index}`,'effect',180+index*95,{duration:520,layer:'FIELD_BACK',anchor:'TARGET_SIDE_CENTER',primitive:'hazard',meta:{variant:move.id,index}})));
 }else if(template==='field-wave'){
  cues.push(cue('field-wave','effect',120,{duration:700,layer:'FIELD_BACK',anchor:'FIELD_CENTER',primitive:'wave'}));
  cues.push(cue('field-burst','effect',260,{duration:520,layer:'ACTOR_FRONT',anchor:'FIELD_CENTER',primitive:'burst'}));
 }else if(template==='barrier'){
  cues.push(cue('barrier','effect',130,{duration:760,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive:'shield'}));
  cues.push(cue('barrier-ring','effect',210,{duration:600,layer:'FX_FRONT',anchor:'USER_CENTER',primitive:'ring'}));
 }else if(template==='aura'){
  const targetAnchor=['self','userSide','field'].includes(move?.actionProfile?.targetMode)?'USER_CENTER':'TARGET_CENTER';
  cues.push(cue('aura-ring','effect',120,{duration:720,layer:'ACTOR_FRONT',anchor:targetAnchor,primitive:'ring'}));
  cues.push(cue('aura-spark','effect',260,{duration:520,layer:'FX_FRONT',anchor:targetAnchor,primitive:'spark'}));
 }else if(template==='beam'){
  cues.push(cue('beam-charge','effect',80,{duration:420,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive:'ring'}));
  cues.push(...targetLoop(targetCount,i=>[cue(`beam-${i}`,'effect',240,{duration:650,layer:'FX_FRONT',anchor:'USER_TO_TARGET',primitive:'beam',role:'target',targetIndex:i})]));
 }else if(template==='multi-hit'){
  cues.push(...targetLoop(targetCount,i=>[0,1,2].map(hit=>cue(`multi-${i}-${hit}`,'effect',170+hit*150,{duration:430,layer:'FX_FRONT',anchor:'USER_TO_TARGET',primitive:'pellet',role:'target',targetIndex:i,meta:{hit:hit+1}}))));
 }else if(template==='drain'){
  cues.push(...targetLoop(targetCount,i=>[
   cue(`drain-out-${i}`,'effect',150,{duration:540,layer:'FX_FRONT',anchor:'USER_TO_TARGET',primitive:profile.id==='drain-contact'?'rush':'orb',role:'target',targetIndex:i}),
   cue(`drain-back-${i}`,'effect',470,{duration:430,layer:'ACTOR_FRONT',anchor:'TARGET_TO_USER',primitive:'orb',role:'target',targetIndex:i,meta:{variant:'return'}})
  ]));
 }else{
  const primitive={projectile:'orb',slash:'slash',rush:'rush',impact:'ring'}[template]||'orb';
  cues.push(...targetLoop(targetCount,i=>[
   cue(`${template}-${i}`,'effect',150,{duration:680,layer:'FX_FRONT',anchor:'USER_TO_TARGET',primitive,role:'target',targetIndex:i}),
   cue(`${template}-trail-${i}`,'effect',230,{duration:520,layer:'ACTOR_FRONT',anchor:'USER_TO_TARGET',primitive:template==='slash'?'slash':'trail',role:'target',targetIndex:i})
  ]));
 }
 return definition({move,profile,stage:'cast',targetCount,template,tier:'parameterized-template',cues,duration:1050});
}

function templateImpact(move,profile,targetCount,template){
 const cues=[cue('commit','commit',0,{commit:'authoritative-impact'}),commonAudio(move,'impact')];
 if(['beam','rush','impact','drain','field-wave','multi-hit'].includes(template))cues.push(cue('camera-impact','camera',20,{duration:150,layer:'UI',anchor:'FIELD_CENTER',primitive:'camera-shake'}));
 if(['beam','field-wave','weather','barrier'].includes(template))cues.push(cue('screen-accent','screen',15,{duration:120,layer:'FX_FRONT',anchor:'FIELD_CENTER',primitive:'screen-flash'}));
 if(template==='weather')cues.push(cue('weather-settle','effect',40,{duration:330,layer:'FIELD_BACK',anchor:'FIELD_CENTER',primitive:'weather-particle',meta:{variant:move.id}}));
 else if(template==='hazard')cues.push(cue('hazard-settle','effect',35,{duration:340,layer:'FIELD_BACK',anchor:'TARGET_SIDE_CENTER',primitive:'hazard',meta:{variant:move.id}}));
 else if(template==='barrier')cues.push(cue('barrier-impact','effect',20,{duration:340,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive:'shield'}));
 else if(template==='field-wave'){
  cues.push(cue('field-impact','effect',25,{duration:350,layer:'ACTOR_FRONT',anchor:'FIELD_CENTER',primitive:'burst'}));
  cues.push(...targetLoop(targetCount,i=>[cue(`field-target-${i}`,'effect',45,{duration:300,layer:'FX_FRONT',anchor:'TARGET_CENTER',primitive:'ring',role:'target',targetIndex:i})]));
 }else cues.push(...targetLoop(targetCount,i=>[
   cue(`target-${i}-shake`,'actor',20,{duration:210,layer:'ACTOR',anchor:'TARGET_CENTER',primitive:'actor-shake',role:'target',targetIndex:i}),
   cue(`impact-${i}`,'effect',20,{duration:330,layer:'FX_FRONT',anchor:'TARGET_CENTER',primitive:template==='drain'?'ring':template==='multi-hit'?'burst':'burst',role:'target',targetIndex:i})
  ]));
 return definition({move,profile,stage:'impact',targetCount,template,tier:'parameterized-template',cues,duration:420});
}

function signatureAudio(move,stage,at=stage==='cast'?70:25){return cue(`${stage}-signature-audio`,'audio',at,{sound:`move-signature:${move.id}:${move?.type||'normal'}:${stage}`,meta:{semantic:true,signature:true}});}
function signatureEffect(id,primitive,at,{duration=560,anchor='USER_TO_TARGET',layer='FX_FRONT',role='target',targetIndex,variant}={}){return cue(id,'effect',at,{duration,layer,anchor,primitive,role,...(Number.isInteger(targetIndex)?{targetIndex}:{}),meta:{variant:variant||id.split('-')[0]}});}
function signatureTargetLoop(targetCount,fn){return targetLoop(targetCount,(index)=>fn(index));}

function signatureCast(move,targetCount,spec){
 const id=move.id,family=spec.family,c=[
  cue('user-motion','actor',20,{duration:380,layer:'ACTOR',anchor:'USER_CENTER',primitive:spec.userMotion||(['rush','slash','combo'].includes(family)?'actor-lunge':'actor-pulse'),role:'user'}),
  signatureAudio(move,'cast',70)
 ];
 const charge=(primitive=spec.chargePrimitive,variant=spec.chargeVariant||id)=>{if(primitive)c.push(cue('signature-charge','effect',70,{duration:380,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive,meta:{variant}}));};
 if(family==='projectile'){
  charge();c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-projectile-${i}`,spec.castPrimitive,250,{duration:620,targetIndex:i,variant:id})]));
 }else if(family==='stream'){
  c.push(...signatureTargetLoop(targetCount,i=>[
   signatureEffect(`signature-stream-${i}`,spec.castPrimitive,170,{duration:760,targetIndex:i,variant:id}),
   signatureEffect(`signature-stream-trail-${i}`,spec.trailPrimitive||'trail',260,{duration:600,layer:'ACTOR_FRONT',targetIndex:i,variant:id})
  ]));
 }else if(family==='beam'){
  charge();c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-beam-${i}`,spec.castPrimitive,280,{duration:640,targetIndex:i,variant:id})]));
 }else if(family==='field-wave'){
  c.push(cue('signature-field-rise','effect',100,{duration:820,layer:'FIELD_BACK',anchor:'USER_SIDE_CENTER',primitive:spec.castPrimitive,meta:{variant:id}}),cue('signature-field-cross','effect',260,{duration:680,layer:'ACTOR_FRONT',anchor:'FIELD_CENTER',primitive:spec.castPrimitive,meta:{variant:id}}));
 }else if(family==='barrier'){
  c.push(cue('signature-barrier','effect',100,{duration:850,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive:spec.castPrimitive,meta:{variant:id}}),cue('signature-barrier-ring','effect',210,{duration:620,layer:'FX_FRONT',anchor:'USER_CENTER',primitive:'ring',meta:{variant:id}}));
 }else if(family==='quake'){
  c.push(cue('signature-quake-field','effect',120,{duration:820,layer:'FIELD_BACK',anchor:'FIELD_CENTER',primitive:spec.castPrimitive,meta:{variant:id}}),cue('signature-quake-camera','camera',180,{duration:620,layer:'UI',anchor:'FIELD_CENTER',primitive:'camera-shake'}));
 }else if(family==='combo'){
  c.push(...signatureTargetLoop(targetCount,i=>[0,1,2].map(hit=>signatureEffect(`signature-combo-${i}-${hit}`,spec.castPrimitive,170+hit*170,{duration:310,anchor:'TARGET_CENTER',targetIndex:i,variant:id}))));
 }else if(family==='pulse'){
  c.push(cue('signature-pulse-charge','effect',90,{duration:330,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive:spec.castPrimitive,meta:{variant:id}}));
  c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-pulse-${i}`,spec.castPrimitive,250,{duration:620,targetIndex:i,variant:id})]));
 }else if(family==='slash'){
  c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-slash-${i}`,spec.castPrimitive,180,{duration:650,targetIndex:i,variant:id})]));
 }else if(family==='target-rise'){
  c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-rise-${i}`,spec.castPrimitive,220,{duration:650,anchor:'TARGET_GROUND',targetIndex:i,variant:id})]));
 }else if(family==='target-strike'){
  c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-strike-${i}`,spec.castPrimitive,180,{duration:700,anchor:'TARGET_CENTER',targetIndex:i,variant:id})]));
 }else if(family==='rush'){
  c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-rush-${i}`,spec.castPrimitive,150,{duration:680,targetIndex:i,variant:id})]));
 }else if(family==='field-storm'){
  c.push(cue('signature-storm-field','effect',100,{duration:850,layer:'FIELD_BACK',anchor:'FIELD_CENTER',primitive:spec.castPrimitive,meta:{variant:id}}));
  c.push(...signatureTargetLoop(targetCount,i=>[signatureEffect(`signature-storm-${i}`,spec.castPrimitive,300,{duration:560,anchor:'TARGET_CENTER',targetIndex:i,variant:id})]));
 }else if(family==='barrage'){
  c.push(...signatureTargetLoop(targetCount,i=>[0,1,2].map(hit=>signatureEffect(`signature-barrage-${i}-${hit}`,spec.castPrimitive,180+hit*160,{duration:360,anchor:'TARGET_CENTER',targetIndex:i,variant:id}))));
 }
 if(spec.flash)c.push(cue('signature-cast-flash','screen',300,{duration:180,layer:'FX_FRONT',anchor:'FIELD_CENTER',primitive:'screen-flash',meta:{variant:id}}));
 return {duration:1050,cues:c};
}

function signatureImpact(move,targetCount,spec){
 const id=move.id,c=[cue('commit','commit',0,{commit:'authoritative-impact'}),signatureAudio(move,'impact',25)];
 if(spec.camera&&spec.camera!=='none')c.push(cue('signature-camera','camera',15,{duration:spec.camera==='quake'?300:spec.camera==='heavy'?190:130,layer:'UI',anchor:'FIELD_CENTER',primitive:'camera-shake'}));
 if(spec.flash)c.push(cue('signature-flash','screen',12,{duration:140,layer:'FX_FRONT',anchor:'FIELD_CENTER',primitive:'screen-flash',meta:{variant:id}}));
 if(spec.family==='barrier')c.push(cue('signature-barrier-hold','effect',15,{duration:360,layer:'ACTOR_FRONT',anchor:'USER_CENTER',primitive:spec.impactPrimitive,meta:{variant:id}}));
 else if(spec.family==='quake')c.push(cue('signature-quake-impact','effect',20,{duration:380,layer:'FIELD_BACK',anchor:'FIELD_CENTER',primitive:spec.impactPrimitive,meta:{variant:id}}),...signatureTargetLoop(targetCount,i=>[cue(`signature-quake-shake-${i}`,'actor',20,{duration:250,layer:'ACTOR',anchor:'TARGET_CENTER',primitive:'actor-shake',role:'target',targetIndex:i})]));
 else c.push(...signatureTargetLoop(targetCount,i=>[
  ...(spec.targetReaction===false?[]:[cue(`signature-shake-${i}`,'actor',20,{duration:220,layer:'ACTOR',anchor:'TARGET_CENTER',primitive:'actor-shake',role:'target',targetIndex:i})]),
  signatureEffect(`signature-impact-${i}`,spec.impactPrimitive,20,{duration:340,anchor:'TARGET_CENTER',targetIndex:i,variant:id})
 ]));
 return {duration:420,cues:c};
}

function signatureCues(move,stage,targetCount){
 const spec=signatureMoveSpec(move.id);if(!spec)throw new Error(`Missing signature presentation spec: ${move.id}`);
 return stage==='cast'?signatureCast(move,targetCount,spec):signatureImpact(move,targetCount,spec);
}

function signatureDefinition(move,profile,stage,targetCount){const spec=signatureCues(move,stage,targetCount);return definition({move,profile,stage,targetCount,template:`signature:${move.id}`,tier:'signature-timeline',cues:spec.cues,duration:spec.duration});}

export function buildMovePresentationDefinition(move,profile,{stage='cast',targetCount=1}={}){
 const template=movePresentationTemplate(move,profile);
 if(template.startsWith('signature:'))return signatureDefinition(move,profile,stage,targetCount);
 if(template==='legacy')return null;
 return stage==='impact'?templateImpact(move,profile,targetCount,template):templateCast(move,profile,targetCount,template);
}

export function presentationMigrationSummary(moves=[],profileOf){
 const rows=moves.map(move=>{const profile=profileOf(move),template=movePresentationTemplate(move,profile);return {moveId:move.id,template,tier:template.startsWith('signature:')?'signature-timeline':template==='legacy'?'legacy-adapter':'parameterized-template'};});
 return {rows,signature:rows.filter(x=>x.tier==='signature-timeline').length,template:rows.filter(x=>x.tier==='parameterized-template').length,legacy:rows.filter(x=>x.tier==='legacy-adapter').length};
}
