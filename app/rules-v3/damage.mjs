import {CANONICAL_TYPES,typeEffectiveness} from './type-chart.mjs';

const pokeRound=value=>value%1>.5?Math.ceil(value):Math.floor(value);
export function baseDamage({level=50,power,attack,defense}){
 if(!Number.isInteger(level)||level<1||!Number.isInteger(power)||power<1||!Number.isInteger(attack)||attack<1||!Number.isInteger(defense)||defense<1)throw new Error('level, power, attack and defense must be positive integers');
 return Math.floor(Math.floor(Math.floor(2*level/5+2)*power*attack/defense)/50)+2;
}

export function calculateDamage({level=50,power,attack,defense,moveType,attackerTypes,defenderTypes,randomRoll=100,spread=false,weatherModifier=1,critical=false,burned=false,physical=true,otherModifiers=[]}){
 if(!Number.isInteger(randomRoll)||randomRoll<85||randomRoll>100)throw new Error('randomRoll must be an integer from 85 to 100');
 if(!Array.isArray(attackerTypes)||attackerTypes.length<1||attackerTypes.length>2||new Set(attackerTypes).size!==attackerTypes.length||attackerTypes.some(type=>!CANONICAL_TYPES.includes(type)))throw new Error('attacker must have one or two distinct canonical types');
 const base=baseDamage({level,power,attack,defense}),type=typeEffectiveness(moveType,defenderTypes),stab=attackerTypes.includes(moveType)?1.5:1;
 const spreadModifier=spread?.75:1,criticalModifier=critical?1.5:1,burn=burned&&physical?.5:1;
 const modifiers=[weatherModifier,...otherModifiers];
 if(modifiers.some(modifier=>typeof modifier!=='number'||modifier<=0))throw new Error('damage modifiers must be positive numbers');
 const breakdown={base,randomRoll,spread:spreadModifier,weather:weatherModifier,critical:criticalModifier,stab,type,burn,otherModifiers:[...otherModifiers]};
 if(type===0)return {damage:0,...breakdown};
 let damage=base;
 if(spread)damage=pokeRound(damage*spreadModifier);
 if(weatherModifier!==1)damage=pokeRound(damage*weatherModifier);
 if(critical)damage=Math.floor(damage*criticalModifier);
 damage=Math.floor(damage*randomRoll/100);
 if(stab!==1)damage=pokeRound(damage*stab);
 if(type!==1)damage=Math.floor(damage*type);
 if(burn!==1)damage=Math.floor(damage*burn);
 for(const modifier of otherModifiers)damage=pokeRound(damage*modifier);
 return {damage:Math.max(1,damage),...breakdown};
}

export function damageRange(input){return Array.from({length:16},(_,index)=>calculateDamage({...input,randomRoll:85+index}).damage);}
