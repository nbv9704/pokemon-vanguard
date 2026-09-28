import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {auditPublicAssetRights} from '../scripts/ui-icon-rights-b34.mjs';
import {assertRuntimeLocalOnly,inspectProjectUiSymbols,pngDimensions,projectUiSymbolEntries} from '../scripts/validate-project-ui-symbols-b36.mjs';
import {moveCategoryImg,recoverPokemonSymbolImage,typeSymbolImg} from '../public/js/ui/pokemon-symbol-assets.js';

const png=(width,height)=>{const bytes=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return bytes;};
const missing=async()=>{const error=Error('not found');error.code='ENOENT';throw error;};

test('39 project-owned symbol paths are stable, unique and local',()=>{
 const entries=projectUiSymbolEntries();
 assert.equal(entries.length,39);assert.equal(new Set(entries.map(entry=>entry.path)).size,39);
 for(const entry of entries)assert.match(entry.path,/^public\/assets\/ui\/(pokemon-types\/(icon|ic)|move-categories)\/[a-z]+\.png$/);
 assert.equal(entries.filter(entry=>entry.kind==='type-icon').length,18);
 assert.equal(entries.filter(entry=>entry.kind==='type-ic').length,18);
 assert.equal(entries.filter(entry=>entry.kind==='move-category').length,3);
});

test('policy permits artwork to be supplied incrementally but strict validation requires all 39',async()=>{
 const empty=await inspectProjectUiSymbols({read:async name=>String(name).endsWith('.js')||String(name).endsWith('.mjs')?'export const local=true;':missing()});
 assert.deepEqual(empty,{expected:39,present:0,awaitingOriginal:39,complete:false,delivery:'project-owned-local-only'});
 await assert.rejects(inspectProjectUiSymbols({read:async name=>String(name).endsWith('.js')||String(name).endsWith('.mjs')?'export const local=true;':missing(),requireComplete:true}),/incomplete: 0\/39/);
 const first=projectUiSymbolEntries()[0];
 const partial=await inspectProjectUiSymbols({read:async name=>{
  if(String(name).endsWith('.js')||String(name).endsWith('.mjs'))return 'export const local=true;';
  return String(name).replaceAll('\\','/').endsWith(first.path)?png(...first.size):missing();
 }});
 assert.equal(partial.present,1);assert.equal(partial.awaitingOriginal,38);
});

test('present artwork must be PNG with the exact contract dimensions',async()=>{
 assert.deepEqual(pngDimensions(png(86,86)),[86,86]);
 assert.throws(()=>pngDimensions(Buffer.alloc(24)),/not a PNG/);
 const first=projectUiSymbolEntries()[0];
 await assert.rejects(inspectProjectUiSymbols({read:async name=>{
  if(String(name).endsWith('.js')||String(name).endsWith('.mjs'))return 'export const local=true;';
  return String(name).replaceAll('\\','/').endsWith(first.path)?png(1,1):missing();
 }}),/expected 86x86, got 1x1/);
});

test('runtime local-only guard rejects proxy and external URL regressions',async()=>{
 await assert.doesNotReject(assertRuntimeLocalOnly());
 await assert.rejects(assertRuntimeLocalOnly({root:path.parse(process.cwd()).root,read:async()=>"const icon='/api/ui-symbols/type-icon/fire'"}),/must not depend/);
});

test('missing local art immediately becomes an accessible text badge',()=>{
 let replacement=null;
 const img={dataset:{pvSymbolLabel:'Fire type',pvSymbolShort:'FI'},alt:'Fire type',className:'pv-type-symbol pv-type-symbol-icon',replaceWith:node=>{replacement=node;}};
 const doc={createElement:()=>({attributes:{},setAttribute(key,value){this.attributes[key]=value;}})};
 assert.equal(recoverPokemonSymbolImage(img,{documentRef:doc}),'text');
 assert.equal(replacement.textContent,'FI');assert.equal(replacement.attributes.role,'img');assert.equal(replacement.attributes['aria-label'],'Fire type');
 assert.match(replacement.className,/pv-symbol-text-fallback/);
 assert.equal(recoverPokemonSymbolImage({dataset:{}},{documentRef:doc}),false);
});

test('decorative symbols retain parent accessibility and generated HTML stays local and escaped',()=>{
 const decorated=typeSymbolImg('fairy',{alt:''});
 assert.match(decorated,/data-pv-symbol-label="Fairy type"/);assert.match(decorated,/data-pv-symbol-short="FA"/);
 assert.match(moveCategoryImg('physical'),/data-pv-symbol-short="P"/);
 assert.doesNotMatch(decorated,/https?:\/\/|\/api\/ui-symbols/);
 assert.doesNotMatch(typeSymbolImg('fire',{className:'\" onerror=\"evil'}),/class="[^"]*" onerror=/);
 let replacement=null;const doc={createElement:()=>({attributes:{},setAttribute(key,value){this.attributes[key]=value;}})};
 recoverPokemonSymbolImage({dataset:{pvSymbolLabel:'Fairy type',pvSymbolShort:'FA'},alt:'',className:'pv-type-symbol',replaceWith:node=>{replacement=node;}},{documentRef:doc});
 assert.equal(replacement.attributes['aria-hidden'],'true');assert.equal(replacement.attributes.role,undefined);
});

test('rights audit keeps existing 847 records separate from original project symbols',async()=>{
 const audit=await auditPublicAssetRights();
 assert.deepEqual(audit.existing,{
  'review-required-before-public-distribution':31,
  'third-party-rights-review-before-public-distribution':272,
  'review-upstream-rights-before-public-distribution':544
 });
 assert.equal(audit.needsHumanReview,847);assert.equal(audit.projectSymbols.expected,39);assert.equal(audit.releaseReady,false);
});
