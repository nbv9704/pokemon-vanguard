import test from 'node:test';
import assert from 'node:assert/strict';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {simulateRecruitmentEconomy} from '../server/v2-economy-simulation.mjs';

test('100k recruitment cycles produce eight unique equal-pool offers without touching a player save',()=>{
 const report=simulateRecruitmentEconomy({cycles:100000,seed:424242,catalog:v2Catalog});
 assert.equal(report.lineupSize,8);assert.equal(report.invalidLineups,0);assert.equal(report.appearances.reduce((sum,row)=>sum+row.count,0),800000);
 assert.ok(report.appearances.every(row=>row.count>0));assert.ok(report.maxAppearances/report.minAppearances<1.03);
 assert.equal(report.matchesToAfford.winsOnly,Math.ceil(1200/180));assert.equal(report.matchesToAfford.lossesOnly,Math.ceil(1200/60));
});
