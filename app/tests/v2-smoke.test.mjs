import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const names = ['V2_submitCommands', 'V2_resolveTurn', 'V2_assertBattleInvariants'];
const source = await readFile(new URL('../src/logic.js', import.meta.url), 'utf8');
const engine = await import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport {${names.join(',')}}`).toString('base64')}`);
const ids = ['strike-1', 'strike-2', 'strike-3', 'strike-4'];
const moves = Object.fromEntries(ids.map(id => [id, {id, name: id, type: 'Flame', category: 'physical', power: 60, accuracy: 100, maxPP: 20, priority: 0, targetMode: 'foe', contact: true}]));

function mon(id, side) {
  return {battleMonId: id, ownerSide: side, speciesId: id, types: ['Flame'], stats: {hp: 200, atk: 100, def: 100, spa: 100, spd: 100, spe: 100}, hp: 200, pp: Object.fromEntries(ids.map(moveId => [moveId, 20])), status: null, stages: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0}, volatiles: {}, itemState: {used: false}, buildSnapshot: {moveIds: ids, abilityId: 'tailwind', itemId: 'none'}};
}

function create(seed) {
  return {id: `smoke-${seed}`, phase: 'COMMAND', phaseRevision: 1, turn: 1, activeCount: 1, rngState: seed, eventSequence: 0, events: [], result: null, rewardReceipts: [], pending: {}, queue: [], field: {weather: null, terrain: null, sides: {A: {tailwind: 0, barrier: 0}, B: {tailwind: 0, barrier: 0}}}, sides: {A: {roster: [mon('A0', 'A')], active: ['A0']}, B: {roster: [mon('B0', 'B')], active: ['B0']}}};
}

function run(seed) {
  let battle = create(seed), loops = 0;
  while (battle.phase !== 'FINISHED' && loops++ < 100) {
    const moveId = ids.find(id => battle.sides.A.roster[0].pp[id] > 0) || 'struggle';
    const a = engine.V2_submitCommands(battle, 'A', [{kind: 'move', actorId: 'A0', moveId, target: {side: 'B', slot: 0}}], moves);
    const b = engine.V2_submitCommands(a.battle, 'B', [{kind: 'move', actorId: 'B0', moveId, target: {side: 'A', slot: 0}}], moves);
    const result = engine.V2_resolveTurn(b.battle, moves); battle = result.battle;
    engine.V2_assertBattleInvariants(battle);
  }
  assert.equal(battle.phase, 'FINISHED'); assert.ok(battle.turn <= 100); return battle;
}

test('1,000 seeded battles finish deterministically without invariant failures', () => {
  const samples = new Map();
  for (let seed = 1; seed <= 1000; seed++) {
    const result = run(seed);
    if (seed <= 25) samples.set(seed, JSON.stringify(result));
  }
  for (const [seed, expected] of samples) assert.equal(JSON.stringify(run(seed)), expected);
});
