import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/pixel-era-ui.css',import.meta.url),'utf8');

test('R3-102 pixel stylesheet is the final presentation override',()=>{
 assert.match(html,/<body class="pixel-era">/);
 const pixel=html.indexOf('/pixel-era-ui.css');
 const polish=html.indexOf('/r3-release-polish.css');
 assert.ok(pixel>polish,'pixel era stylesheet must load after release polish');
 assert.match(html,/theme-color" content="#132c4b"/);
});

test('R3-102 locks the Gen III inspired pixel grammar',()=>{
 for(const token of ['--pixel-font','image-rendering:pixelated','border-radius:0','--pixel-yellow','pixel-cursor'])assert.ok(css.includes(token),`missing ${token}`);
 assert.match(css,/\.shell\{[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.sidebar\{[\s\S]*grid-template-columns:auto minmax\(0,1fr\) auto/);
});

test('R3-102 battle is authored as a low-resolution-style 16:9 game surface',()=>{
 assert.match(css,/pokemon-battle-stage \.v3-battle-arena\{[\s\S]*aspect-ratio:16\/9/);
 assert.match(css,/pokemon-bottom-command-window[\s\S]*border-radius:0/);
 assert.match(css,/pokemon-hud[\s\S]*border-radius:0/);
 assert.match(css,/pokemon-hp-fill[\s\S]*steps\(8,end\)/);
});

test('R3-102 management screens share the same pixel window language',()=>{
 for(const token of ['.summary-console-head','.pokedex-index-head','.ranch-index-head','.party-slot','.pokedex-entry','.ranch-offer'])assert.ok(css.includes(token),`missing ${token}`);
 assert.match(css,/summary-tab\.selected[\s\S]*#fff0a6/);
});

test('R3-102 adds no external font or runtime URL dependency',()=>{
 assert.doesNotMatch(css,/@import\s+url/i);
 assert.doesNotMatch(css,/@font-face/i);
 assert.doesNotMatch(css,/https?:\/\//i);
});
