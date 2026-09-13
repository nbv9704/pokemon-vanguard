import {applyWeather} from '../weather.mjs';

export const applyWeatherHandler={
 id:'apply-weather',hooks:['onMove'],
 run({battle,payload,params}){const result=applyWeather(battle,{actorId:payload.action.actorId,moveId:payload.move.id,weather:params.weather,defaultTurns:params.turns||5});return {...result,payload};}
};
