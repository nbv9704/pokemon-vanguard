import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AccessibilityController,routeLabel} from '../public/js/accessibility-controller.js';
import {createRouter} from '../public/js/router.js';
import {renderClientShell} from '../public/js/client-shell-layout.js';
import {renderSettingsPage} from '../public/js/client-chrome-views.js';
import {validateAccessibilitySources} from '../scripts/validate-accessibility-b37.mjs';

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const focusable=name=>({name,disabled:false,focus(){this.focused=true;}});

test('router announces only real route changes and route labels are stable',()=>{
 const changes=[],router=createRouter('home',{onChange:route=>changes.push(route)});
 assert.equal(router.go('home'),true);assert.deepEqual(changes,[]);
 assert.equal(router.go('settings'),true);assert.equal(router.go('invalid'),false);
 assert.deepEqual(changes,['settings']);assert.equal(routeLabel('settings'),'Settings');assert.equal(routeLabel('invalid'),'Vanguard');
});

test('route focus runs once after navigation and never steals focus on background redraw',()=>{
 const main=focusable('main'),documentRef={title:'',querySelector:selector=>selector==='#main-content'?main:null};
 const controller=new AccessibilityController({documentRef});
 assert.equal(controller.afterRender('home'),false);assert.equal(main.focused,undefined);assert.equal(documentRef.title,'Pokémon Vanguard · Home');
 controller.routeChanged('shop');assert.equal(controller.afterRender('shop'),true);assert.equal(main.focused,true);
 main.focused=false;assert.equal(controller.afterRender('shop'),false);assert.equal(main.focused,false);
});

test('account menu supports arrows, endpoints, tab close and escape return focus',()=>{
 const trigger=focusable('trigger'),items=[focusable('one'),focusable('two'),focusable('three')],menu={hidden:false,querySelectorAll:()=>items};
 const documentRef={activeElement:items[0],querySelector:selector=>selector==='#account-dropdown'?menu:trigger};
 const controller=new AccessibilityController({documentRef});let closed=0,prevented=0;
 assert.equal(controller.handleMenuKey({key:'ArrowUp',preventDefault:()=>prevented++},{onClose:()=>closed++}),true);assert.equal(items[2].focused,true);
 documentRef.activeElement=items[2];controller.handleMenuKey({key:'Home',preventDefault:()=>prevented++});assert.equal(items[0].focused,true);
 assert.equal(controller.handleMenuKey({key:'Tab'},{onClose:()=>closed++}),false);assert.equal(closed,1);
 controller.handleMenuKey({key:'Escape',preventDefault:()=>prevented++},{onClose:()=>closed++});assert.equal(trigger.focused,true);assert.equal(closed,2);assert.equal(prevented,3);
});

test('game shell exposes landmarks, current route, live status and persistent storage warning',()=>{
 const args={page:'mail',pageLabel:'Mailbox',V:{coins:1,gems:2,socialV1:{},trainingPvpV1:{},missions:{}},navs:[['home','/home.png','Home'],['mail','/mail.png','Mailbox']],esc,auth:null,content:'<h1>Mail</h1>',footerSummary:'summary',immersiveBattle:false,commerceBanner:()=>'',connectionLabel:()=>'ONLINE',unreadMailCount:()=>2,accountControl:()=>'',storagePersistent:false};
 const html=renderClientShell(args);assert.match(html,/Skip to main content/);assert.match(html,/id="main-content" tabindex="-1" aria-label="Mailbox screen"/);assert.match(html,/data-action="nav:mail" aria-current="page"/);assert.match(html,/aria-live="polite"/);assert.match(html,/Temporary browser session/);assert.match(html,/2 unread messages/);
 const battle=renderClientShell({...args,page:'battle',pageLabel:'Arena',immersiveBattle:true});assert.match(battle,/aria-label="Arena screen"/);assert.match(battle,/storage-warning/);
});

test('settings always discloses whether browser identity survives reload',()=>{
 const common={settings:{},auth:null,connected:true,esc,head:()=>'',btn:()=>'<button></button>'};
 assert.match(renderSettingsPage({...common,persistent:true}),/Persistent/);
 const temporary=renderSettingsPage({...common,persistent:false});assert.match(temporary,/storage-setting-warning/);assert.match(temporary,/will reset after reload/);
});

test('accessibility source contract catches a removed invariant',()=>{
 assert.deepEqual(validateAccessibilitySources(),[]);
 const errors=validateAccessibilitySources(file=>file==='public/admin.html'?'<html></html>':new URL(`../${file}`,import.meta.url) && requireText(file));
 assert.ok(errors.some(error=>error.includes('public/admin.html')));
});

function requireText(file){return fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');}
