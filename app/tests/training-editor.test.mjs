import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TrainingEditor} from '../public/js/training-editor.js';

const catalog={};for(const name of ['species','moves','abilities','items'])catalog[name]=JSON.parse(await readFile(new URL(`../content/${name}.json`,import.meta.url),'utf8'));
const species=catalog.species[0],base={buildId:'build-emberlyn-1',monId:'mon-emberlyn',...structuredClone(species.defaultBuild),revision:1};
const state={trainingV2:{mons:[{monId:'mon-emberlyn',speciesId:'emberlyn',ownership:'permanent'}],builds:[base],teams:[],activeTeamId:null}};

test('training editor renders stat diff, resets draft and sends a complete build',async()=>{
 let changes=0,sent=null;const editor=new TrainingEditor({fetchImpl:async()=>({ok:true,json:async()=>catalog}),onChange:()=>changes++,sendAction:value=>{sent=value;}});await editor.load();
 let html=editor.render(state,{art:id=>`<i>${id}</i>`});assert.match(html,/BUILD EDITOR/);assert.match(html,/Remaining 66\/66 points/);
 editor.handleInput({dataset:{trainingStat:'atk'},value:'32'});editor.handleInput({dataset:{trainingStat:'spe'},value:'32'});editor.handleInput({dataset:{trainingStat:'hp'},value:'2'});html=editor.render(state,{art:id=>`<i>${id}</i>`});assert.match(html,/Remaining 0\/66 points/);assert.match(html,/Save build · 10 coins/);assert.match(html,/No held item/);assert.match(html,/Sets Sun for 5 turns on entry/);
 editor.handleClick({dataset:{training:'save'}},state);assert.equal(sent.type,'build.save');assert.equal(sent.build.points.atk,32);assert.equal(sent.build.moveIds.length,4);assert.equal(sent.expectedRevision,1);
 editor.handleClick({dataset:{training:'reset'}},state);assert.equal(editor.draft.points.atk,0);assert.ok(changes>=4);
});

test('new build reconciles to its server ID so a second save is free',async()=>{
 let sent;const editor=new TrainingEditor({fetchImpl:async()=>({ok:true,json:async()=>catalog}),onChange:()=>{},sendAction:value=>{sent=value;}});await editor.load();editor.render(state,{art:()=>''});editor.handleClick({dataset:{training:'copy'}},state);editor.handleInput({dataset:{trainingField:'name'},value:'Build tốc độ'});editor.handleClick({dataset:{training:'save'}},state);
 const saved={...structuredClone(sent.build),buildId:'build-custom-1',revision:1};const next={trainingV2:{...state.trainingV2,builds:[base,saved]}};const html=editor.render(next,{art:()=>''});assert.equal(editor.buildId,'build-custom-1');assert.match(html,/Save build · 0 coins/);
});
