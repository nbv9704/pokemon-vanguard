import {unitById} from '../rules-v3/battle-state.mjs';

export function effectiveMoveMechanics(battle,actorId,mechanics){
 if(!mechanics?.targetModeByUserType)return mechanics;
 const unit=unitById(battle,actorId),mapping=mechanics.targetModeByUserType;
 const matched=(unit?.types||[]).map(type=>mapping[type]).find(Boolean),targetMode=matched||mapping.default||mechanics.targetMode;
 return targetMode===mechanics.targetMode?mechanics:{...mechanics,targetMode};
}
