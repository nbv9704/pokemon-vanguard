import {applyTerrain} from '../terrain.mjs';

export const applyTerrainHandler={
 id:'apply-terrain',hooks:['onMove'],
 run({battle,payload,params}){const result=applyTerrain(battle,{actorId:payload.action.actorId,moveId:payload.move.id,terrain:params.terrain,defaultTurns:params.turns||5});return {battle:result.battle,payload:{...payload,terrainApplied:result.applied},events:result.events};}
};
