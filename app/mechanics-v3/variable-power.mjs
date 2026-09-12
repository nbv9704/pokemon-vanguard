import {stagedStat} from '../rules-v3/stats.mjs';

const hpRatio48=unit=>Math.max(Math.floor(unit.hp*48/unit.maxHp),1);
const lowHpPower=unit=>{const ratio=hpRatio48(unit);return ratio<2?200:ratio<5?150:ratio<10?100:ratio<17?80:ratio<33?40:20;};
const effectiveSpeed=unit=>{const speed=stagedStat(unit.stats.spe,unit.stages?.spe||0),status=unit.status?.id||unit.status;return status==='paralysis'?Math.max(1,Math.floor(speed/2)):speed;};
const positiveStages=unit=>Object.values(unit.stages||{}).reduce((total,value)=>total+Math.max(0,value||0),0);

export function variableMovePower(formula,{battle,actor,target,basePower,runtime}){
 switch(formula){
 case 'low-user-hp':return lowHpPower(actor);
 case 'user-hp-proportional':return Math.max(1,Math.floor(basePower*actor.hp/actor.maxHp));
 case 'faster-user':{const ratio=Math.floor(effectiveSpeed(actor)/effectiveSpeed(target));return [40,60,80,120,150][Math.min(Math.max(ratio,0),4)];}
 case 'slower-user':return Math.min(150,Math.floor(25*effectiveSpeed(target)/effectiveSpeed(actor))+1);
 case 'positive-stages':return basePower+20*positiveStages(actor);
 case 'fainted-allies':{const roster=battle.sides?.[findSide(battle,actor.actorId)]?.roster||[];return basePower+50*roster.filter(unit=>unit.actorId!==actor.actorId&&unit.hp<=0).length;}
 case 'user-status-non-sleep':{const status=actor.status?.id||actor.status;return status&&status!=='sleep'?basePower*2:basePower;}
 case 'target-status':return target.status?basePower*2:basePower;
 case 'target-poison':{const status=target.status?.id||target.status;return status==='poison'||status==='bad-poison'?basePower*2:basePower;}
 case 'target-hp-proportional':return proportionalTargetPower(target,basePower);
 case 'random-double':if(typeof runtime?.nextRandom!=='function')throw new Error('random-double requires seeded nextRandom');return runtime.nextRandom()<.3?basePower*2:basePower;
 default:throw new Error(`unsupported variable-power formula: ${formula}`);
 }
}

function findSide(battle,actorId){return ['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId));}

function proportionalTargetPower(target,basePower){
 const fixedRatio=Math.floor(target.hp*4096/target.maxHp);
 return Math.floor(Math.floor((basePower*(100*fixedRatio)+2047)/4096)/100)||1;
}
