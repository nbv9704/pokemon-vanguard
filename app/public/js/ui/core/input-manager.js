export const InputAction=Object.freeze({
 UP:'UP',DOWN:'DOWN',LEFT:'LEFT',RIGHT:'RIGHT',CONFIRM:'CONFIRM',CANCEL:'CANCEL',MENU:'MENU',DETAIL:'DETAIL',PAGE_LEFT:'PAGE_LEFT',PAGE_RIGHT:'PAGE_RIGHT',FAST_FORWARD:'FAST_FORWARD',SKIP:'SKIP'
});

const codeMap=new Map([
 ['ArrowUp',InputAction.UP],['KeyW',InputAction.UP],
 ['ArrowDown',InputAction.DOWN],['KeyS',InputAction.DOWN],
 ['ArrowLeft',InputAction.LEFT],['KeyA',InputAction.LEFT],
 ['ArrowRight',InputAction.RIGHT],['KeyD',InputAction.RIGHT],
 ['Enter',InputAction.CONFIRM],['Space',InputAction.CONFIRM],['KeyZ',InputAction.CONFIRM],
 ['Escape',InputAction.CANCEL],['Backspace',InputAction.CANCEL],['KeyX',InputAction.CANCEL],
 ['KeyC',InputAction.DETAIL],['KeyM',InputAction.MENU],
 ['KeyQ',InputAction.PAGE_LEFT],['KeyE',InputAction.PAGE_RIGHT],
 ['BracketLeft',InputAction.PAGE_LEFT],['BracketRight',InputAction.PAGE_RIGHT]
]);

const editableTag=tag=>['INPUT','TEXTAREA','SELECT','OPTION'].includes(String(tag||'').toUpperCase());
export function isEditableTarget(target){return !!target&&(editableTag(target.tagName)||target.isContentEditable===true);}
export function actionFromKeyboard(event){
 if(!event||event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey)return null;
 const action=codeMap.get(event.code)||null;
 if(!action)return null;
 if(isEditableTarget(event.target)&&event.code!=='Escape')return null;
 return action;
}

export function actionFromGamepadButton(index){
 return ({0:InputAction.CONFIRM,1:InputAction.CANCEL,4:InputAction.PAGE_LEFT,5:InputAction.PAGE_RIGHT,8:InputAction.MENU,9:InputAction.MENU,12:InputAction.UP,13:InputAction.DOWN,14:InputAction.LEFT,15:InputAction.RIGHT})[index]||null;
}

export class InputManager{
 constructor({onAction=()=>false}={}){this.onAction=onAction;this.enabled=true;}
 setEnabled(value){this.enabled=!!value;}
 handleKeyboard(event){if(!this.enabled)return false;const action=actionFromKeyboard(event);return action?this.dispatch(action,event):false;}
 dispatch(action,source=null){return this.onAction(action,source)===true;}
}
