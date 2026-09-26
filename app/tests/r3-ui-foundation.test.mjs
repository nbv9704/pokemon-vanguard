import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InputAction,InputManager,actionFromGamepadButton,actionFromKeyboard} from '../public/js/ui/core/input-manager.js';
import {UiModeStack} from '../public/js/ui/core/ui-mode-stack.js';
import {chooseDirectionalTarget,FocusManager} from '../public/js/ui/core/focus-manager.js';
import {GameUiController} from '../public/js/ui/core/game-ui-controller.js';
import {renderAetherWindow,renderMessageBox,renderPokemonHud} from '../public/js/ui/primitives/pokemon-ui.js';

const keyboard=(code,target={tagName:'DIV'})=>({code,target,prevented:false,preventDefault(){this.prevented=true;}});

test('R3-92 input abstraction maps Pokémon-style keyboard and gamepad actions without hijacking text inputs',()=>{
 assert.equal(actionFromKeyboard(keyboard('ArrowUp')),InputAction.UP);
 assert.equal(actionFromKeyboard(keyboard('KeyZ')),InputAction.CONFIRM);
 assert.equal(actionFromKeyboard(keyboard('KeyX')),InputAction.CANCEL);
 assert.equal(actionFromKeyboard(keyboard('Backspace')),InputAction.CANCEL);
 assert.equal(actionFromKeyboard(keyboard('KeyZ',{tagName:'INPUT'})),null);
 assert.equal(actionFromKeyboard(keyboard('Backspace',{tagName:'INPUT'})),null);
 assert.equal(actionFromKeyboard(keyboard('KeyX',{tagName:'INPUT'})),null);
 assert.equal(actionFromKeyboard(keyboard('Escape',{tagName:'INPUT'})),InputAction.CANCEL);
 assert.equal(actionFromGamepadButton(0),InputAction.CONFIRM);
 assert.equal(actionFromGamepadButton(1),InputAction.CANCEL);
 assert.equal(actionFromGamepadButton(15),InputAction.RIGHT);
 const seen=[],input=new InputManager({onAction:action=>{seen.push(action);return true;}}),event=keyboard('Enter');
 assert.equal(input.handleKeyboard(event),true);assert.deepEqual(seen,[InputAction.CONFIRM]);
});

test('R3-92 UI mode stack supports overlay push/pop and deterministic reset',()=>{
 const changes=[],modes=new UiModeStack('HOME',{onChange:stack=>changes.push(stack)});
 assert.equal(modes.current,'HOME');modes.push('BATTLE_COMMAND');modes.push('DIALOG');assert.equal(modes.current,'DIALOG');assert.equal(modes.depth,3);
 assert.equal(modes.pop(),'BATTLE_COMMAND');modes.replace('BATTLE_MOVE_SELECT');assert.equal(modes.current,'BATTLE_MOVE_SELECT');modes.reset('HOME');assert.deepEqual(modes.snapshot(),['HOME']);assert.ok(changes.length>=4);
});

test('R3-92 focus navigation follows grid coordinates, skips disabled choices and wraps safely',()=>{
 const entries=[{id:'a',row:0,col:0},{id:'b',row:0,col:1,disabled:true},{id:'c',row:1,col:0},{id:'d',row:1,col:1}];
 assert.equal(chooseDirectionalTarget(entries,'a',InputAction.RIGHT),'d');
 assert.equal(chooseDirectionalTarget(entries,'a',InputAction.DOWN),'c');
 assert.equal(chooseDirectionalTarget(entries,'c',InputAction.UP),'a');
 assert.equal(chooseDirectionalTarget(entries,'a',InputAction.LEFT),'d');
});

test('R3-92 DOM focus manager and controller preserve one focus model for arrows and confirm',()=>{
 const clicks=[],doc={activeElement:null},make=(id,row,col)=>({dataset:{uiFocusId:id,uiRow:String(row),uiCol:String(col)},disabled:false,classList:{add(){}},focus(){doc.activeElement=this;},click(){clicks.push(id);}}),a=make('a',0,0),b=make('b',0,1),root={ownerDocument:doc,querySelectorAll(){return [a,b];}},focus=new FocusManager();
 assert.equal(focus.move(root,InputAction.RIGHT),true);assert.equal(doc.activeElement,a);assert.equal(focus.move(root,InputAction.RIGHT),true);assert.equal(doc.activeElement,b);assert.equal(focus.activate(root),true);assert.deepEqual(clicks,['b']);
 const controller=new GameUiController({root:()=>root,initialMode:'BATTLE_COMMAND'}),event=keyboard('ArrowLeft');assert.equal(controller.handleKeyboard(event),true);assert.equal(event.prevented,true);assert.equal(doc.activeElement,a);
});

test('R3-92 Pokémon UI primitives escape content and render reusable window, message and HP contracts',()=>{
 const windowHtml=renderAetherWindow({title:'Fight <now>',body:'<button>Move</button>',variant:'command'});assert.match(windowHtml,/aether-window-command/);assert.match(windowHtml,/Fight &lt;now&gt;/);assert.match(windowHtml,/<button>Move<\/button>/);
 const message=renderMessageBox({title:'Mega Evolution',message:'Form updated.'});assert.match(message,/aether-message-box/);assert.match(message,/aria-live="polite"/);
 const hud=renderPokemonHud({name:'A < B'},{own:true,hpPercent:19.6,status:'burn',mega:true});assert.match(hud,/pokemon-hud-player/);assert.match(hud,/A &lt; B/);assert.match(hud,/MEGA/);assert.match(hud,/20% · burn/);assert.match(hud,/pokemon-hp-fill low/);
});
