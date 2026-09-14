import {applyTerrain} from '../terrain.mjs';
import {resolveTerrainSeedItems} from '../item-hooks.mjs';

export const applyTerrainHandler={
 id:'apply-terrain',hooks:['onMove'],
 run({battle,payload,params}){const result=applyTerrain(battle,{actorId:payload.action.actorId,moveId:payload.move.id,terrain:params.terrain,defaultTurns:params.turns||5});if(!result.applied)return {battle:result.battle,payload:{...payload,terrainApplied:false},events:result.events};const seeds=resolveTerrainSeedItems(result.battle,{trigger:`terrain:${params.terrain}`});return {battle:seeds.battle,payload:{...payload,terrainApplied:true},events:[...result.events,...seeds.events]};}
};
