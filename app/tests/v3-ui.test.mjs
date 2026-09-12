import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression,v3TrainingView} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {V3TrainingEditor} from '../public/js/v3-training-editor.js';
import {V3TeamBuilder} from '../public/js/v3-team-builder.js';

const state=()=>({trainingV3:v3TrainingView(createV3BetaProgression(v3Catalog),v3Catalog)});

test('schema-3 Training UI loads promoted catalog and renders dual types plus 66 points',async()=>{
 const sent=[],editor=new V3TrainingEditor({fetchImpl:async()=>({ok:true,json:async()=>structuredClone(publicV3Catalog)}),onChange(){},sendAction:action=>sent.push(action)});await editor.load();const view=state(),html=editor.render(view);assert.match(html,/Venusaur/);assert.match(html,/grass/);assert.match(html,/poison/);assert.match(html,/66\/66 used/);
 editor.handleClick({dataset:{v3Training:'save'}},view);assert.equal(sent[0].type,'buildV3.save');assert.equal(sent[0].expectedRevision,1);
});

test('schema-3 Training UI marks incomplete point allocation invalid',async()=>{
 const editor=new V3TrainingEditor({fetchImpl:async()=>({ok:true,json:async()=>structuredClone(publicV3Catalog)}),onChange(){},sendAction(){}});await editor.load();const view=state();editor.render(view);editor.handleInput({dataset:{v3Stat:'spa'},value:'31'});assert.match(editor.render(view),/Use exactly 66 Stat Points/);
});

test('schema-3 Team UI renders six slots and emits revision-safe saves',()=>{
 const sent=[],builder=new V3TeamBuilder({onChange(){},sendAction:action=>sent.push(action)}),view=state(),html=builder.render(view,publicV3Catalog);assert.equal((html.match(/class="team-slot filled"/g)||[]).length,6);assert.match(html,/Legal for M-A beta/);builder.handleClick({dataset:{v3Team:'save'}});assert.equal(sent[0].type,'teamV3.save');assert.equal(sent[0].expectedRevision,1);
});
