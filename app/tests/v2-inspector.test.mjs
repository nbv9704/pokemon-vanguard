import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {setup} from '../src/logic.js';
import {v2Catalog,publicV2Catalog} from '../server/v2-catalog.mjs';
import {getV2Progression} from '../server/v2-progression.mjs';
import {inspectV2Damage} from '../server/v2-damage-inspector.mjs';
import {createLocalServer} from '../local-server.mjs';
import {DamageInspector} from '../public/js/damage-inspector.js';

test('damage inspector uses the v2 engine breakdown and rejects non-sandbox calls',()=>{
 const state=setup(['inspector']),progression=getV2Progression(state,v2Catalog),build=progression.builds[0],species=v2Catalog.speciesById[progression.mons.find(mon=>mon.monId===build.monId).speciesId],defender=v2Catalog.species[3],move=v2Catalog.movesById[build.moveIds.find(id=>v2Catalog.movesById[id].power>0)];
 const result=inspectV2Damage({context:'sandbox',attacker:{speciesId:species.id,build},defender:{speciesId:defender.id,build:defender.defaultBuild},moveId:move.id,weather:'sun',terrain:null,spread:false},v2Catalog);assert.equal(result.ok,true);assert.ok(result.breakdown.damage>0);assert.equal(result.breakdown.moveId,move.id);assert.equal(result.breakdown.stab,1.5);assert.equal(result.breakdown.targetHp,100+defender.baseStats.hp);
 assert.equal(inspectV2Damage({...result,context:'gym'},v2Catalog).code,'SANDBOX_ONLY');
 const screen=new DamageInspector({fetchImpl:()=>{}}),html=screen.render({trainingV2:progression},publicV2Catalog);assert.match(html,/AUTHORITATIVE CALCULATOR/);assert.match(html,/Spread move in Double Battle/);assert.match(html,/Calculate damage/);
});

test('local damage endpoint is read-only and returns a validated breakdown',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'aether-inspector-')),app=createLocalServer({saveDir:dir}),port=await app.listen(0);try{const progression=getV2Progression(setup(['http']),v2Catalog),build=progression.builds[0],mon=progression.mons.find(entry=>entry.monId===build.monId),defender=v2Catalog.species[4],response=await fetch(`http://127.0.0.1:${port}/api/v2/damage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context:'sandbox',attacker:{speciesId:mon.speciesId,build},defender:{speciesId:defender.id,build:defender.defaultBuild},moveId:build.moveIds[0],spread:true})}),payload=await response.json();assert.equal(response.status,200);assert.equal(payload.ok,true);assert.equal(payload.breakdown.spread,.75);}finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
