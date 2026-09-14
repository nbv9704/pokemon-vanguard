import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateBetaReview} from '../content-import/beta-review.mjs';
import {publicV3Catalog,v3Catalog} from '../server/v3-catalog.mjs';
import {createLocalServer} from '../local-server.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [slice,review,manifest]=await Promise.all([json('../content-src/beta-slice-v16.json'),json('../content-src/beta-slice-v16-review.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/fetch-manifest.json')]);

test('scoped beta review is hash-bound and rejects stale source evidence',()=>{
 assert.deepEqual(validateBetaReview(review,slice,manifest),[]);
 const stale=structuredClone(manifest);stale.sources.find(source=>source.key==='moves').sha256='changed';assert.match(validateBetaReview(review,slice,stale).join('\n'),/source hash mismatch for moves/);
});

test('promoted schema-3 catalog exposes only the reviewed beta slice',()=>{
 assert.equal(v3Catalog.metadata.schemaVersion,3);assert.equal(v3Catalog.metadata.catalogVersion,'pv-ma-2026-09-12-beta2-beta-slice-v16-mega-beta-v1');assert.equal(v3Catalog.species.length,12);assert.equal(v3Catalog.megaForms.length,1);assert.equal(v3Catalog.moves.length,65);assert.equal(v3Catalog.abilities.length,17);assert.equal(v3Catalog.items.length,26);assert.equal(v3Catalog.starterTeamSpeciesIds.length,6);assert.equal(v3Catalog.regulations[0].megaCount,1);
 assert.equal(v3Catalog.coverage.singleSupported,true);assert.equal(v3Catalog.coverage.doubleSupported,true);assert.ok(v3Catalog.species.every(species=>Object.values(species.defaultBuild.statPoints).reduce((sum,value)=>sum+value,0)===66));
 assert.ok(v3Catalog.moves.every(move=>move.mechanics));assert.ok(publicV3Catalog.moves.every(move=>move.mechanics===undefined));assert.ok(publicV3Catalog.species.every(species=>species.regulationSets.includes('m-a')));
 assert.equal(v3Catalog.speciesById['venusaur-mega'].baseStats.def,123);assert.equal(v3Catalog.abilitiesById['thick-fat'].mechanics.handlers[0].id,'received-type-damage-reduction');assert.equal(publicV3Catalog.abilities.find(entry=>entry.id==='thick-fat').mechanics,undefined);
 assert.equal(v3Catalog.movesById['sunny-day'].mechanics.handlers.at(-1).id,'apply-weather');assert.equal(v3Catalog.abilitiesById.chlorophyll.mechanics.handlers[0].id,'weather-speed');assert.equal(v3Catalog.itemsById['damp-rock'].mechanics.handlers[0].id,'weather-duration');
 assert.equal(v3Catalog.movesById.tailwind.mechanics.handlers.at(-1).params.condition,'tailwind');assert.equal(v3Catalog.movesById.reflect.mechanics.handlers.at(-1).params.condition,'reflect');assert.equal(v3Catalog.itemsById['light-clay'].mechanics.handlers[0].id,'screen-duration');
 assert.equal(v3Catalog.movesById['grassy-terrain'].mechanics.handlers.at(-1).params.terrain,'grassy');assert.equal(v3Catalog.movesById['misty-terrain'].mechanics.handlers.at(-1).params.terrain,'misty');assert.equal(v3Catalog.itemsById['terrain-extender'].mechanics.handlers[0].id,'terrain-duration');assert.equal(v3Catalog.movesById.spikes.mechanics.handlers.at(-1).params.hazard,'spikes');assert.equal(v3Catalog.movesById['stealth-rock'].mechanics.handlers.at(-1).params.hazard,'stealth-rock');assert.equal(v3Catalog.movesById['toxic-spikes'].mechanics.handlers.at(-1).params.hazard,'toxic-spikes');
 assert.equal(v3Catalog.movesById['rapid-spin'].mechanics.handlers.find(handler=>handler.id==='cleanup-battlefield-effects').params.mode,'rapid-spin');assert.equal(v3Catalog.movesById.defog.mechanics.handlers.find(handler=>handler.id==='cleanup-battlefield-effects').params.mode,'defog');
 assert.equal(v3Catalog.movesById['wonder-room'].mechanics.priority,0);assert.equal(v3Catalog.movesById['wonder-room'].mechanics.handlers.at(-1).params.room,'wonder-room');assert.equal(v3Catalog.movesById['trick-room'],undefined);assert.equal(v3Catalog.movesById['magic-room'],undefined);
 assert.equal(v3Catalog.movesById.yawn.mechanics.handlers.at(-1).params.effect,'yawn');assert.equal(v3Catalog.movesById['perish-song'].mechanics.handlers.at(-1).params.effect,'perish-song');assert.equal(v3Catalog.movesById['perish-song'].mechanics.handlers.at(-1).params.turns,4);
 assert.equal(v3Catalog.movesById['solar-beam'].mechanics.handlers[0].id,'prepare-two-turn-move');assert.equal(v3Catalog.movesById['solar-blade'].mechanics.handlers.find(handler=>handler.id==='modify-charge-power').params.rainMultiplier,0.5);assert.equal(v3Catalog.movesById['hydro-cannon'].mechanics.handlers.at(-1).id,'apply-recharge');assert.equal(v3Catalog.movesById['giga-impact'].mechanics.contact,true);
 assert.equal(v3Catalog.movesById['hyper-voice'].mechanics.tags[0],'sound');assert.equal(v3Catalog.abilitiesById['solar-power'].mechanics.handlers[0].id,'weather-stat-boost');assert.equal(v3Catalog.abilitiesById['bulletproof'].mechanics.handlers[0].params.tag,'bullet');assert.equal(v3Catalog.abilitiesById['liquid-voice'].mechanics.handlers[0].params.type,'water');
 assert.equal(v3Catalog.movesById.waterfall.mechanics.secondaryEffects[0].volatile,'flinch');assert.equal(v3Catalog.movesById['ice-fang'].mechanics.secondaryEffects.length,2);assert.equal(v3Catalog.movesById.bulldoze.mechanics.secondaryEffects[0].boosts.spe,-1);assert.equal(v3Catalog.abilitiesById['sheer-force'].mechanics.handlers[0].id,'secondary-effect-power-boost');
 assert.equal(v3Catalog.itemsById.leftovers.mechanics.handlers[0].id,'item-end-turn-heal');assert.equal(v3Catalog.itemsById['sitrus-berry'].mechanics.handlers[0].id,'item-threshold-heal');assert.equal(v3Catalog.itemsById['focus-sash'].mechanics.handlers[0].id,'item-survive-lethal-hit');assert.equal(v3Catalog.itemsById['lum-berry'].mechanics.handlers[0].id,'item-status-cure');assert.deepEqual(v3Catalog.itemsById['lum-berry'].mechanics.handlers[0].params.statuses,['burn','paralysis','poison','sleep','freeze','bad-poison']);assert.equal(v3Catalog.itemsById['persim-berry'].mechanics.handlers[0].params.confusion,true);
 assert.equal(v3Catalog.movesById.dig.mechanics.handlers[0].params.semiInvulnerable,'underground');assert.equal(v3Catalog.movesById.fly.mechanics.handlers[0].params.semiInvulnerable,'airborne');assert.equal(v3Catalog.movesById.dive.mechanics.handlers[0].params.semiInvulnerable,'underwater');assert.equal(v3Catalog.movesById['phantom-force'].mechanics.handlers[0].params.semiInvulnerable,'vanished');assert.equal(v3Catalog.movesById['phantom-force'].mechanics.bypassesProtect,true);
});

test('local server serves the active schema-3 catalog as read-only data',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vanguard-v3-catalog-')),app=createLocalServer({saveDir:dir});try{const port=await app.listen(0),response=await fetch(`http://127.0.0.1:${port}/api/v3/catalog`),body=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(body.metadata.catalogVersion,v3Catalog.metadata.catalogVersion);assert.equal(body.species.length,12);}finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
