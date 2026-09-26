import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {movePresentationDefinition,presentationCoverage,presentationMigrationCoverage,createMovePresentationPlan} from '../public/js/presentation/move-presentation.js';
import {SIGNATURE_MOVE_IDS,WEATHER_MOVE_IDS,HAZARD_MOVE_IDS,MULTI_HIT_MOVE_IDS} from '../public/js/presentation/move-presentation-library.js';
import {validatePresentationDefinition} from '../public/js/presentation/presentation-schema.js';
import {renderV3BattleFx} from '../public/js/v3-move-fx.js';

const byId=id=>publicV3Catalog.moves.find(move=>move.id===id);

test('R3-95 migrates all active moves off the legacy presentation adapter while keeping complete coverage',()=>{
 const migration=presentationMigrationCoverage(publicV3Catalog.moves),coverage=presentationCoverage(publicV3Catalog.moves);
 assert.equal(coverage.length,490);assert.ok(migration.signature>=10);assert.equal(migration.signature+migration.template,490);assert.equal(migration.legacy,0);
 assert.ok(coverage.every(entry=>entry.commit&&entry.tier!=='legacy-adapter'));
});

test('R3-95 first signature wave contains ten iconic moves with move-specific timeline primitives',()=>{
 assert.ok(SIGNATURE_MOVE_IDS.length>=10);
 const expected={thunderbolt:'electric-bolt',flamethrower:'flame-stream',surf:'water-wave','solar-beam':'solar-flare','hyper-beam':'hyper-beam-core',protect:'shield',earthquake:'quake-ring','shadow-ball':'shadow-orb','close-combat':'combat-hit','dragon-pulse':'dragon-wave'};
 for(const [id,primitive] of Object.entries(expected)){
  const move=byId(id);assert.ok(move,id);const cast=movePresentationDefinition(move,{stage:'cast',targetCount:id==='surf'||id==='earthquake'?2:1}),impact=movePresentationDefinition(move,{stage:'impact',targetCount:id==='surf'||id==='earthquake'?2:1});
  assert.equal(cast.tier,'signature-timeline',id);assert.equal(cast.template,`signature:${id}`,id);assert.ok([...cast.cues,...impact.cues].some(cue=>cue.primitive===primitive),`${id}:${primitive}`);assert.ok(impact.cues.some(cue=>cue.type==='commit'&&cue.commit==='authoritative-impact'),id);
  assert.equal(validatePresentationDefinition(cast).ok,true,id);assert.equal(validatePresentationDefinition(impact).ok,true,id);
 }
});

test('R3-95 weather and hazard moves use field/side anchored parameterized templates',()=>{
 for(const id of WEATHER_MOVE_IDS){const plan=createMovePresentationPlan({stage:'cast',moveId:id,targetIds:['field']},publicV3Catalog);assert.equal(plan.template,'weather',id);assert.equal(plan.tier,'parameterized-template');assert.ok(plan.cues.some(cue=>cue.anchor==='FIELD_CENTER'&&cue.primitive==='weather-particle'),id);}
 for(const id of HAZARD_MOVE_IDS){const plan=createMovePresentationPlan({stage:'cast',moveId:id,targetIds:['field']},publicV3Catalog);assert.equal(plan.template,'hazard',id);assert.ok(plan.cues.some(cue=>cue.anchor==='TARGET_SIDE_CENTER'&&cue.primitive==='hazard'),id);}
});

test('R3-95 known multi-hit mechanics use the multi-hit timeline rather than generic physical impact',()=>{
 for(const id of MULTI_HIT_MOVE_IDS){const move=byId(id);assert.ok(move,id);const plan=movePresentationDefinition(move,{stage:'cast'});assert.equal(plan.template,'multi-hit',id);assert.ok(plan.cues.filter(cue=>cue.primitive==='pellet').length>=3,id);}
});

test('R3-95 signature spread rendering preserves per-target authoritative outcomes and slot anchors',()=>{
 const snapshot={format:'double',own:[{actorId:'A-0',activeSlot:0},{actorId:'A-1',activeSlot:1}],opponent:[{actorId:'B-0',activeSlot:0},{actorId:'B-1',activeSlot:1}]};
 const html=renderV3BattleFx({stage:'impact',snapshot,actorId:'B-0',moveId:'surf',targetIds:['A-0','A-1'],events:[{kind:'damage',targetId:'A-0'},{kind:'moveMissed',targetId:'A-1'}]},publicV3Catalog);
 assert.match(html,/data-presentation-tier="signature-timeline"/);assert.match(html,/data-presentation-template="signature:surf"/);assert.match(html,/fx-outcome-hit[^>]*data-fx-target="A-0"/);assert.match(html,/fx-outcome-miss[^>]*data-fx-target="A-1"/);assert.match(html,/--end-x:18%;--end-y:77%/);assert.match(html,/--end-x:43%;--end-y:69%/);
});

test('R3-95 renderer honors static USER/TARGET/FIELD and reverse TARGET_TO_USER anchor semantics',()=>{
 const snapshot={format:'single',own:[{actorId:'A-0',activeSlot:0}],opponent:[{actorId:'B-0',activeSlot:0}]};
 const drain=renderV3BattleFx({stage:'cast',snapshot,actorId:'A-0',moveId:'giga-drain',targetIds:['B-0'],events:[]},publicV3Catalog);
 assert.match(drain,/data-presentation-anchor="TARGET_TO_USER"/);assert.match(drain,/--start-x:78%;--start-y:25%;--end-x:22%;--end-y:76%/);
 const protect=renderV3BattleFx({stage:'cast',snapshot,actorId:'A-0',moveId:'protect',targetIds:['A-0'],events:[]},publicV3Catalog);
 assert.match(protect,/data-presentation-anchor="USER_CENTER"/);assert.match(protect,/--start-x:22%;--start-y:76%;--end-x:22%;--end-y:76%/);
});

test('R3-95 coverage report records signature/template/legacy counts explicitly',async()=>{
 const report=JSON.parse(await readFile(new URL('../../docs/r7-move-fx-coverage.json',import.meta.url),'utf8'));
 assert.ok(report.presentationSummary.signatureMoveCount>=10);assert.equal(report.presentationSummary.signatureMoveCount+report.presentationSummary.parameterizedMoveCount,490);assert.equal(report.presentationSummary.legacyMoveCount,0);
 assert.ok(report.presentationSummary.tierCounts['signature-timeline']>=10);assert.equal(report.presentationSummary.tierCounts['signature-timeline']+report.presentationSummary.tierCounts['parameterized-template'],490);
});

test('R3-95 schema rejects cues whose duration would bleed into the next presentation frame',()=>{
 const invalid={id:'overflow',duration:100,cues:[{id:'late',type:'effect',at:80,duration:30,primitive:'orb'}]};
 assert.deepEqual(validatePresentationDefinition(invalid),{ok:false,error:'cue late exceeds definition duration'});
 for(const move of publicV3Catalog.moves)for(const stage of ['cast','impact']){const plan=movePresentationDefinition(move,{stage,targetCount:2});assert.equal(validatePresentationDefinition(plan).ok,true,`${move.id}:${stage}`);}
});

test('R3-95 CSS ships dedicated primitives for all first-wave signature visuals',async()=>{
 const css=await readFile(new URL('../public/v3-move-fx.css',import.meta.url),'utf8');
 for(const primitive of ['electric-bolt','flame-stream','water-wave','solar-flare','hyper-beam-core','quake-ring','shadow-orb','combat-hit','dragon-wave'])assert.match(css,new RegExp(`\\.fx-${primitive}`),primitive);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
