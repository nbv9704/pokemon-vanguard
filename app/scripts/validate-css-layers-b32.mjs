import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASCADE_CONTRACT_FILE, CSS_FILE_LAYERS, CSS_LAYER_ORDER } from './css-layer-manifest-b32.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(appRoot, 'public');
const writeMode = process.argv.includes('--write');

export function layerEnvelope(file, layer) {
  return { open: `@layer pv.${layer}{\n`, close: '\n}\n', file };
}

export function validateLayeredCss(file, layer, source) {
  const { open, close } = layerEnvelope(file, layer);
  const errors = [];
  if (!source.startsWith(open)) errors.push(`${file} must start with ${open.trim()}`);
  if (!source.endsWith(close)) errors.push(`${file} must end with the layer envelope`);
  if (/^\s*@import\s/mi.test(source)) errors.push(`${file} must not hide imports inside a layer`);
  return errors;
}

function wrap(file, layer, source) {
  const { open, close } = layerEnvelope(file, layer);
  if (source.startsWith(open) && source.endsWith(close)) return source;
  return `${open}${source.replace(/^\uFEFF/u, '').replace(/^\s*\n/u, '').replace(/\s*$/u, '')}${close}`;
}

function countMatches(source, pattern) { return [...source.matchAll(pattern)].length; }

const publicCss = (await readdir(publicRoot)).filter(file => file.endsWith('.css')).sort();
const expected = Object.keys(CSS_FILE_LAYERS).sort();
const unclassified = publicCss.filter(file => file !== CASCADE_CONTRACT_FILE && !expected.includes(file));
const missing = expected.filter(file => !publicCss.includes(file));
if (unclassified.length || missing.length) {
  throw new Error(`CSS manifest mismatch; unclassified=${unclassified.join(',') || '-'}; missing=${missing.join(',') || '-'}`);
}

const contract = await readFile(path.join(publicRoot, CASCADE_CONTRACT_FILE), 'utf8');
const declaration = `@layer ${CSS_LAYER_ORDER.map(layer => `pv.${layer}`).join(', ')};`;
if (!contract.includes(declaration)) throw new Error('Cascade contract order is missing or changed');

const errors = [];
const inventory = { stylesheets: expected.length, selectors: 0, important: 0, rootRules: 0, layers: {} };
const selectorOwners = new Map();
for (const file of expected) {
  const layer = CSS_FILE_LAYERS[file];
  const filePath = path.join(publicRoot, file);
  let source = await readFile(filePath, 'utf8');
  if (writeMode) {
    source = wrap(file, layer, source);
    await writeFile(filePath, source);
  }
  errors.push(...validateLayeredCss(file, layer, source));
  inventory.layers[layer] = (inventory.layers[layer] || 0) + 1;
  inventory.selectors += countMatches(source, /(^|\})\s*[^@{}][^{]*\{/gmu);
  inventory.important += countMatches(source, /!important\b/gu);
  inventory.rootRules += countMatches(source, /(^|[},])\s*:root\s*\{/gmu);
  for (const match of source.matchAll(/(^|\})([^@{}][^{}]*)\{/gmu)) {
    for (const selector of match[2].split(',').map(value => value.trim().replace(/\s+/gu, ' ')).filter(Boolean)) {
      const owners = selectorOwners.get(selector) || new Set();
      owners.add(file);
      selectorOwners.set(selector, owners);
    }
  }
}
if (errors.length) throw new Error(errors.join('\n'));
const tokensSource = await readFile(path.join(publicRoot, 'tokens.css'), 'utf8');
if (countMatches(tokensSource, /(^|[},])\s*:root\s*\{/gmu) !== 1) {
  throw new Error('tokens.css must own exactly one base :root token rule');
}
inventory.duplicateSelectors = [...selectorOwners.values()].filter(owners => owners.size > 1).length;
if (inventory.important > 1062) throw new Error(`CSS !important budget increased: ${inventory.important} > 1062`);

const entryReplacements = {
  'index.html': [
    '<link rel="stylesheet" href="/style.css">',
    '<link rel="stylesheet" href="/cascade-contract.css"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/style.css">'
  ],
  'classic.html': [
    '  <link rel="stylesheet" href="/style.css">',
    '  <link rel="stylesheet" href="/cascade-contract.css">\n  <link rel="stylesheet" href="/tokens.css">\n  <link rel="stylesheet" href="/style.css">'
  ],
  'admin.html': [
    '<link rel="stylesheet" href="/admin.css">',
    '<link rel="stylesheet" href="/cascade-contract.css"><link rel="stylesheet" href="/admin.css">'
  ]
};
if (writeMode) {
  for (const [htmlFile, [before, after]] of Object.entries(entryReplacements)) {
    const filePath = path.join(publicRoot, htmlFile);
    const source = await readFile(filePath, 'utf8');
    if (!source.includes('/cascade-contract.css')) {
      if (!source.includes(before)) throw new Error(`Cannot migrate CSS entry in ${htmlFile}`);
      await writeFile(filePath, source.replace(before, after));
    }
  }
}

for (const htmlFile of ['index.html', 'classic.html', 'admin.html']) {
  const html = await readFile(path.join(publicRoot, htmlFile), 'utf8');
  const firstCss = html.match(/href="(\/[^"]+\.css)"/u)?.[1];
  if (firstCss !== '/cascade-contract.css') {
    throw new Error(`${htmlFile} must load cascade-contract.css before every layered stylesheet`);
  }
}

console.log(`B32 CSS cascade OK — ${inventory.stylesheets} layered stylesheets, ${inventory.selectors} selector blocks, ${inventory.duplicateSelectors} cross-file duplicate selectors, ${inventory.important}/1062 !important budget`);
