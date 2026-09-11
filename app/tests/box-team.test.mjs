import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,viewFor} from '../src/logic.js';
import {v2Catalog,publicV2Catalog} from '../server/v2-catalog.mjs';
import {applyV2ProgressionAction,getV2Progression,v2TrainingView} from '../server/v2-progression.mjs';
import {applyBlueprintImport,validateTeamInput} from '../server/v2-team-actions.mjs';
import {BoxView} from '../public/js/box-view.js';
import {TeamBuilder} from '../public/js/team-builder.js';
import {analyzeTeam} from '../public/js/team-analysis.js';

const art=id=>`<i>art-${id}</i>`;
function fixture(){const saved=setup(['m2-box-team']),state={...viewFor(saved,saved.owner),trainingV2:v2TrainingView(saved,v2Catalog)};return {saved,state};}

test('archive renders all species and distinguishes permanent, trial and locked fixtures',()=>{
 const {saved}=fixture();saved.progressionV2=getV2Progression(saved,v2Catalog);saved.progressionV2.mons.push({monId:'trial-cindrake',speciesId:'cindrake',ownership:'trial',trialExpiresAt:'2099-01-01T00:00:00Z'});
 const state={...viewFor(saved,saved.owner),trainingV2:v2TrainingView(saved,v2Catalog)},box=new BoxView({onChange(){}});let html=box.render(state,publicV2Catalog,{art});
 assert.match(html,/Permanent/);assert.match(html,/Trial/);assert.match(html,/Locked/);assert.equal((html.match(/class="box-card /g)||[]).length,36);
 box.tab='trial';html=box.render(state,publicV2Catalog,{art});assert.equal((html.match(/class="box-card /g)||[]).length,1);assert.match(html,/Cindrake/);
 box.tab='all';box.query='ember';assert.match(box.render(state,publicV2Catalog,{art}),/Emberlyn/);
});

test('full team enforces item clause while incomplete drafts remain saveable',()=>{
 const {saved,state}=fixture(),progression=getV2Progression(saved,v2Catalog);for(const build of progression.builds)build.itemId='vital-seed';state.trainingV2=progression;
 assert.deepEqual(validateTeamInput({name:'Draft',buildIds:progression.builds.slice(0,5).map(build=>build.buildId)},progression),[]);
 assert.deepEqual(validateTeamInput({name:'Full',buildIds:progression.builds.slice(0,6).map(build=>build.buildId)},progression),['ITEM_CLAUSE']);
 assert.match(analyzeTeam(progression.builds.slice(0,6).map(build=>build.buildId),state,publicV2Catalog).issues.join(' '),/Item Clause/);
});

test('blueprint import keeps missing species ineligible and never grants ownership',()=>{
 const {saved}=fixture(),progression=getV2Progression(saved,v2Catalog),species=v2Catalog.speciesById.cindrake,before=progression.mons.length;
 const raw={schemaVersion:1,name:'Đội tham khảo',builds:[{speciesId:species.id,...structuredClone(species.defaultBuild)}]};
 const result=applyBlueprintImport(saved,progression,{blueprint:JSON.stringify(raw)},v2Catalog);assert.equal(result.ok,true);assert.equal(result.blueprint.eligible,false);assert.deepEqual(result.blueprint.missingSpeciesIds,['cindrake']);assert.equal(result.state.progressionV2.mons.length,before);
 const large=applyBlueprintImport(saved,progression,{blueprint:'x'.repeat(65537)},v2Catalog);assert.equal(large.code,'BLUEPRINT_TOO_LARGE');
});

test('team builder has six slots and exports no save identity or economy fields',()=>{
 const {state}=fixture(),builder=new TeamBuilder({onChange(){},sendAction(){}});const html=builder.render(state,publicV2Catalog,{art});assert.equal((html.match(/class="team-slot /g)||[]).length,6);
 const blueprint=builder.exportBlueprint(state.trainingV2,publicV2Catalog),json=JSON.stringify(blueprint);for(const forbidden of ['monId','buildId','coins','ownership','session'])assert.equal(json.includes(forbidden),false);assert.equal(blueprint.schemaVersion,1);
});

test('Gate M2 saves physical-fast and support builds while preserving another team',()=>{
 let state=setup(['m2-gate']);state.progressionV2=getV2Progression(state,v2Catalog);state.progressionV2.teams.push({teamId:'team-archive',name:'Đội cũ',buildIds:[state.progressionV2.builds[0].buildId],revision:1});
 for(const speciesId of ['emberlyn','mossprout']){const mon=state.progressionV2.mons.find(entry=>entry.speciesId===speciesId),base=state.progressionV2.builds.find(entry=>entry.monId===mon.monId),species=v2Catalog.speciesById[speciesId],build={...structuredClone(base),name:speciesId==='emberlyn'?'Vật lý tốc độ':'Hỗ trợ sân',points:speciesId==='emberlyn'?{hp:0,atk:16,def:0,spa:0,spd:0,spe:16}:{hp:16,atk:0,def:0,spa:0,spd:16,spe:0}};const result=applyV2ProgressionAction(state,{type:'build.save',build,expectedRevision:base.revision},v2Catalog);assert.equal(result.ok,true);assert.equal(species.role,speciesId==='emberlyn'?'physical-fast':'support');state=result.state;}
 const team=state.progressionV2.teams.find(entry=>entry.teamId==='team-default'),saved=applyV2ProgressionAction(state,{type:'team.save',team:{...team,name:'Đội sáu Mon'},expectedRevision:team.revision},v2Catalog);assert.equal(saved.ok,true);assert.equal(saved.state.progressionV2.teams.some(entry=>entry.teamId==='team-archive'&&entry.name==='Đội cũ'),true);
});

test('all default builds have four valid moves with localized labels and descriptions',()=>{
 for(const species of v2Catalog.species){assert.match(species.defaultBuild.name,/Build mặc định/);assert.equal(species.defaultBuild.moveIds.length,4);for(const id of species.defaultBuild.moveIds){const move=v2Catalog.movesById[id];assert.ok(move.name.trim());assert.ok(move.description.trim().length>=8);}}
});
