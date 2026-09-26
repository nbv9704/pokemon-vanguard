import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {V3BattleScreen} from '../public/js/v3-battle-screen.js';
import {BattleCommandUiHandler,targetCandidates} from '../public/js/ui/handlers/battle-command-ui-handler.js';
import {renderV3Replacements} from '../public/js/v3-battle-commands.js';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {publicV3Catalog,v3Catalog} from '../server/v3-catalog.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';
import {v3BattleView} from '../server/v3-battle-view.mjs';

function openDouble(seed=9393){
 let state={schemaVersion:3,seed,progressionV3:createV3BetaProgression(v3Catalog)},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'double',difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:state.battleV3.playerRoster.slice(0,4).map(entry=>entry.buildId)},v3Catalog);assert.equal(result.ok,true);return {...state,battleV3:v3BattleView(result.state)};
}

test('R3-93 immersive battle shell replaces dashboard framing with a game header and bottom command dock',()=>{
 const current=openDouble(),screen=new V3BattleScreen({onChange(){},sendAction(){}}),html=screen.render(current,publicV3Catalog,{art:()=>'',battleArt:()=>''});
 assert.match(html,/pokemon-battle-shell/);assert.match(html,/Vanguard Arena/);assert.match(html,/pokemon-battle-stage/);assert.match(html,/pokemon-battle-dock/);assert.match(html,/What will .* do\?/);assert.doesNotMatch(html,/v2-command-grid/);
});

test('R3-93 Fight flow enters move then target mode and Cancel walks the state machine backward',()=>{
 const current=openDouble(),screen=new V3BattleScreen({onChange(){},sendAction(){}});screen.render(current,publicV3Catalog,{art:()=>'',battleArt:()=>''});const actor=screen.commandUi.currentActor(current.battleV3),moveId=actor.buildSnapshot.moveIds.find(id=>publicV3Catalog.moves.find(move=>move.id===id)?.actionProfile?.targetMode==='anyAdjacent');assert.ok(moveId);
 screen.handleClick({dataset:{v3Battle:'ui-fight'}},current,publicV3Catalog);assert.equal(screen.commandUi.mode,'MOVE');screen.handleClick({dataset:{v3Battle:'ui-move',moveId}},current,publicV3Catalog);assert.equal(screen.commandUi.mode,'TARGET');assert.equal(screen.handleCancel(current),true);assert.equal(screen.commandUi.mode,'MOVE');assert.equal(screen.handleCancel(current),true);assert.equal(screen.commandUi.mode,'COMMAND');
});

test('R3-93 target selection exposes allies only for ally moves and both sides for any-adjacent moves',()=>{
 const snapshot=openDouble().battleV3.snapshot,actor=snapshot.own.find(mon=>mon.activeSlot===0),allyMove={actionProfile:{targetMode:'adjacentAlly'}},anyMove={actionProfile:{targetMode:'anyAdjacent'}};
 const ally=targetCandidates(snapshot,actor,allyMove),any=targetCandidates(snapshot,actor,anyMove);assert.equal(ally.length,1);assert.equal(ally[0].side,'A');assert.ok(any.some(target=>target.side==='A'));assert.ok(any.some(target=>target.side==='B'));
});

test('R3-93 replacement phase renders party cards and prevents duplicate reserve choices visually',()=>{
 const screen={replacementRevision:null,replacements:{},commands:{}},view={snapshot:{phaseRevision:8,replacementSlots:[0,1],own:[{actorId:'A-0',name:'Lead 1',activeSlot:0,hp:0,maxHp:100},{actorId:'A-1',name:'Lead 2',activeSlot:1,hp:0,maxHp:100},{actorId:'A-2',name:'Reserve A',activeSlot:-1,hp:90,maxHp:100},{actorId:'A-3',name:'Reserve B',activeSlot:-1,hp:70,maxHp:100}]}};
 let html=renderV3Replacements(screen,view);assert.match(html,/replacement-card/);assert.doesNotMatch(html,/data-v3-replacement/);screen.replacements[0]='A-2';html=renderV3Replacements(screen,view);const secondSlotA=html.match(/data-ui-focus-id="replacement-1-A-2"[^>]*>/)?.[0];assert.match(secondSlotA,/disabled/);
});

test('R3-93 client uses an immersive layout for schema-3 battle pages and routes Cancel/Detail through GameUiController',()=>{
 const source=readFileSync(new URL('../public/client.js',import.meta.url),'utf8');assert.match(source,/battle-shell-layout/);assert.match(source,/onCancel:\(\)=>V\?v3BattleScreen\.handleCancel/);assert.match(source,/handleUiAction/);
 const handler=new BattleCommandUiHandler();assert.equal(handler.mode,'COMMAND');assert.equal(handler.logOpen,false);handler.toggleLog();assert.equal(handler.logOpen,true);
});
