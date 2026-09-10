import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as generated from '../src/logic.js';
import * as legacy from '../server/legacy/logic-v1.js';
import { buildLogic, compileLogic } from '../scripts/compile-logic.mjs';

const publicExports = ['applyAction','isGameOver','meta','setup','validateAction','viewFor'];

test('generated v1 logic has exactly the public contract and matches frozen legacy behavior', async () => {
  assert.deepEqual(Object.keys(generated).sort(), publicExports);
  assert.deepEqual(Object.keys(legacy).sort(), publicExports);
  const player = 'generator-parity';
  let current = generated.setup([player]);
  let previous = legacy.setup([player]);
  assert.deepEqual(current, previous);
  const actions = [
    {type:'claim',id:0},
    {type:'summon',count:10},
    {type:'team',ids:[0,3,6,9]},
    {type:'battle',mode:'double'}
  ];
  for (const action of actions) {
    assert.deepEqual(generated.validateAction(current, player, action), legacy.validateAction(previous, player, action));
    current = generated.applyAction(current, player, action);
    previous = legacy.applyAction(previous, player, action);
    assert.deepEqual(current, previous);
    assert.deepEqual(generated.viewFor(current, player), legacy.viewFor(previous, player));
  }
  const commands = current.battle.allies.map((mon,index) => ({mon,index})).filter(entry => entry.mon.slot >= 0).map(entry => ({kind:'move',actor:entry.index,move:0,target:0}));
  const turn = {type:'turn',round:current.battle.round,commands};
  assert.deepEqual(generated.applyAction(current, player, turn), legacy.applyAction(previous, player, turn));
  assert.equal((await buildLogic()).includes('Source hash:'), true);
  assert.deepEqual(await compileLogic({verify:true}), {changed:false,target:path.resolve(new URL('../src/logic.js', import.meta.url).pathname.slice(1))});
});

test('a broken generated file never replaces the last valid logic build', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aether-logic-generator-'));
  try {
    await mkdir(path.join(root, 'logic-src'), {recursive:true});
    await mkdir(path.join(root, 'src'), {recursive:true});
    await writeFile(path.join(root, 'logic-src', 'manifest.json'), JSON.stringify({formatVersion:1,fragments:['90-broken.js']}));
    await writeFile(path.join(root, 'logic-src', '90-broken.js'), 'export const broken = ;\n');
    await writeFile(path.join(root, 'src', 'logic.js'), 'export const lastValid = true;\n');
    await assert.rejects(compileLogic({root}), /syntax validation/);
    assert.equal(await readFile(path.join(root, 'src', 'logic.js'), 'utf8'), 'export const lastValid = true;\n');
  } finally {
    await rm(root, {recursive:true,force:true});
  }
});

