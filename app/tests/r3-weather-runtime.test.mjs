import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function weatherBattle(){
 const progression=createV3BetaProgression(v3Catalog),build=progression.builds.find(entry=>entry.monId==='v3-mon-venusaur');
 build.moveIds=['sunny-day','giga-drain','leech-seed','protect'];build.abilityId='chlorophyll';build.itemId='heat-rock';
 let state={schemaVersion:3,seed:719,progressionV3:progression};
 let result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'single',difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:progression.teams[0].buildIds.slice(0,3)},v3Catalog);assert.equal(result.ok,true);
 return result.state;
}

function command(state,moveId,target){
 const battle=state.battleV3.battle,actorId=battle.sides.A.active[0];
 return applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId,moveId,...(target?{target}:{})}]},v3Catalog);
}

test('schema-3 server persists extended Sun and uses its dynamic Speed on the next turn',()=>{
 let state=weatherBattle(),battle=state.battleV3.battle,venusaur=battle.sides.A.roster[0],baseSpeed=venusaur.stats.spe;
 const first=command(state,'sunny-day');assert.equal(first.ok,true);state=first.state;
 const {id:weatherEventId,...weatherEvent}=state.battleV3.lastEvents.find(event=>event.kind==='weatherStarted');
 assert.match(weatherEventId,/event:/);assert.deepEqual(weatherEvent,{kind:'weatherStarted',actorId:'A-0',moveId:'sunny-day',weather:'sun',remaining:8,sourceItemId:'heat-rock'});
 assert.equal(state.battleV3.battle.field.weather.remaining,7);
 const second=command(state,'giga-drain',{side:'B',slot:0});assert.equal(second.ok,true);
 const started=second.state.battleV3.lastEvents.find(event=>event.kind==='moveStarted'&&event.actorId==='A-0');
 assert.equal(started.speed,baseSpeed*2);assert.equal(second.state.battleV3.battle.field.weather.remaining,6);
});
