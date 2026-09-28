import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CSS_FILE_LAYERS, CSS_LAYER_ORDER } from '../scripts/css-layer-manifest-b32.mjs';
import { validateLayeredCss } from '../scripts/validate-css-layers-b32.mjs';

test('B32 defines one explicit, stable cascade order and classifies every active stylesheet', async () => {
  const contract = await readFile(new URL('../public/cascade-contract.css', import.meta.url), 'utf8');
  assert.match(contract, new RegExp(`@layer ${CSS_LAYER_ORDER.map(layer => `pv\\.${layer}`).join(', ')};`));
  assert.equal(Object.keys(CSS_FILE_LAYERS).length, 35);
  for (const [file, layer] of Object.entries(CSS_FILE_LAYERS)) {
    const source = await readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
    assert.deepEqual(validateLayeredCss(file, layer, source), [], file);
  }
});

test('B32 validator rejects unlayered CSS and imports hidden inside layers', () => {
  assert.ok(validateLayeredCss('route.css', 'routes', '.route{}\n').length > 0);
  assert.ok(validateLayeredCss('route.css', 'routes', '@layer pv.routes{\n@import url("x.css");\n}\n').some(error => error.includes('imports')));
});

test('B32 keeps the compatibility class and loads the cascade contract first', async () => {
  const [index, classic, admin, pixel] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/classic.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/admin.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/pixel-era-ui.css', import.meta.url), 'utf8')
  ]);
  for (const html of [index, classic, admin]) {
    assert.ok(html.indexOf('/cascade-contract.css') < html.search(/href="\/(?!cascade-contract)[^"]+\.css"/u));
  }
  assert.match(pixel, /\.aether-window/);
});
