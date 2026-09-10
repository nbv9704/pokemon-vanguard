import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, checkContent } from '../scripts/check-content.mjs';

const contract = JSON.parse(await readFile(new URL('../content/catalog-contract.json', import.meta.url), 'utf8'));
const species = JSON.parse(await readFile(new URL('../content/species-identities.json', import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

test('catalog identity contract accepts the checked-in 36-species mapping', async () => {
  assert.deepEqual(validateContent(contract, species), []);
  assert.deepEqual(await checkContent(), { species:36, singleType:12, types:12 });
});

test('catalog validation rejects duplicate IDs and invalid single/dual types', () => {
  const invalid = clone(species);
  invalid[1].id = invalid[0].id;
  invalid[2].types = ['Flame', 'Flame'];
  invalid[3].types = [];
  const problems = validateContent(contract, invalid).join('\n');
  assert.match(problems, /duplicate species id/);
  assert.match(problems, /one or two different types/);
  assert.match(problems, /expected 12 single-type species/);
});

test('catalog validation rejects unsupported enums and coverage types', () => {
  const badContract = clone(contract);
  badContract.effectKinds.push('executeArbitraryCode');
  const invalid = clone(species);
  invalid[0].coverageType = 'Unknown';
  const problems = validateContent(badContract, invalid).join('\n');
  assert.match(problems, /effectKinds/);
  assert.match(problems, /coverageType is unsupported/);
});

