import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createBattleLabState,stepBattleLab} from '../server/v3-battle-lab.mjs';
import {auditMaRelease} from '../release/ma-release-gate.mjs';
import {runMaReleaseMatrix} from '../release/ma-release-matrix.mjs';

test('M-A release auditor closes runtime, offline and presentation-asset gates',async()=>{
 const report=await auditMaRelease();assert.equal(report.status,'runtime-ready');assert.deepEqual(report.problems,[]);assert.deepEqual(report.warnings,[]);assert.equal(report.scope.totalSelectable,272);assert.equal(report.scope.nonMega,213);assert.equal(report.scope.megaForms,59);assert.equal(report.scope.moves,490);assert.equal(report.presentation.timelines,490);assert.equal(report.presentation.legacy,0);assert.equal(report.assets.fallbackSafe,272);assert.equal(report.assets.bespokeComplete,272);assert.equal(report.assets.bespokeDebt,0);assert.deepEqual(report.offline.externalRuntimeReferences,[]);
});

test('R3-100 Battle Lab can create and advance authoritative Single and Double smoke scenarios',()=>{
 for(const mode of ['single','double']){const state=createBattleLabState(v3Catalog,{mode,speciesIds:['ditto','castform','rotom','aegislash','mimikyu','palafin'],seed:3100});assert.equal(state.battleV3.battle.phase,'COMMAND');const result=stepBattleLab(state,v3Catalog);assert.equal(result.ok,true);assert.ok(['COMMAND','REPLACE','FINISHED'].includes(result.state.battleV3.battle.phase));}
});

test('R3-100 release matrix represents every M-A species in both formats and all M-A Mega forms',()=>{
 const result=runMaReleaseMatrix();assert.equal(result.single.speciesSpawned,213);assert.equal(result.double.speciesSpawned,213);assert.equal(result.mega.forms,59);assert.equal(result.moveFx.moves,490);assert.equal(result.moveFx.commitSafe,490);assert.ok(result.specialPresentation.cases>=9);
});

test('R3-100 public shell has no remote font import and keeps offline-safe system fallback fonts',async()=>{
 const css=await readFile(new URL('../public/style.css',import.meta.url),'utf8');assert.doesNotMatch(css,/fonts\.googleapis\.com|@import\s+url\(['"]?https?:/);assert.match(css,/sans-serif/);
});
