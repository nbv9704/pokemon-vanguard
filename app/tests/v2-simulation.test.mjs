import test from 'node:test';
import assert from 'node:assert/strict';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {simulateV2Match,simulationSchedule} from '../server/v2-simulation.mjs';
import {summarizeSimulation} from '../server/v2-simulation-report.mjs';

test('simulation schedule covers both formats, swaps sides and is deterministic',()=>{
 const teams=v2Catalog.aiTeams.exhibition,schedule=simulationSchedule(teams,8,100);assert.deepEqual(schedule.slice(0,4).map(row=>[row.mode,row.teamA.id,row.teamB.id]),[['single','league-01','league-02'],['single','league-02','league-01'],['double','league-01','league-02'],['double','league-02','league-01']]);
 const rows=schedule.map(entry=>simulateV2Match({...entry,catalog:v2Catalog,difficulty:'hard'})),again=simulateV2Match({...schedule[0],catalog:v2Catalog,difficulty:'hard'});assert.deepEqual(rows[0],again);for(const row of rows){assert.ok(['single','double'].includes(row.mode));assert.equal(row.aiDifficulty,'hard');assert.ok(row.turns<=100);assert.match(row.speciesUsage,/^A:.+;B:.+/);assert.equal(typeof row.timeout,'boolean');}
 const summary=summarizeSimulation(rows,teams);assert.equal(summary.matches,8);assert.equal(summary.teams.length,12);
});
