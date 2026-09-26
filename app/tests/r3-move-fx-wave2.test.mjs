import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {moveFxProfile} from '../public/js/v3-move-fx-profile.js';
import {buildMovePresentationDefinition,presentationMigrationSummary,SIGNATURE_MOVE_IDS} from '../public/js/presentation/move-presentation-library.js';
import {SIGNATURE_MOVE_SPECS} from '../public/js/presentation/signature-move-specs.js';
import {AudioManager} from '../public/js/audio-manager.js';

const wave2=['ice-beam','psychic','moonblast','sludge-bomb','flash-cannon','air-slash','stone-edge','bug-buzz','dark-pulse','aura-sphere','hydro-pump','fire-blast','thunder','leaf-blade','iron-head','extreme-speed','blizzard','focus-blast','power-gem','will-o-wisp'];
const move=id=>publicV3Catalog.moves.find(entry=>entry.id===id);

test('R3-101 signature wave 2 promotes thirty moves while keeping zero legacy timelines',()=>{
 const migration=presentationMigrationSummary(publicV3Catalog.moves,moveFxProfile);
 assert.equal(SIGNATURE_MOVE_IDS.length,30);assert.equal(migration.signature,30);assert.equal(migration.template,460);assert.equal(migration.legacy,0);
 for(const id of wave2)assert.equal(migration.rows.find(row=>row.moveId===id)?.tier,'signature-timeline',id);
});

test('R3-101 signature catalog now covers all eighteen Pokémon move types',()=>{
 const types=new Set(publicV3Catalog.moves.filter(entry=>SIGNATURE_MOVE_IDS.includes(entry.id)).map(entry=>entry.type));
 assert.deepEqual([...types].sort(),['bug','dark','dragon','electric','fairy','fighting','fire','flying','ghost','grass','ground','ice','normal','poison','psychic','rock','steel','water']);
});

test('R3-101 wave 2 definitions use move-specific primitives and authoritative impact commits',()=>{
 for(const id of wave2){
  const mon=move(id),spec=SIGNATURE_MOVE_SPECS[id],profile=moveFxProfile(mon),cast=buildMovePresentationDefinition(mon,profile,{stage:'cast',targetCount:id==='blizzard'?2:1}),impact=buildMovePresentationDefinition(mon,profile,{stage:'impact',targetCount:id==='blizzard'?2:1});
  assert.equal(cast.template,`signature:${id}`,id);assert.equal(cast.tier,'signature-timeline',id);assert.ok(cast.cues.some(cue=>cue.primitive===spec.castPrimitive||cue.primitive===spec.chargePrimitive),id);assert.ok(impact.cues.some(cue=>cue.primitive===spec.impactPrimitive),id);assert.ok(impact.cues.some(cue=>cue.type==='commit'&&cue.commit==='authoritative-impact'),id);
 }
});

test('R3-101 status signature Will-O-Wisp does not fake a damaging target shake',()=>{
 const mon=move('will-o-wisp'),impact=buildMovePresentationDefinition(mon,moveFxProfile(mon),{stage:'impact',targetCount:1});
 assert.equal(impact.cues.some(cue=>cue.type==='actor'&&cue.primitive==='actor-shake'),false);assert.ok(impact.cues.some(cue=>cue.primitive==='ghost-flame'));
});

test('R3-101 semantic move audio is type-aware and gives signature cues a stronger envelope',()=>{
 const audio=new AudioManager({settings:{audio:true,audioVolume:.5}}),tones=[];audio.tone=async spec=>tones.push(spec);
 audio.semantic('move:fire:cast');audio.semantic('move:ice:cast');audio.semantic('move-signature:ice-beam:ice:cast');audio.semantic('move-signature:ice-beam:ice:impact');
 assert.equal(tones.length,4);assert.notEqual(tones[0].frequency,tones[1].frequency);assert.ok(tones[2].gain>tones[1].gain);assert.notEqual(tones[2].slide,tones[3].slide);
});

test('R3-101 CSS contains every new wave-2 presentation primitive',async()=>{
 const css=await fs.readFile(new URL('../public/v3-move-fx.css',import.meta.url),'utf8');
 const primitives=new Set(wave2.flatMap(id=>[SIGNATURE_MOVE_SPECS[id].castPrimitive,SIGNATURE_MOVE_SPECS[id].impactPrimitive,SIGNATURE_MOVE_SPECS[id].chargePrimitive]).filter(Boolean));
 for(const primitive of primitives)assert.match(css,new RegExp(`\\.fx-${primitive}`),primitive);
});
