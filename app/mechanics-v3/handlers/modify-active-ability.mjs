import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {activeAbilityId,replaceActiveAbility,suppressActiveAbility,swapActiveAbilities} from '../ability-replacement.mjs';
import {resolveAbilityStartEffects} from '../ability-lifecycle.mjs';

const blocked=(id,list=[])=>Boolean(id&&list.includes(id));
const applications=payload=>[
 ...(payload.hitTargetIds||[]).map(targetId=>({sourceId:payload.action.actorId,targetId,reflected:false})),
 ...(payload.reflectedStatusHits||[]).map(hit=>({sourceId:hit.sourceId,targetId:hit.targetId,reflected:true}))
];

function runAbilityStart(battle,actorIds,runtime,moveId){
 let next=battle,events=[];for(const actorId of [...new Set(actorIds)]){const started=resolveAbilityStartEffects(next,{actorId,manifests:runtime?.abilityManifests,trigger:`move:${moveId}:ability-change`,allowEntryTransform:false,resolveFieldTypes:true});next=started.battle;events.push(...started.events);}return {battle:next,events};
}

export const modifyActiveAbilityHandler={
 id:'modify-active-ability',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  let next=clone(battle);const {action,move}=payload,events=[],changed=[];if(!runtime?.abilityManifests)throw new Error('modify-active-ability requires ability manifests');
  for(const application of applications(payload)){
   const source=unitById(next,application.sourceId),target=unitById(next,application.targetId);if(!source||source.hp<=0||!target||target.hp<=0)continue;
   const sourceAbility=activeAbilityId(source),targetAbility=activeAbilityId(target);
   if(blocked(sourceAbility,params.blockedSourceAbilityIds)||blocked(targetAbility,params.blockedTargetAbilityIds)){events.push({kind:'abilityChangeFailed',actorId:source.actorId,targetId:target.actorId,moveId:move.id,reason:'blockedAbility',sourceAbilityId:sourceAbility,targetAbilityId:targetAbility,reflected:application.reflected});continue;}
   if(params.mode==='swap'){
    const result=swapActiveAbilities(next,{leftId:source.actorId,rightId:target.actorId,manifests:runtime.abilityManifests,effect:params,sourceId:source.actorId,reason:`move:${move.id}`});next=result.battle;events.push(...result.events);if(result.swapped)changed.push(source.actorId,target.actorId);
   }else if(params.mode==='suppress'){
    const result=suppressActiveAbility(next,{actorId:target.actorId,sourceId:source.actorId,reason:`move:${move.id}`});next=result.battle;events.push(...result.events);if(result.suppressed)changed.push(target.actorId);
   }else{
    const abilityId=params.mode==='copy-target'?targetAbility:params.mode==='copy-source'?sourceAbility:params.mode==='replace-fixed'?params.abilityId:null;
    if(!abilityId)throw new Error(`unsupported active ability mode: ${params.mode}`);
    const recipientId=params.mode==='copy-target'?source.actorId:target.actorId;
    const result=replaceActiveAbility(next,{actorId:recipientId,abilityId,manifests:runtime.abilityManifests,effect:params,sourceId:source.actorId,reason:`move:${move.id}`});next=result.battle;events.push(...result.events);if(result.replaced){changed.push(recipientId);if((params.cureStatuses||[]).length){const recipient=unitById(next,recipientId),status=recipient?.status?.id||recipient?.status||null;if(status&&(params.cureStatuses||[]).includes(status)){recipient.status=null;events.push({kind:'statusCured',actorId:source.actorId,targetId:recipientId,moveId:move.id,status,source:`move:${move.id}`});}}}
   }
  }
  const startTargets=changed.filter(actorId=>activeAbilityId(unitById(next,actorId))!=='none'),started=runAbilityStart(next,startTargets,runtime,move.id);next=started.battle;events.push(...started.events);
  if(params.requireChange===true&&!changed.length)events.push({kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noAbilityChange'});
  return {battle:next,payload:{...payload,abilityChangedTargetIds:[...new Set(changed)]},events};
 }
};
