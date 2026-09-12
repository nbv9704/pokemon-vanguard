import test from 'node:test';
import assert from 'node:assert/strict';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression,v3TrainingView} from '../server/v3-progression.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {V3TrainingEditor} from '../public/js/v3-training-editor.js';
import {V3TeamBuilder} from '../public/js/v3-team-builder.js';
import {V3BattleScreen} from '../public/js/v3-battle-screen.js';
import {V3RecruitmentView} from '../public/js/v3-recruitment-view.js';
import {V3OverviewView} from '../public/js/v3-overview-view.js';
import {battleLog,createTurnFrames,groupTurnEvents} from '../public/js/v3-battle-timeline.js';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';
import {v3BattleView} from '../server/v3-battle-view.mjs';
import {prepareV3RecruitmentState,v3RecruitmentView} from '../server/v3-recruitment-state.mjs';

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

test('schema-3 Battle UI covers landing, Double Preview and command submission',()=>{
 const sent=[],screen=new V3BattleScreen({onChange(){},sendAction:action=>sent.push(action)}),base={...state(),battleV3:null};assert.match(screen.render(base,publicV3Catalog,{art:id=>`<i>${id}</i>`}),/Single Battle/);
 screen.handleClick({dataset:{v3Battle:'start',mode:'double'}},base,publicV3Catalog);assert.equal(sent[0].type,'battleV3.preview.start');let domain={schemaVersion:3,seed:91,progressionV3:createV3BetaProgression(v3Catalog)},result=applyV3BattleAction(domain,sent[0],v3Catalog);domain=result.state;let view={...base,battleV3:v3BattleView(domain)};assert.match(screen.render(view,publicV3Catalog,{art:()=>''}),/Choose 4 Mon/);
 for(const mon of view.battleV3.playerRoster.slice(0,4))screen.handleClick({dataset:{v3Battle:'pick',buildId:mon.buildId}},view,publicV3Catalog);screen.handleClick({dataset:{v3Battle:'lock'}},view,publicV3Catalog);result=applyV3BattleAction(domain,sent.at(-1),v3Catalog);domain=result.state;view={...base,battleV3:v3BattleView(domain)};const perspectives=[];assert.equal((screen.render(view,publicV3Catalog,{art:id=>`<i>artwork:${id}</i>`,battleArt:(id,perspective)=>{perspectives.push([id,perspective]);return'';}}).match(/choose an action/g)||[]).length,2);assert.deepEqual(perspectives.map(entry=>entry[1]).sort(),['back','back','front','front']);screen.commands['A-fainted']={kind:'move',actorId:'A-fainted',moveId:'protect'};screen.handleClick({dataset:{v3Battle:'submit'}},view,publicV3Catalog);assert.equal(sent.at(-1).type,'battleV3.commands');assert.equal(sent.at(-1).commands.length,2);
});

test('schema-3 Recruitment renders ten offers and emits revision-safe actions',()=>{const root={schemaVersion:3,seed:42,coins:5000,gems:0,recruitmentTickets:1,progressionV3:createV3BetaProgression(v3Catalog)};prepareV3RecruitmentState(root,v3Catalog,100000000);const current={...root,trainingV3:v3TrainingView(root.progressionV3,v3Catalog),recruitmentV3:v3RecruitmentView(root,v3Catalog,{serverNow:100000000})},sent=[],view=new V3RecruitmentView({sendAction:action=>sent.push(action),createActionId:kind=>`${kind.replaceAll('.','-')}:ui-test`}),html=view.render(current,publicV3Catalog,{art:id=>`<img src="/pokemon-artwork/${id}.png">`});assert.equal((html.match(/class="recruit-card /g)||[]).length,10);assert.match(html,/Roster Ranch/);assert.match(html,/pokemon-artwork\//);view.handleClick({dataset:{v3Recruit:'refresh'}},current);assert.equal(sent[0].type,'recruitV3.refresh');assert.match(sent[0].actionId,/^recruitV3-refresh:/);assert.equal(sent[0].expectedRevision,current.recruitmentV3.revision);assert.doesNotMatch(html,/Emberlyn|Loading Recruitment/);});

test('schema-3 overview pages use the promoted roster and keep legacy gyms disabled',()=>{const view=new V3OverviewView(),current=state(),art=id=>`<img src="/pokemon-sprites/${id}.gif">`;for(const html of [view.renderHome(current,publicV3Catalog,{art}),view.renderArchive(current,publicV3Catalog,{art}),view.renderGym(current,publicV3Catalog,{art}),view.renderGuide(publicV3Catalog)])assert.doesNotMatch(html,/Emberlyn|Tideray|Mossprout|Voltkit/);assert.equal((view.renderArchive(current,publicV3Catalog,{art}).match(/class="box-card permanent v3-box-card"/g)||[]).length,6);assert.match(view.renderHome(current,publicV3Catalog,{art}),/Single Battle[\s\S]*Double Battle/);assert.equal((view.renderGym(current,publicV3Catalog,{art}).match(/Not available in beta/g)||[]).length,6);});

test('schema-3 timeline waits for move FX before applying its damage, then advances in event order',()=>{const snapshot={turn:1,own:[{actorId:'A-0',name:'Fast ally',hp:100,maxHp:100,activeSlot:0}],opponent:[{actorId:'B-0',name:'Fast foe',hpPercent:100,activeSlot:0}]},events=[{id:'1',kind:'turnStarted',turn:1},{id:'2',kind:'moveStarted',actorId:'A-0',moveId:'protect',speed:151},{id:'3',kind:'damage',actorId:'A-0',targetId:'B-0',moveId:'protect',hpBeforePercent:100,hpAfterPercent:62,effectiveness:2},{id:'4',kind:'moveStarted',actorId:'B-0',moveId:'protect',speed:140},{id:'5',kind:'damage',actorId:'B-0',targetId:'A-0',moveId:'protect',hpBefore:100,hpAfter:74,amount:26},{id:'6',kind:'endTurnStarted',turn:1},{id:'7',kind:'turnEnded',turn:1}],groups=groupTurnEvents(events),frames=createTurnFrames(snapshot,events);assert.deepEqual(groups.map(group=>group.actorId||group.kind),['A-0','B-0','endTurn']);assert.equal(frames[0].stage,'cast');assert.equal(frames[0].total,2);assert.equal(frames.at(-1).stage,'endTurn');assert.equal(frames.at(-1).total,2);assert.equal(frames[0].snapshot.opponent[0].hpPercent,100);assert.equal(frames[0].duration,1050);assert.equal(frames[1].stage,'impact');assert.equal(frames[1].snapshot.opponent[0].hpPercent,62);assert.equal(frames[2].snapshot.own[0].hp,100);assert.equal(frames[3].snapshot.own[0].hp,74);const text=battleLog(events,snapshot,publicV3Catalog).map(entry=>entry.text).join(' ');assert.match(text,/Fast ally used Protect! \(Speed 151\)/);assert.match(text,/super effective/);assert.match(text,/Fast foe used Protect! \(Speed 140\)/);});
