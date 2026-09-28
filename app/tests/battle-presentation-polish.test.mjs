import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTurnFrames} from '../public/js/v3-battle-timeline.js';
import {BATTLE_PRESENTATION_TIMING,retimePresentationCues} from '../public/js/presentation/battle-presentation-timing.js';
import {renderPokemonHud} from '../public/js/ui/primitives/pokemon-ui.js';
import {BattleLogDragController} from '../public/js/ui/battle-log-drag-controller.js';

const classList=()=>{const values=new Set();return {add:(...v)=>v.forEach(x=>values.add(x)),remove:(...v)=>v.forEach(x=>values.delete(x)),contains:v=>values.has(v)};};
const style=()=>{const values=new Map();return {setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key),getPropertyValue:key=>values.get(key)||''};};

test('battle presentation cadence keeps cast, impact, then the next actor strictly ordered',()=>{
 const snapshot={turn:1,field:{},sideConditions:{own:{},opponent:{}},own:[{actorId:'A-0',name:'Ally',hp:100,maxHp:100,activeSlot:0}],opponent:[{actorId:'B-0',name:'Foe',hpPercent:100,activeSlot:0}]};
 const events=[{kind:'turnStarted',turn:1},{kind:'moveStarted',actorId:'A-0',moveId:'tackle'},{kind:'damage',actorId:'A-0',targetId:'B-0',moveId:'tackle',hpBeforePercent:100,hpAfterPercent:61},{kind:'moveStarted',actorId:'B-0',moveId:'tackle'},{kind:'damage',actorId:'B-0',targetId:'A-0',moveId:'tackle',hpBefore:100,hpAfter:75}];
 const frames=createTurnFrames(snapshot,events);
 assert.deepEqual(frames.map(frame=>[frame.actorId,frame.stage,frame.duration]),[['A-0','cast',1450],['A-0','impact',720],['B-0','cast',1450],['B-0','impact',720]]);
 assert.equal(frames[0].snapshot.opponent[0].hpPercent,100);
 assert.equal(frames[1].snapshot.opponent[0].hpPercent,61);
 assert.equal(frames[2].snapshot.own[0].hp,100);
 assert.equal(frames[3].snapshot.own[0].hp,75);
});

test('presentation timing retimes travel cues to contact without swallowing drain return travel',()=>{
 assert.equal(BATTLE_PRESENTATION_TIMING.cast,1450);assert.equal(BATTLE_PRESENTATION_TIMING.impact,720);
 const [projectile]=retimePresentationCues([{id:'projectile',type:'effect',anchor:'USER_TO_TARGET',at:210,duration:360}],'cast');
 assert.ok(projectile.at>210);assert.ok(projectile.at+projectile.duration>=1360);
 const [drain]=retimePresentationCues([{id:'drain-out',type:'effect',anchor:'USER_TO_TARGET',at:200,duration:240}],'cast');
 assert.ok(drain.at+drain.duration<1000,'drain-out must leave room for the explicit return cue');
});

test('impact HP rendering animates from the pre-hit value to the committed value',()=>{
 const html=renderPokemonHud({name:'Target'},{hpPercent:42,hpFromPercent:87});
 assert.match(html,/hp-committing/);assert.match(html,/--hp:42%/);assert.match(html,/--hp-from:87%/);
});

test('battle log drag controller clamps and preserves a normalized position across redraws',()=>{
 const title={setAttribute(){},setPointerCapture(){}};
 const panel={offsetWidth:200,offsetHeight:120,offsetLeft:700,offsetTop:30,classList:classList(),style:style(),dataset:{},querySelector:()=>title,closest:()=>stage,getBoundingClientRect:()=>({left:360,top:35,width:100,height:60})};
 const stage={clientWidth:1000,clientHeight:600,getBoundingClientRect:()=>({left:10,top:20,width:500,height:300})};
 title.closest=selector=>selector==='.pokemon-battle-log'?panel:null;
 const root={querySelector:selector=>selector==='.pokemon-battle-log'?panel:selector==='.pokemon-battle-stage'?stage:null};
 const controller=new BattleLogDragController();
 const target={closest:selector=>selector==='.pokemon-battle-log .aether-window-title'?title:null};
 assert.equal(controller.start({button:0,target,clientX:460,clientY:65,pointerId:7,preventDefault(){}},root),true);
 assert.equal(controller.move({pointerId:7,clientX:900,clientY:600,preventDefault(){}}),true);
 assert.equal(panel.style.getPropertyValue('--battle-log-left'),'800px');assert.equal(panel.style.getPropertyValue('--battle-log-top'),'480px');
 assert.equal(controller.end({pointerId:7}),true);controller.apply(root);assert.equal(panel.classList.contains('battle-log-dragged'),true);
 controller.reset(root);assert.equal(panel.classList.contains('battle-log-dragged'),false);
});

test('battle polish owns surrender confirmation, draggable log, and distinct weather/terrain layers',async()=>{
 const [client,modal,css,screen]=await Promise.all([readFile(new URL('../public/client.js',import.meta.url),'utf8'),readFile(new URL('../public/js/client-modal-templates.js',import.meta.url),'utf8'),readFile(new URL('../public/battle-presentation-polish.css',import.meta.url),'utf8'),readFile(new URL('../public/js/v3-battle-screen.js',import.meta.url),'utf8')]);
 assert.match(client,/requestBattleSurrender\(\)/);assert.match(client,/renderConfirmDialog/);assert.match(modal,/battle-confirm-modal/);assert.match(modal,/data-action="confirm-action"/);
 assert.match(client,/new BattleLogDragController/);assert.match(screen,/data-battle-log-draggable="true"/);
 for(const token of ['weather-rain','weather-sun','weather-sandstorm','weather-snow','terrain-electric','terrain-grassy','terrain-misty','terrain-psychic'])assert.match(css,new RegExp(token));
 assert.match(css,/hp-committing/);assert.match(css,/@keyframes v3-fx-travel/);
});

test('schema-3 receive path starts playback before drawing the authoritative final turn snapshot',async()=>{
 const client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');
 const lines=client.split('\n').filter(line=>line.includes('.playTurn('));
 assert.ok(lines.length>=3);
 for(const line of lines)assert.doesNotMatch(line,/draw\(\).*playTurn/);
});
