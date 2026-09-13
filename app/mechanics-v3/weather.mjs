import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {WEATHER_IDS} from './manifest-contract.mjs';

export {WEATHER_IDS};

const effectFor=(unit,kind,weather)=>(unit?.passiveEffects||[]).find(effect=>effect.kind===kind&&effect.weather===weather);
const maxHp=unit=>unit.maxHp??unit.stats?.hp;

export function weatherDamageModifier(battle,moveType){
 const weather=battle.field?.weather?.id;
 if(weather==='sun')return moveType==='fire'?1.5:moveType==='water'?0.5:1;
 if(weather==='rain')return moveType==='water'?1.5:moveType==='fire'?0.5:1;
 return 1;
}

export function speedWithWeather(speed,unit,battle){
 const weather=battle.field?.weather?.id,effect=effectFor(unit,'weather-speed',weather);
 return effect?Math.floor(speed*effect.multiplier):speed;
}

export function applyWeather(battle,{actorId,moveId,weather,defaultTurns=5}){
 if(!WEATHER_IDS.includes(weather))throw new Error(`unsupported weather: ${weather}`);
 const next=clone(battle),actor=unitById(next,actorId),extension=effectFor(actor,'weather-duration',weather),remaining=extension?.turns||defaultTurns;
 next.field=next.field||{};next.field.weather={id:weather,remaining,sourceActorId:actorId,sourceMoveId:moveId};
 return {battle:next,events:[{kind:'weatherStarted',actorId,moveId,weather,remaining,...(extension?{sourceItemId:extension.sourceId}:{})}]};
}

export function weatherHealingGroup(battle){
 const weather=battle.field?.weather?.id,changes=[];
 if(!weather)return {id:'weather-healing',changes};
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side)){
  const effect=effectFor(unit,'weather-heal',weather);if(!effect||unit.hp>=maxHp(unit))continue;
  changes.push({actorId:unit.actorId,delta:Math.max(1,Math.floor(maxHp(unit)*effect.numerator/effect.denominator))});
 }
 return {id:'weather-healing',changes};
}
