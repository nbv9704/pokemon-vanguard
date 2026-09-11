import {V2_calculateDamage,V2_damageModifiers,V2_effectiveStat} from '../src/v2-engine.mjs';
import {battleMon} from './v2-battle-factory.mjs';
import {validateBuildInput} from './v2-progression.mjs';

const fieldIds={weather:new Set(['sun','rain','snow','sand']),terrain:new Set(['meadow','storm'])};
const emptySide=()=>({tailwind:0,barrier:0});

function combatStats(mon,battle,side){
 const copy=structuredClone(mon);
 for(const stat of ['atk','def','spa','spd']){copy.stats[stat]=V2_effectiveStat(mon,stat,battle,side);copy.stages[stat]=0;}
 return copy;
}

function inspectMon(input,side,catalog){
 const species=catalog.speciesById[input?.speciesId],build=input?.build;
 if(!species||!build)return null;
 const monRecord={monId:`sandbox-${side}`,speciesId:species.id,ownership:'permanent'};
 if(validateBuildInput(build,monRecord,catalog).length)return null;
 return battleMon(side,0,build,species,catalog);
}

export function inspectV2Damage(input,catalog){
 if(!input||input.context!=='sandbox')return {ok:false,code:'SANDBOX_ONLY'};
 const attacker=inspectMon(input.attacker,'A',catalog),defender=inspectMon(input.defender,'B',catalog),move=catalog.movesById[input.moveId];
 if(!attacker||!defender||!move||move.category==='status'||move.power<=0||!attacker.buildSnapshot.moveIds.includes(move.id))return {ok:false,code:'INVALID_DAMAGE_SCENARIO'};
 const weather=fieldIds.weather.has(input.weather)?{id:input.weather,remaining:5}:null,terrain=fieldIds.terrain.has(input.terrain)?{id:input.terrain,remaining:5}:null;
 const battle={activeCount:input.spread?2:1,field:{weather,terrain,sides:{A:emptySide(),B:emptySide()}},sides:{A:{roster:[attacker],active:[attacker.battleMonId]},B:{roster:[defender],active:[defender.battleMonId]}}};
 const modifiers=V2_damageModifiers({attacker,defender,battle,attackerSide:'A',defenderSide:'B',move,allies:[attacker]}),spread=input.spread?.75:1;
 const result=V2_calculateDamage({move,attacker:combatStats(attacker,battle,'A'),defender:combatStats(defender,battle,'B'),field:battle.field,outgoing:modifiers.outgoing,incoming:modifiers.incoming,spread});
 return {ok:true,breakdown:{moveId:move.id,moveName:move.name,category:move.category,power:move.power,attack:result.attack,defense:result.defense,base:result.base,stab:result.stab,type:result.type,fieldModifier:result.fieldModifier??1,outgoing:modifiers.outgoing,incoming:modifiers.incoming,spread,burn:result.burn??1,accuracy:modifiers.accuracy,damage:result.damage,targetHp:defender.stats.hp,percent:Number((result.damage/defender.stats.hp*100).toFixed(1))}};
}
