import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog,v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression,v3TrainingView} from '../server/v3-progression.mjs';
import {V3TrainingEditor} from '../public/js/v3-training-editor.js';
import {V3TeamBuilder} from '../public/js/v3-team-builder.js';
import {SummaryTab,SummaryUiHandler,SUMMARY_TABS} from '../public/js/ui/handlers/summary-ui-handler.js';

const state=()=>({trainingV3:v3TrainingView(createV3BetaProgression(v3Catalog),v3Catalog)});
const editor=async()=>{const value=new V3TrainingEditor({fetchImpl:async()=>({ok:true,json:async()=>structuredClone(publicV3Catalog)}),onChange(){},sendAction(){}});await value.load();return value;};

test('R3-97 Summary handler exposes four Pokémon-style pages and cycles with shoulder-page actions',()=>{
 const handler=new SummaryUiHandler();assert.equal(SUMMARY_TABS.length,4);assert.equal(handler.tab,SummaryTab.PROFILE);handler.page(1);assert.equal(handler.tab,SummaryTab.STATS);handler.page(-1);assert.equal(handler.tab,SummaryTab.PROFILE);handler.select(SummaryTab.MOVES);assert.equal(handler.cancel(),true);assert.equal(handler.tab,SummaryTab.PROFILE);assert.match(handler.renderTabs(),/Profile[\s\S]*Stats[\s\S]*Moves[\s\S]*Ability \/ Item/);
});

test('R3-97 Training selects an owned Pokémon before opening the paid training plan',async()=>{
 const value=await editor(),current={...state(),coins:999999};let html=value.render(current);assert.match(html,/Choose a Pokémon to train/);assert.equal((html.match(/class="training-select-card /g)||[]).length,6);assert.match(html,/Commence Training/);
 value.handleClick({dataset:{v3Training:'commence'}},current);html=value.render(current);assert.match(html,/Stats & Stat Points/);assert.equal((html.match(/<option value="/g)||[]).length>=25,true);assert.match(html,/5 VP PER NEW POINT/);assert.match(html,/Nature · 500 VP/);assert.equal((html.match(/summary-move-card/g)||[]).length,4);assert.match(html,/250 VP PER NEW MOVE/);assert.match(html,/ABILITY · 500 VP/);assert.doesNotMatch(html,/Held item|Item Clause|Miracle Seed/);
});

test('R3-97 Training exposes selection and plan modes to the shared game input layer',async()=>{
 const value=await editor(),current={...state(),coins:999999};value.render(current);assert.equal(value.uiMode(),'TRAINING_SELECT');value.handleClick({dataset:{v3Training:'commence'}},current);assert.equal(value.uiMode(),'TRAINING_PLAN');assert.equal(value.handleCancel(),true);assert.equal(value.uiMode(),'TRAINING_SELECT');
});

test('R3-97 Party screen renders a team rail, build picker and selected Pokémon details',()=>{
 const current=state(),builder=new V3TeamBuilder({onChange(){},sendAction(){}});let html=builder.render(current,publicV3Catalog);assert.equal((html.match(/class="party-slot-card /g)||[]).length,6);assert.doesNotMatch(html,/data-v3-team-slot=/);assert.match(html,/party-team-rail/);assert.match(html,/party-workspace/);assert.match(html,/party-detail/);assert.match(html,/CHANGE PARTY MEMBER/);assert.match(html,/BASE STATS/);assert.match(html,/MOVES/);assert.match(html,/Bullet Seed/);assert.match(html,/Overgrow/);
 builder.handleClick({dataset:{v3Team:'slot',slot:'1'}});assert.equal(builder.selectedSlot,1);const first=builder.draft.buildIds[0],second=builder.draft.buildIds[1];builder.handleClick({dataset:{v3Team:'pick',buildId:first}});assert.equal(builder.draft.buildIds[1],first);assert.equal(builder.draft.buildIds[0],second);assert.equal(new Set(builder.draft.buildIds).size,6);
});

test('R3-97 management pages are wired to the shared GameUiController keyboard layer',async()=>{
 const source=await (await import('node:fs/promises')).readFile(new URL('../public/client.js',import.meta.url),'utf8');assert.match(source,/const managementUi=new GameUiController/);for(const route of ['training','teams','collection','recruitment'])assert.match(source,new RegExp(`page==='${route}'`));assert.match(source,/v3TrainingEditor\.handleUiAction/);assert.match(source,/v3TeamBuilder\.handleCancel/);
});
