import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {presentationAsset,hasBespokeAsset,PRESENTATION_ASSET_IDS,PRESENTATION_ASSET_FALLBACK} from '../public/js/presentation-assets.js';
import {AudioManager} from '../public/js/audio-manager.js';
import {v3Catalog} from '../server/v3-catalog.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('../content-src/presentation-assets-v1.json',import.meta.url),'utf8'));

test('presentation asset manifest closes front, back and artwork paths for all 272 M-A entries',()=>{
 assert.equal(manifest.counts.selectable,272);assert.equal(manifest.counts.fallbackSafe,272);assert.equal(manifest.entries.length,272);assert.equal(new Set(manifest.entries.map(entry=>entry.id)).size,272);
 assert.equal(manifest.counts.front,272);assert.equal(manifest.counts.back,272);assert.equal(manifest.counts.artwork,272);assert.equal(PRESENTATION_ASSET_IDS.size,272);
 for(const entry of manifest.entries){assert.ok(entry.front.startsWith('/'));assert.ok(entry.back.startsWith('/'));assert.ok(entry.artwork.startsWith('/'));}
});

test('presentation asset resolver serves local files and keeps a safe unknown-id fallback',()=>{
 assert.equal(hasBespokeAsset('venusaur','front'),true);assert.equal(presentationAsset('venusaur','front'),'/pokemon-sprites/venusaur.gif');
 assert.equal(hasBespokeAsset('rotom-wash','front'),true);assert.match(presentationAsset('rotom-wash','front'),/^\/pokemon-sprites\/rotom-wash\.(gif|png)$/);
 assert.match(presentationAsset('rotom-wash','back'),/^\/pokemon-sprites\/back\/rotom-wash\.(gif|png)$/);assert.equal(presentationAsset('rotom-wash','artwork'),'/pokemon-artwork/rotom-wash.png');assert.equal(presentationAsset('not-in-regulation','front'),PRESENTATION_ASSET_FALLBACK);
});

test('every legal M-A Mega switches to its own complete presentation asset identity',()=>{
 for(const relation of v3Catalog.megaRelations){const form=v3Catalog.speciesById[relation.megaSpeciesId];assert.equal(form.spriteKey,form.id);for(const kind of ['front','back','artwork']){assert.equal(hasBespokeAsset(form.spriteKey,kind),true);assert.notEqual(presentationAsset(form.spriteKey,kind),PRESENTATION_ASSET_FALLBACK);}}
});

test('R3-99 synthesized audio manager persists mute/volume semantics without requiring external audio files',()=>{
 const settings={},changes=[];const audio=new AudioManager({settings,onSettingsChange:value=>changes.push({...value})});
 assert.equal(audio.enabled(),true);assert.equal(audio.volume(),.55);audio.setVolume(.4);assert.equal(settings.audioVolume,.4);audio.setEnabled(false);assert.equal(settings.audio,false);assert.equal(audio.enabled(),false);assert.ok(changes.length>=2);assert.doesNotThrow(()=>audio.semantic('special:mega-evolution'));
});

test('R3-99 settings and runtime wire semantic audio, fallback assets and accessibility polish',()=>{
 const client=fs.readFileSync(new URL('../public/client.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/r3-release-polish.css',import.meta.url),'utf8');
 assert.match(client,/new AudioManager/);assert.match(client,/data-audio-enabled/);assert.match(client,/data-audio-volume/);assert.match(client,/presentationAsset/);assert.match(html,/r3-release-polish\.css/);assert.match(css,/@media\(pointer:coarse\)/);assert.match(css,/prefers-reduced-motion/);
});

test('project logo is served and used by the app shell, loading screens, favicon and battle header',()=>{
 const logo=new URL('../public/logo.png',import.meta.url),client=fs.readFileSync(new URL('../public/client.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),classic=fs.readFileSync(new URL('../public/classic.html',import.meta.url),'utf8'),battle=fs.readFileSync(new URL('../public/js/v3-battle-screen.js',import.meta.url),'utf8');
 assert.ok(fs.statSync(logo).size>0);assert.match(html,/rel="icon" type="image\/png" href="\/logo\.png"/);assert.match(html,/class="brandmark project-logo"/);assert.match(classic,/class="brandmark project-logo"/);assert.match(client,/class="brandmark project-logo"/);assert.match(battle,/class="pokemon-game-logo" src="\/logo\.png"/);
});
