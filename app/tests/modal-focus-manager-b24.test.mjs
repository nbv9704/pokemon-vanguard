import test from 'node:test';
import assert from 'node:assert/strict';
import {ModalFocusManager} from '../public/js/modal-focus-manager.js';

function fixture() {
 const doc={activeElement:null};
 function node(name,visible=true) {
  const attrs=new Map(),element={name,hidden:false,isConnected:true,children:[{}],inert:false,
   hasAttribute:key=>attrs.has(key),getAttribute:key=>attrs.get(key)||null,
   setAttribute:(key,value)=>attrs.set(key,value),
   getClientRects:()=>visible?[{}]:[],
   closest:selector=>selector==='[inert]'&&background.inert?background:null,
   focus:()=>{doc.activeElement=element;}};
  return element;
 }
 const background=node('background'),original=node('original'),fallback=node('fallback');
 const first=node('first'),last=node('last'),hidden=node('hidden',false),dialog=node('dialog');
 const modal=node('modal');
 modal.querySelectorAll=()=>[first,hidden,last];
 modal.querySelector=()=>dialog;
 const nodes={'#modal':modal,'#app':background,'[aria-current="page"], [data-action="account-menu"], #app button, #app a[href]':fallback};
 doc.querySelector=selector=>nodes[selector]||null;
 doc.activeElement=original;
 return {manager:new ModalFocusManager({documentRef:doc}),doc,background,original,fallback,modal,first,last,hidden,dialog};
}
const flush=()=>new Promise(resolve=>queueMicrotask(resolve));
const tab=(manager,shiftKey=false)=>{const event={key:'Tab',shiftKey,prevented:false,preventDefault(){this.prevented=true;}};const result=manager.handleTab(event);return {result,event};};

test('modal activation inerts the game and traps forward/reverse Tab',async()=>{
 const f=fixture();f.manager.open();await flush();
 assert.equal(f.background.inert,true);assert.equal(f.doc.activeElement,f.first);
 f.last.focus();assert.equal(tab(f.manager).event.prevented,true);assert.equal(f.doc.activeElement,f.first);
 assert.equal(tab(f.manager,true).event.prevented,true);assert.equal(f.doc.activeElement,f.last);
});

test('hidden elements are skipped and an outside focus is recaptured',async()=>{
 const f=fixture();f.manager.open();await flush();f.original.focus();
 assert.equal(tab(f.manager).result,true);assert.equal(f.doc.activeElement,f.first);
 assert.deepEqual(f.manager.focusable(),[f.first,f.last]);
});

test('closing preserves an existing inert flag and restores original focus',async()=>{
 const f=fixture();f.background.inert=true;f.original.closest=()=>null;f.manager.open();await flush();
 f.manager.close();await flush();assert.equal(f.background.inert,true);assert.equal(f.doc.activeElement,f.original);
 assert.equal(tab(f.manager).result,false);
});

test('modal replacement retains first opener as return focus',async()=>{
 const f=fixture();f.manager.open();await flush();f.manager.open();await flush();
 f.manager.close();await flush();assert.equal(f.doc.activeElement,f.original);
});

test('disconnected return focus falls back to live game navigation',async()=>{
 const f=fixture();f.manager.open();await flush();f.original.isConnected=false;
 f.manager.close();await flush();assert.equal(f.background.inert,false);assert.equal(f.doc.activeElement,f.fallback);
});

test('empty modal focuses dialog fallback instead of allowing Tab to escape',async()=>{
 const f=fixture();f.modal.querySelectorAll=()=>[];f.manager.open();await flush();
 assert.equal(f.dialog.getAttribute('tabindex'),'-1');assert.equal(f.doc.activeElement,f.dialog);
 assert.equal(tab(f.manager).event.prevented,true);
});
