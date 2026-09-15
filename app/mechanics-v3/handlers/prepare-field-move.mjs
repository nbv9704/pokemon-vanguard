import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {effectiveWeatherId} from '../ability-field.mjs';
import {unitIsGrounded} from '../terrain.mjs';

function applyProfile(move,mechanics,profile){
 const nextMove=clone(move),nextMechanics=clone(mechanics),changes={};
 if(profile.type&&profile.type!==nextMove.type){changes.fromType=nextMove.type;changes.toType=profile.type;nextMove.type=profile.type;}
 if(Number.isFinite(profile.powerMultiplier)&&profile.powerMultiplier>0&&Number.isFinite(nextMove.power)){const before=nextMove.power,after=Math.max(1,Math.floor(before*profile.powerMultiplier));if(after!==before){nextMove.power=after;changes.fromPower=before;changes.toPower=after;}}
 if(profile.targetMode&&profile.targetMode!==nextMechanics.targetMode){changes.fromTargetMode=nextMechanics.targetMode;changes.toTargetMode=profile.targetMode;nextMechanics.targetMode=profile.targetMode;}
 return {move:nextMove,mechanics:nextMechanics,changes};
}

export const prepareFieldMoveHandler={
 id:'prepare-field-move',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  const weather=effectiveWeatherId(next),terrain=next.field?.terrain?.id||null,grounded=unitIsGrounded(actor,next);let profile=null,sourceKind=null,sourceId=null;
  if(weather&&params.weather?.[weather]){profile=params.weather[weather];sourceKind='weather';sourceId=weather;}
  if(terrain&&params.terrain?.[terrain]&&(!params.requireGrounded||grounded)){profile=params.terrain[terrain];sourceKind='terrain';sourceId=terrain;}
  if(!profile)return {battle:next,payload,events:[]};
  const prepared=applyProfile(payload.move,payload.mechanics,profile),changed=Object.keys(prepared.changes).length>0;
  return {battle:next,payload:{...payload,move:prepared.move,mechanics:prepared.mechanics},events:changed?[{kind:'moveFieldModified',actorId:actor.actorId,moveId:payload.move.id,sourceKind,sourceId,...prepared.changes}]:[]};
 }
};
