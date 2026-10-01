import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GameViewportScaler} from '../public/js/ui/core/game-viewport-scaler.js';

const css=fs.readFileSync(new URL('../public/pixel-era-ui.css',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../public/client.js',import.meta.url),'utf8');
const currentEntry=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const classicEntry=fs.readFileSync(new URL('../public/classic.html',import.meta.url),'utf8');
const classicCss=fs.readFileSync(new URL('../public/classic-ui.css',import.meta.url),'utf8');

function fakeEnv(width,height){
  const properties=new Map(),classes=new Set();
  return {
    properties,classes,
    windowLike:{innerWidth:width,innerHeight:height,addEventListener(){},removeEventListener(){}},
    documentLike:{
      documentElement:{style:{setProperty(key,value){properties.set(key,value);}}},
      body:{classList:{add(value){classes.add(value);}}},
    },
  };
}

test('R3-103 viewport scaler fits a fixed 1280x720 logical surface uniformly',()=>{
  const env=fakeEnv(1920,1080),scaler=new GameViewportScaler({windowLike:env.windowLike,documentLike:env.documentLike});
  const metrics=scaler.update();
  assert.equal(metrics.logicalWidth,1280);
  assert.equal(metrics.logicalHeight,720);
  assert.equal(metrics.scale,1.5);
  assert.equal(metrics.renderedWidth,1920);
  assert.equal(metrics.renderedHeight,1080);
  assert.equal(env.properties.get('--game-fit-scale'),'1.5');
  assert.ok(env.classes.has('resolution-locked'));
});

test('R3-103 viewport scaler letterboxes instead of changing composition on mismatched aspect ratios',()=>{
  const env=fakeEnv(1600,1000),scaler=new GameViewportScaler({windowLike:env.windowLike,documentLike:env.documentLike});
  const metrics=scaler.update();
  assert.equal(metrics.scale,1.25);
  assert.equal(metrics.renderedWidth,1600);
  assert.equal(metrics.renderedHeight,900);
  assert.equal(metrics.gutterX,0);
  assert.equal(metrics.gutterY,50);
});

test('R3-103 client installs the viewport scaler before rendering application state',()=>{
  const importPos=client.indexOf('game-viewport-scaler.js');
  const attachPos=client.indexOf('createGameViewportScaler().attach()');
  const storePos=client.indexOf('createBrowserStore(');
  assert.ok(importPos>=0);
  assert.ok(attachPos>importPos);
  assert.ok(attachPos<storePos);
});

test('R3-103 resolution lock owns the root surface and preserves desktop composition',()=>{
  for(const token of ['--game-logical-width:1280px','--game-logical-height:720px','--game-fit-scale:1','body.pixel-era.resolution-locked #app>.shell','translate(-50%,-50%) scale(var(--game-fit-scale))'])assert.ok(css.includes(token),`missing ${token}`);
  assert.match(css,/body\.pixel-era\.resolution-locked #app\{[\s\S]*?background:transparent;/,'viewport host must preserve the Pixel Era backdrop outside the locked surface');
  assert.doesNotMatch(css,/body\.pixel-era\.resolution-locked #app\{[\s\S]*?background:#071323;/,'resolution lock must not replace the viewport backdrop with flat black');
  assert.match(css,/resolution-locked \.pokemon-command-layout\{grid-template-columns:minmax\(230px,.8fr\) minmax\(390px,1.35fr\)!important/);
  assert.match(css,/resolution-locked \.v3-battle-arena\.format-double \.v2-side\{width:91%!important/);
  const modalRule=css.match(/body\.pixel-era\.resolution-locked #modal>\.modalback\{([\s\S]*?)\}/)?.[1]||'';
  assert.ok(modalRule.indexOf('inset:auto!important')<modalRule.indexOf('left:50%!important'),'modal inset must be reset before the centered coordinates are applied');
  assert.match(css,/font-size:calc\(12px \* var\(--game-fit-scale\)\)!important/,'toast size must override the earlier 8px important rule');
  assert.match(css,/resolution-locked #app>\.loading\{[\s\S]*?width:var\(--game-logical-width\)!important[\s\S]*?height:var\(--game-logical-height\)!important[\s\S]*?margin:0!important[\s\S]*?translate\(-50%,-50%\) scale\(var\(--game-fit-scale\)\)/,'loading must use the same centered 1280x720 fitted surface as the app shell');
  assert.match(css,/resolution-locked\[data-app-screen="home"\] \.content\{[\s\S]*?overflow-x:hidden;[\s\S]*?overflow-y:auto;/,'decorative Home artwork must not create a horizontal content scrollbar');
});

test('modal handling uses the shared focus manager and keeps backdrop close behavior',()=>{
  const manager=fs.readFileSync(new URL('../public/js/modal-focus-manager.js',import.meta.url),'utf8');
  for(const token of ['new ModalFocusManager()', 'function focusModal(){modalFocus.open();}', 'modalFocus.close()', 'modalFocus.handleTab(e)', "contains('modalback')"])assert.ok(client.includes(token),`missing ${token}`);
  for(const token of ['this.returnFocus = this.document.activeElement', 'previous?.isConnected', 'background.inert = true'])assert.ok(manager.includes(token),`focus manager missing ${token}`);
});

test('R3-103 no longer forces high-resolution artwork or battle GIFs through global nearest-neighbour scaling',()=>{
  const legacy=css.indexOf('body.pixel-era img,body.pixel-era canvas,body.pixel-era svg{image-rendering:pixelated}');
  const smooth=css.lastIndexOf('body.pixel-era img,\nbody.pixel-era svg,\nbody.pixel-era canvas{image-rendering:auto}');
  assert.ok(legacy>=0,'expected the R3-102 rule to remain documented in cascade');
  assert.ok(smooth>legacy,'smooth override must win later in the cascade');
  assert.match(css,/pokemon-key-art img,[\s\S]*image-rendering:auto!important/);
  assert.match(css,/pokemon-battle-stage \.v3-fighter \.art img\{[\s\S]*image-rendering:auto!important/);
});

test('alternate classic GBA interface is isolated from the current UI entry',()=>{
  assert.match(currentEntry,/<body class="pixel-era">/);
  assert.match(currentEntry,/href="\/pixel-era-ui\.css"/);
  assert.doesNotMatch(currentEntry,/classic-ui\.css|aether-gba/);
  assert.match(classicEntry,/<body class="aether-gba">/);
  assert.match(classicEntry,/href="\/classic-ui\.css"/);
  assert.doesNotMatch(classicEntry,/pixel-era-ui\.css/);
  assert.match(classicEntry,/src="\/client\.js"/,'alternate UI must keep the same functional client and server protocol');
});

test('alternate classic GBA interface keeps a fixed game surface and its own visual namespace',()=>{
  assert.match(classicCss,/body\.aether-gba\.resolution-locked #app>\.shell/);
  assert.match(classicCss,/translate\(-50%,-50%\) scale\(var\(--game-fit-scale\)\)/);
  assert.match(classicCss,/body\.aether-gba \.pokemon-battle-stage \.v3-battle-arena/);
  assert.match(classicCss,/body\.aether-gba \.pokedex-shell/);
  assert.match(classicCss,/body\.aether-gba \.summary-tabs/);
  assert.doesNotMatch(classicCss,/body\.pixel-era/,'the alternate theme must not mutate the current theme namespace');
});
