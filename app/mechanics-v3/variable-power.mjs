import {effectiveBattleSpeed} from './speed.mjs';
import {unitIsGrounded} from './terrain.mjs';
import {heldItemId} from './item-hooks.mjs';
import {allyFaintedPreviousTurn,previousMoveFailed,statsLoweredThisTurn,targetDamagedThisTurn,targetDamagedUserThisTurn} from './turn-history.mjs';
import {effectiveWeightKg} from './foundation-data.mjs';
import {opponentAbilitiesIgnoredFor} from './ability-targeting.mjs';

const hpRatio48=unit=>Math.max(Math.floor(unit.hp*48/unit.maxHp),1);
const lowHpPower=unit=>{const ratio=hpRatio48(unit);return ratio<2?200:ratio<5?150:ratio<10?100:ratio<17?80:ratio<33?40:20;};
const positiveStages=unit=>Object.values(unit.stages||{}).reduce((total,value)=>total+Math.max(0,value||0),0);

export function variableMovePower(formula,{battle,actor,target,basePower,runtime,mechanics=null}){
 switch(formula){
 case 'low-user-hp':return lowHpPower(actor);
 case 'user-hp-proportional':return Math.max(1,Math.floor(basePower*actor.hp/actor.maxHp));
 case 'faster-user':{const ratio=Math.floor(effectiveBattleSpeed(battle,actor)/effectiveBattleSpeed(battle,target));return [40,60,80,120,150][Math.min(Math.max(ratio,0),4)];}
 case 'slower-user':return Math.min(150,Math.floor(25*effectiveBattleSpeed(battle,target)/effectiveBattleSpeed(battle,actor))+1);
 case 'positive-stages':return basePower+20*positiveStages(actor);
 case 'fainted-allies':{const roster=battle.sides?.[findSide(battle,actor.actorId)]?.roster||[];return basePower+50*roster.filter(unit=>unit.actorId!==actor.actorId&&unit.hp<=0).length;}
 case 'user-status-non-sleep':{const status=actor.status?.id||actor.status;return status&&status!=='sleep'?basePower*2:basePower;}
 case 'target-status':return target.status?basePower*2:basePower;
 case 'target-poison':{const status=target.status?.id||target.status;return status==='poison'||status==='bad-poison'?basePower*2:basePower;}
 case 'target-hp-proportional':return proportionalTargetPower(target,basePower);
 case 'random-double':if(typeof runtime?.nextRandom!=='function')throw new Error('random-double requires seeded nextRandom');return runtime.nextRandom()<.3?basePower*2:basePower;
 case 'target-grounded-electric-terrain':return battle.field?.terrain?.id==='electric'&&unitIsGrounded(target,battle)?basePower*2:basePower;
 case 'user-no-held-item':return heldItemId(actor)?basePower:basePower*2;
 case 'target-held-item-boost':return heldItemId(target)?Math.floor(basePower*3/2):basePower;
 case 'user-stockpile':return basePower*(actor.volatiles?.stockpile?.layers||0);
 case 'target-damaged-this-turn':return targetDamagedThisTurn(battle,target.actorId)?basePower*2:basePower;
 case 'target-damaged-user-this-turn':return targetDamagedUserThisTurn(battle,target.actorId,actor.actorId)?basePower*2:basePower;
 case 'target-acted-this-turn':return runtime?.hasActed?.(target.actorId)===true?basePower*2:basePower;
 case 'user-stats-lowered-this-turn':return statsLoweredThisTurn(battle,actor.actorId)?basePower*2:basePower;
 case 'ally-fainted-previous-turn':return allyFaintedPreviousTurn(battle,actor.actorId)?basePower*2:basePower;
 case 'previous-move-failed':return previousMoveFailed(battle,actor.actorId)?basePower*2:basePower;
 case 'target-weight-tier':{const weight=effectiveWeightKg(target,{ignoreAbility:opponentAbilitiesIgnoredFor(battle,actor.actorId,target.actorId,mechanics)});if(!(weight>0))throw new Error('target-weight-tier requires target weight');return weight<10?20:weight<25?40:weight<50?60:weight<100?80:weight<200?100:120;}
 case 'user-target-weight-ratio':{const userWeight=effectiveWeightKg(actor),targetWeight=effectiveWeightKg(target,{ignoreAbility:opponentAbilitiesIgnoredFor(battle,actor.actorId,target.actorId,mechanics)});if(!(userWeight>0&&targetWeight>0))throw new Error('user-target-weight-ratio requires both weights');const ratio=userWeight/targetWeight;return ratio<2?40:ratio<3?60:ratio<4?80:ratio<5?100:120;}
 default:throw new Error(`unsupported variable-power formula: ${formula}`);
 }
}

function findSide(battle,actorId){return ['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId));}

function proportionalTargetPower(target,basePower){
 const fixedRatio=Math.floor(target.hp*4096/target.maxHp);
 return Math.floor(Math.floor((basePower*(100*fixedRatio)+2047)/4096)/100)||1;
}
