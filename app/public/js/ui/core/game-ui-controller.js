import {InputAction,InputManager} from './input-manager.js';
import {FocusManager} from './focus-manager.js';
import {UiModeStack} from './ui-mode-stack.js';

const directional=new Set([InputAction.UP,InputAction.DOWN,InputAction.LEFT,InputAction.RIGHT]);
export class GameUiController{
 constructor({root=()=>null,initialMode='HOME',onCancel=()=>false,onAction=()=>false}={}){
  this.root=root;this.focus=new FocusManager();this.modes=new UiModeStack(initialMode);this.onCancel=onCancel;this.onAction=onAction;
  this.input=new InputManager({onAction:(action,source)=>this.handleAction(action,source)});
 }
 setMode(mode){if(this.modes.current!==mode){this.modes.replace(mode);this.focus.clear();}return mode;}
 handleKeyboard(event){const handled=this.input.handleKeyboard(event);if(handled)event?.preventDefault?.();return handled;}
 handleAction(action,source){
  const root=this.root?.();if(!root)return false;
  if(directional.has(action))return this.focus.move(root,action);
  if(action===InputAction.CONFIRM)return this.focus.activate(root);
  if(action===InputAction.CANCEL)return this.onCancel(this.modes.current,source)===true;
  return this.onAction(action,this.modes.current,source)===true;
 }
 ensureFocus(){const root=this.root?.();return root?this.focus.ensure(root):false;}
}
