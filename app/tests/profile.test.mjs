import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRouter} from '../public/js/router.js';
import {ProfileView} from '../public/js/profile-view.js';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {profileView} from '../server/profile-view.mjs';
import {recordMissionEvent} from '../server/missions.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

function state(){return {schemaVersion:3,seed:1,wins:3,badges:[0,1],wallet:{coins:5000,crystals:1200,recruitmentTickets:4},progressionV3:createV3BetaProgression(v3Catalog)};}

test('Profile is a dedicated route and no longer aliases Settings',async()=>{
 const router=createRouter();assert.equal(router.go('bag'),true);assert.equal(router.current,'bag');assert.equal(router.go('profile'),true);assert.equal(router.current,'profile');assert.equal(router.go('settings'),true);assert.equal(router.current,'settings');
 const client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');assert.match(client,/if\(a==="bag"\|\|a==="profile"\|\|a==="friends"\|\|a==="settings"\).*router\.go\(a\)/s);assert.doesNotMatch(client,/a==="profile"\|\|a==="settings"[\s\S]{0,120}router\.go\('settings'\)/);
});

test('Profile projection exposes authoritative account progression summary',()=>{
 const adventure=state();recordMissionEvent(adventure,'battles',12,Date.UTC(2026,8,22));recordMissionEvent(adventure,'wins',7,Date.UTC(2026,8,22));recordMissionEvent(adventure,'megaEvolutions',4,Date.UTC(2026,8,22));
 const view=profileView(adventure,v3Catalog,{serverNow:Date.UTC(2026,8,22)});assert.equal(view.schemaVersion,1);assert.equal(view.regulation,'M-A');assert.equal(view.stats.battles,12);assert.equal(view.stats.wins,10);assert.ok(view.stats.ownedPokemon>0);assert.ok(view.stats.totalPokemon>=213);assert.ok(view.stats.totalItems>=100);assert.equal(view.stats.badges,2);assert.equal(view.activeTeam.members.length,6);assert.equal(view.achievements.total,6);assert.equal(view.ranked.rating,1000);assert.equal(view.ranked.tier,'Poké Ball');assert.equal(view.ranked.tierAsset,'/ranks/pokeball.png');
});

test('Profile UI renders account identity, active team, stats and achievement links',()=>{
 const adventure=state(),projection=profileView(adventure,v3Catalog,{serverNow:Date.UTC(2026,8,22)}),screen=new ProfileView(),html=screen.render({profileV1:projection},{name:'Vanguard Test',provider:'discord',avatar:'https://example.com/avatar.png'},{connected:true});
 assert.match(html,/Vanguard Test/);assert.match(html,/Discord ACCOUNT/);assert.match(html,/ADVENTURE SAVE/);assert.match(html,/SAVED/);assert.match(html,/ACTIVE BATTLE TEAM/);assert.match(html,/data-action="nav:teams"/);assert.match(html,/ACHIEVEMENT PROGRESS/);assert.match(html,/data-action="nav:missions"/);assert.match(html,/data-action="settings"/);assert.match(html,/profile-team-portrait/);assert.match(html,/RANKED Poké Ball · 1000 RP/);assert.match(html,/src="\/ranks\/pokeball\.png"/);assert.match(html,/Next: Great Ball at 1200 RP/);
});

test('Profile stylesheet is scoped for pixel-era geometry',async()=>{
 const css=await readFile(new URL('../public/profile.css',import.meta.url),'utf8'),index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.match(index,/href="\/profile\.css"/);assert.match(css,/body\.pixel-era \.trainer-profile-shell/);assert.match(css,/\.trainer-profile-stats/);assert.match(css,/\.profile-team-members/);assert.match(css,/profile-team-portrait\{[^}]*overflow:hidden/);assert.match(css,/object-fit:contain/);assert.match(css,/trainer-profile-rank/);
 const source=await readFile(new URL('../public/js/profile-view.js',import.meta.url),'utf8');assert.match(source,/hasBespokeAsset\(id,'artwork'\)/);assert.match(source,/presentationAsset\(id,'artwork'\)/);
});
