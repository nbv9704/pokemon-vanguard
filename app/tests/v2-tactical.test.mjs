import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from '../src/logic.js';
import {v2Catalog,publicV2Catalog} from '../server/v2-catalog.mjs';
import {getV2Progression} from '../server/v2-progression.mjs';
import {validatePreviewSelection,validateRosterForRegulation} from '../server/v2-regulations.mjs';
import {applyV2BattleAction,projectBattleForAi,v2BattleView} from '../server/v2-battle-actions.mjs';
import {chooseAiCommands} from '../server/v2-ai.mjs';
import {V2_submitCommands} from '../src/v2-engine.mjs';
import {V2BattleScreen} from '../public/js/v2-battle-screen.js';

function readyState(){const state=setup(['tactical']);state.progressionV2=getV2Progression(state,v2Catalog);state.progressionV2.teams[0].buildIds=state.progressionV2.builds.map(build=>build.buildId);return state;}
function started(mode='single',difficulty='normal'){let state=readyState(),result=applyV2BattleAction(state,{type:'battleV2.preview.start',mode,regulationId:`alpha-${mode}`,difficulty},v2Catalog);assert.equal(result.ok,true);state=result.state;const count=mode==='double'?4:3;result=applyV2BattleAction(state,{type:'battleV2.preview.lock',buildIds:state.progressionV2.teams[0].buildIds.slice(0,count)},v2Catalog);assert.equal(result.ok,true);return result.state;}

test('three regulations enforce roster, pick count, species and item clauses',()=>{
 const state=readyState(),progression=state.progressionV2,team=progression.teams[0];assert.equal(validateRosterForRegulation(team,progression,v2Catalog,'alpha-single','single').ok,true);assert.equal(validatePreviewSelection(team.buildIds.slice(0,2),team,progression,v2Catalog,'alpha-single','single').code,'INVALID_PREVIEW_SELECTION');assert.equal(validatePreviewSelection(team.buildIds.slice(0,3),team,progression,v2Catalog,'alpha-single','single').leadCount,1);
 const short={...team,buildIds:team.buildIds.slice(0,4)};assert.deepEqual(validateRosterForRegulation(short,progression,v2Catalog,'alpha-double','double').details,['TEAM_SIZE']);assert.equal(validateRosterForRegulation(short,progression,v2Catalog,'sandbox-v2','double').ok,true);
});

test('catalog includes 12 exhibition teams and six gym teams per format',()=>{assert.equal(v2Catalog.aiTeams.exhibition.length,12);assert.equal(v2Catalog.aiTeams.gyms.single.length,6);assert.equal(v2Catalog.aiTeams.gyms.double.length,6);for(const team of [...v2Catalog.aiTeams.exhibition,...v2Catalog.aiTeams.gyms.single,...v2Catalog.aiTeams.gyms.double])assert.equal(new Set(team.speciesIds).size,6);});

test('preview reveals species only and locks three or four ordered picks',()=>{
 let state=readyState(),start=applyV2BattleAction(state,{type:'battleV2.preview.start',mode:'double',regulationId:'alpha-double',difficulty:'hard'},v2Catalog);const preview=v2BattleView(start.state,v2Catalog),serialized=JSON.stringify(preview.opponentRoster);assert.equal(preview.phase,'PREVIEW');for(const hidden of ['moveIds','itemId','abilityId','points'])assert.equal(serialized.includes(hidden),false);assert.equal('aiRngState' in preview,false);assert.equal('templateId' in preview,false);
 const locked=applyV2BattleAction(start.state,{type:'battleV2.preview.lock',buildIds:start.state.progressionV2.teams[0].buildIds.slice(0,4)},v2Catalog);assert.equal(locked.ok,true);assert.equal(locked.state.battleV2.battle.sides.A.active.length,2);assert.equal(locked.state.battleV2.battle.sides.A.roster.length,4);
});

test('Easy, Normal and Hard AI emit valid deterministic commands without reading pending choices',()=>{
 for(const difficulty of ['easy','normal','hard']){const state=started('double',difficulty),battle=state.battleV2.battle,knowledge=projectBattleForAi(battle,v2Catalog),one=chooseAiCommands(knowledge,{difficulty,moves:v2Catalog.movesById,aiRngState:99}),changed=structuredClone(knowledge);changed.pending.A=[{secret:'must-not-affect-ai'}];const two=chooseAiCommands(changed,{difficulty,moves:v2Catalog.movesById,aiRngState:99});assert.deepEqual(one,two);assert.equal(JSON.stringify(knowledge.sides.A.roster).includes('swift-feather'),false);assert.deepEqual(knowledge.pending,{});const accepted=V2_submitCommands(battle,'B',one.commands,v2Catalog.movesById);assert.equal(accepted.ok,true);}
});

test('authoritative command resolves one turn and projects opponent HP as percentages',()=>{
 let state=started(),view=v2BattleView(state,v2Catalog),actor=view.snapshot.own.find(mon=>mon.activeSlot===0),action={type:'battleV2.commands',phaseRevision:view.snapshot.phaseRevision,commands:[{kind:'move',actorId:actor.battleMonId,moveId:actor.buildSnapshot.moveIds[0],target:{side:'B',slot:0}}]},result=applyV2BattleAction(state,action,v2Catalog);assert.equal(result.ok,true);view=v2BattleView(result.state,v2Catalog);assert.ok(['COMMAND','REPLACE','FINISHED'].includes(view.snapshot.phase));assert.ok(view.events.length>0);assert.ok(view.events.every(event=>event.turn===1));assert.ok(view.turnSnapshots.initial&&view.turnSnapshots.final);assert.equal(JSON.stringify(view.snapshot.opponent).includes('buildSnapshot'),false);for(const event of view.events.filter(entry=>entry.kind==='damage'&&entry.targetId?.startsWith('B-'))){assert.equal('amount' in event,false);assert.ok(Number.isFinite(event.hpPercentAfter));}
});

test('finishing command settles an Alpha reward exactly once',()=>{
 let state=started(),battle=state.battleV2.battle,activeId=battle.sides.B.active[0];for(const mon of battle.sides.B.roster){mon.hp=mon.battleMonId===activeId?1:0;if(mon.battleMonId===activeId)mon.types=['Bloom'];}const actor=battle.sides.A.roster.find(mon=>battle.sides.A.active.includes(mon.battleMonId)),before=state.coins,action={type:'battleV2.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId:actor.battleMonId,moveId:actor.buildSnapshot.moveIds[0],target:{side:'B',slot:0}}]},result=applyV2BattleAction(state,action,v2Catalog);assert.equal(result.ok,true);assert.equal(result.state.battleV2.phase,'FINISHED');assert.equal(result.state.coins,before+180);assert.equal(result.state.rewardReceipts.length,1);const replay=applyV2BattleAction(result.state,action,v2Catalog);assert.equal(replay.ok,false);assert.equal(result.state.coins,before+180);const screen=new V2BattleScreen({onChange(){},sendAction(){}}),html=screen.render({...result.state,battleV2:v2BattleView(result.state,v2Catalog)},publicV2Catalog,{art:()=>''});assert.match(html,/\+180 coins · \+80 crystals/);
});

test('battle screen renders preview, PP command cards, field phase and event log',()=>{
 const sent=[],screen=new V2BattleScreen({onChange(){},sendAction:action=>sent.push(action)}),art=id=>`<i>${id}</i>`;let state=readyState(),start=applyV2BattleAction(state,{type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal'},v2Catalog);let html=screen.render({...start.state,battleV2:v2BattleView(start.state,v2Catalog)},publicV2Catalog,{art});assert.match(html,/CLOSED TEAM SHEET/);assert.equal((html.match(/data-v2battle="pick"/g)||[]).length,6);
 state=applyV2BattleAction(start.state,{type:'battleV2.preview.lock',buildIds:start.state.progressionV2.teams[0].buildIds.slice(0,3)},v2Catalog).state;html=screen.render({...state,battleV2:v2BattleView(state,v2Catalog)},publicV2Catalog,{art});assert.match(html,/PP/);assert.match(html,/COMMAND/);assert.match(html,/Battle log/);assert.match(html,/title="A reliable/);
});

test('schema-2 battle UI attaches stable action IDs before sending commands',()=>{
 const sent=[],screen=new V2BattleScreen({onChange(){},sendAction:action=>sent.push(action),createActionId:kind=>`b16:${kind}`});screen.handleClick({dataset:{v2battle:'start',mode:'single',regulation:'alpha-single'}},{battleV2:null},publicV2Catalog);assert.equal(sent[0].actionId,'b16:preview-start');const state=started(),view={...state,battleV2:v2BattleView(state,v2Catalog)},actor=view.battleV2.snapshot.own.find(mon=>mon.activeSlot===0);screen.commands[actor.battleMonId]={kind:'move',actorId:actor.battleMonId,moveId:actor.buildSnapshot.moveIds[0],target:{side:'B',slot:0}};screen.handleClick({dataset:{v2battle:'submit'}},view,publicV2Catalog);assert.equal(sent[1].actionId,'b16:commands');
});
