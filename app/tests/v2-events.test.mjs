import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const names = [
  'V2_submitCommands', 'V2_resolveTurn', 'V2_validateEvent', 'V2_commitEvents', 'V2_eventLogLine',
  'V2_logPage', 'V2_projectEvent', 'V2_toAnimationEvents', 'V2_assertBattleInvariants'
];
const source = await readFile(new URL('../src/logic.js', import.meta.url), 'utf8');
const engine = await import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport {${names.join(',')}}`).toString('base64')}`);

const moves = Object.fromEntries(['hit-a', 'hit-b', 'hit-c', 'hit-d'].map((id, index) => [id, {
  id, name: `Test Strike ${index}`, type: 'Flame', category: 'physical', power: 60,
  accuracy: 100, maxPP: 20, priority: 0, targetMode: 'foe', contact: true
}]));

function mon(id, side) {
  return {
    battleMonId: id, ownerSide: side, speciesId: `species-${id}`, types: ['Flame'],
    stats: {hp: 200, atk: 100, def: 100, spa: 100, spd: 100, spe: 100}, hp: 200,
    pp: {'hit-a': 20, 'hit-b': 20, 'hit-c': 20, 'hit-d': 20}, status: null,
    stages: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0}, volatiles: {}, itemState: {used: false},
    buildSnapshot: {moveIds: ['hit-a', 'hit-b', 'hit-c', 'hit-d'], abilityId: 'tailwind', itemId: 'none'}
  };
}

function fixture(seed = 1) {
  return {
    id: `event-fixture-${seed}`, phase: 'COMMAND', phaseRevision: 1, turn: 1,
    activeCount: 1, rngState: seed, eventSequence: 0, events: [], result: null,
    rewardReceipts: [], pending: {}, queue: [],
    field: {weather: null, terrain: null, sides: {A: {tailwind: 0, barrier: 0}, B: {tailwind: 0, barrier: 0}}},
    sides: {A: {roster: [mon('A0', 'A')], active: ['A0']}, B: {roster: [mon('B0', 'B')], active: ['B0']}}
  };
}

function resolveOneTurn(battle) {
  const a = engine.V2_submitCommands(battle, 'A', [{kind: 'move', actorId: 'A0', moveId: 'hit-a', target: {side: 'B', slot: 0}}], moves);
  const b = engine.V2_submitCommands(a.battle, 'B', [{kind: 'move', actorId: 'B0', moveId: 'hit-a', target: {side: 'A', slot: 0}}], moves);
  return engine.V2_resolveTurn(b.battle, moves);
}

test('turn resolution emits ordered unique events without mutating input', () => {
  const battle = fixture(7), before = JSON.stringify(battle);
  const submittedA = engine.V2_submitCommands(battle, 'A', [{kind: 'move', actorId: 'A0', moveId: 'hit-a', target: {side: 'B', slot: 0}}], moves);
  const submittedB = engine.V2_submitCommands(submittedA.battle, 'B', [{kind: 'move', actorId: 'B0', moveId: 'hit-a', target: {side: 'A', slot: 0}}], moves);
  const resolvedInput = JSON.stringify(submittedB.battle), result = engine.V2_resolveTurn(submittedB.battle, moves);
  assert.equal(JSON.stringify(battle), before);
  assert.equal(JSON.stringify(submittedB.battle), resolvedInput);
  assert.equal(new Set(result.events.map(event => event.id)).size, result.events.length);
  assert.ok(result.events.every((event, index) => event.id === `event-${index + 1}`));
  assert.equal(engine.V2_assertBattleInvariants(result.battle), true);
});

test('event projection hides opponent HP amounts and log has unknown fallback', () => {
  const result = resolveOneTurn(fixture(3));
  const damage = result.events.find(event => event.kind === 'damage' && event.targetId === 'B0');
  const projected = engine.V2_projectEvent(damage, result.battle, 'A');
  assert.equal('amount' in projected, false); assert.equal('hpBefore' in projected, false);
  assert.ok(Number.isInteger(projected.hpPercentAfter));
  const own = result.events.find(event => event.kind === 'damage' && event.targetId === 'A0');
  assert.equal(typeof engine.V2_projectEvent(own, result.battle, 'A').amount, 'number');
  assert.equal(engine.V2_eventLogLine({kind: 'futureEvent'}), '[futureEvent]');
  assert.ok(engine.V2_logPage(result.events, 0, 20).length > 0);
});

test('event limits reject runaway dispatch and animator adapter uses event HP', () => {
  assert.throws(() => engine.V2_commitEvents(fixture(), Array.from({length: 257}, () => ({kind: 'turnStarted'}))), /event limit/);
  assert.throws(() => engine.V2_commitEvents(fixture(), [{kind: 'turnStarted'}], {depth: 9}), /depth/);
  assert.equal(engine.V2_validateEvent({kind: 'damage', targetId: 'B0', amount: 5, hpBefore: 10, hpAfter: 9}).ok, false);
  const initial = fixture(9), result = resolveOneTurn(initial);
  const animation = engine.V2_toAnimationEvents(initial, result.events, moves, 'A');
  const hit = animation.find(event => event.kind === 'move');
  const damage = result.events.find(event => event.kind === 'damage' && event.targetId === 'B0');
  assert.ok(hit); assert.equal(hit.frame.enemies[0].hp, damage.hpAfter);
  const presentation = engine.V2_toAnimationEvents(initial, [
    {kind: 'fieldChanged', sourceId: 'A0', field: 'weather', value: 'sun'},
    {kind: 'heal', targetId: 'A0', amount: 10, hpAfter: 200}
  ], moves, 'A');
  assert.deepEqual(presentation.map(event => event.kind), ['move', 'upkeep']);
});

test('declared secondary effects resolve after damage and emit their own event', () => {
  const catalog = {...moves, 'hit-a': {...moves['hit-a'], effects: [{kind: 'applyStatus', timing: 'afterDamage', target: 'hitTarget', chance: 1, params: {status: 'poison'}}]}};
  const battle = fixture(12);
  const a = engine.V2_submitCommands(battle, 'A', [{kind: 'move', actorId: 'A0', moveId: 'hit-a', target: {side: 'B', slot: 0}}], catalog);
  const b = engine.V2_submitCommands(a.battle, 'B', [{kind: 'move', actorId: 'B0', moveId: 'hit-b', target: {side: 'A', slot: 0}}], catalog);
  const result = engine.V2_resolveTurn(b.battle, catalog);
  assert.equal(result.events.some(event => event.kind === 'statusApplied' && event.targetId === 'B0'), true);
});
