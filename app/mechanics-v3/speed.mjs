import {stagedStat} from '../rules-v3/stats.mjs';
import {abilityStatModifiers} from './ability-hooks.mjs';
import {speedWithHeldItems} from './item-hooks.mjs';
import {speedWithMajorStatus} from './major-status-action.mjs';
import {speedWithSideConditions} from './side-conditions.mjs';
import {speedWithWeather} from './weather.mjs';

export function effectiveBattleSpeed(battle,unit){
 if(!unit)return 0;
 let speed=stagedStat(unit.stats.spe,unit.stages?.spe||0);
 speed=speedWithMajorStatus(speed,unit);
 speed=speedWithWeather(speed,unit,battle);
 speed=abilityStatModifiers(unit,'spe',battle).apply(speed);
 speed=speedWithHeldItems(speed,unit,battle);
 speed=speedWithSideConditions(speed,unit,battle);
 return Math.max(1,Math.floor(speed));
}
