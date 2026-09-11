import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateV2Catalog} from '../scripts/validate-v2-catalog.mjs';

const load=async name=>JSON.parse(await readFile(new URL(`../content/${name}.json`,import.meta.url),'utf8'));
const fixture={contract:await load('catalog-contract'),identities:await load('species-identities'),species:await load('species'),moves:await load('moves'),abilities:await load('abilities'),items:await load('items')};

test('authored v2 catalog contains complete referenced gameplay content',()=>{
 assert.deepEqual(validateV2Catalog(fixture),[]);assert.equal(fixture.species.length,36);assert.equal(fixture.moves.length,48);assert.equal(fixture.abilities.length,24);assert.equal(fixture.items.filter(item=>item.id!=='none').length,12);
 for(const species of fixture.species){assert.ok(species.moveIds.length>=8);assert.ok(species.abilityIds.length>=2);assert.equal(Object.values(species.baseStats).reduce((a,b)=>a+b),480);}
});

test('v2 catalog rejects broken references, stat budgets and effect schemas',()=>{
 const bad=structuredClone(fixture);bad.species[0].moveIds[0]='missing-move';bad.species[1].baseStats.hp++;bad.moves[0].effects[0].chance=2;const errors=validateV2Catalog(bad).join('\n');assert.match(errors,/legal moves/);assert.match(errors,/totaling 480/);assert.match(errors,/chance/);
});
