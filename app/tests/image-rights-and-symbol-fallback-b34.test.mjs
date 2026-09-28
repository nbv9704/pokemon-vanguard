import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pokemonUiIconEntries} from '../server/pokemon-ui-icons.mjs';
import {auditPublicAssetRights,auditUiIconRights,assertUiIconFetchApproved,validateRightsRegistry,verifyApprovedIconBytes} from '../scripts/ui-icon-rights-b34.mjs';
import {recoverPokemonSymbolImage,typeSymbolImg,moveCategoryImg} from '../public/js/ui/pokemon-symbol-assets.js';

const registry=JSON.parse(await readFile(new URL('../docs/ui-icon-rights-b34.json',import.meta.url),'utf8'));
const assets=pokemonUiIconEntries();
const clone=value=>structuredClone(value);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlD9H0AAAAASUVORK5CYII=','base64');
const approved=entry=>Object.assign(entry,{status:'approved',basis:'permission',reviewer:'Project owner',reviewedAt:'2026-09-29',evidence:'https://example.org/rights/record',sha256:createHash('sha256').update(png).digest('hex')});

test('39-icon rights registry mirrors the actual allowlisted paths and file-page provenance',()=>{
 assert.equal(assets.length,39);
 assert.equal(validateRightsRegistry(assets,registry).size,39);
 assert.equal(registry.icons.filter(row=>row.status==='pending').length,39);
 assert.deepEqual([...new Set(registry.icons.map(row=>row.kind))],['type-icon','type-ic','move-category']);
});

test('registry fails on missing, duplicate, untrusted source, or fake approval evidence',()=>{
 for(const mutate of [
  rows=>rows.icons.pop(),
  rows=>{rows.icons[1].path=rows.icons[0].path;},
  rows=>{rows.icons[0].sourceUrl='https://attacker.invalid/icon.png';},
  rows=>{rows.icons[0].status='approved';},
  rows=>{approved(rows.icons[0]);rows.icons[0].reviewer='';}
 ]){
  const altered=clone(registry);mutate(altered);
  assert.throws(()=>validateRightsRegistry(assets,altered));
 }
});

test('all missing icons are explicitly fallback-only; partial and unreviewed mirrors fail closed',async()=>{
 const missing=async()=>{const error=Error('not found');error.code='ENOENT';throw error;};
 const empty=await auditUiIconRights({assets,registry,read:missing});
 assert.equal(empty.present,0);assert.equal(empty.mode,'remote-fallback-only');
 // auditUiIconRights resolves native filesystem paths. Normalize separators so
 // this fail-closed fixture exercises the same icon on Windows and POSIX.
 const partial=async name=>name.replaceAll('\\','/').endsWith(assets[0].path)?png:missing();
 await assert.rejects(auditUiIconRights({assets,registry,read:partial}),/Unapproved local icon/);
 const altered=clone(registry);approved(altered.icons[0]);
 await assert.rejects(auditUiIconRights({assets,registry:altered,read:partial}),/format\/dimensions mismatch/);
});

test('approved local icon bytes must match pinned checksum and exact PNG dimensions',()=>{
 const asset={path:'test/icon.png',size:[1,1]};
 const record=approved({status:'pending',path:asset.path});
 assert.doesNotThrow(()=>verifyApprovedIconBytes(asset,record,png));
 assert.throws(()=>verifyApprovedIconBytes(asset,{...record,sha256:'0'.repeat(64)},png),/hash differs/);
 assert.throws(()=>verifyApprovedIconBytes({...asset,size:[2,2]},record,png),/format\/dimensions mismatch/);
 assert.throws(()=>verifyApprovedIconBytes(asset,{...record,status:'pending'},png),/Unapproved/);
});

test('non-approved manifest blocks automatic upstream download before any network operation',async()=>{
 await assert.rejects(assertUiIconFetchApproved(),/39\/39 lack/);
});

test('rights audit separately enumerates 303 responsive assets and 544 pinned original sprites',async()=>{
 const audit=await auditPublicAssetRights();
 assert.deepEqual(audit.existing,{
  'review-required-before-public-distribution':31,
  'third-party-rights-review-before-public-distribution':272,
  'review-upstream-rights-before-public-distribution':544
 });
 assert.equal(audit.needsHumanReview,886);
});

test('offline symbol fallback first tries allowlisted proxy then renders local readable label after second error',()=>{
 let replacement=null;
 const img={dataset:{pvFallbackSrc:'/api/ui-symbols/type-icon/fire',pvSymbolLabel:'Fire type',pvSymbolShort:'FI'},src:'local',alt:'Fire type',className:'pv-type-symbol pv-type-symbol-icon',replaceWith:node=>{replacement=node;}};
 const doc={createElement:()=>({attributes:{},setAttribute(k,v){this.attributes[k]=v;}})};
 assert.equal(recoverPokemonSymbolImage(img,{documentRef:doc}),'proxy');
 assert.equal(img.src,img.dataset.pvFallbackSrc);
 assert.equal(recoverPokemonSymbolImage(img,{documentRef:doc}),'text');
 assert.equal(replacement.textContent,'FI');
 assert.equal(replacement.attributes['aria-label'],'Fire type');
 assert.equal(replacement.attributes.role,'img');
 assert.match(replacement.className,/pv-symbol-text-fallback/);
 assert.equal(recoverPokemonSymbolImage({dataset:{}},{documentRef:doc}),false);
});

test('decorative battle symbols retain parent accessibility labels and generated HTML escapes inputs',()=>{
 const decorated=typeSymbolImg('fairy',{alt:''});
 assert.match(decorated,/data-pv-symbol-label="Fairy type"/);
 assert.match(decorated,/data-pv-symbol-short="FA"/);
 assert.match(moveCategoryImg('physical'),/data-pv-symbol-short="P"/);
 assert.doesNotMatch(typeSymbolImg('fire',{className:'\" onerror=\"evil'}),/class="[^"]*" onerror=/);
 let replacement=null;
 const doc={createElement:()=>({attributes:{},setAttribute(k,v){this.attributes[k]=v;}})};
 recoverPokemonSymbolImage({dataset:{pvFallbackSrc:'/proxy',pvFallbackUsed:'1',pvSymbolLabel:'Fairy type',pvSymbolShort:'FA'},alt:'',className:'pv-type-symbol',replaceWith:node=>{replacement=node;}},{documentRef:doc});
 assert.equal(replacement.attributes['aria-hidden'],'true');
 assert.equal(replacement.attributes.role,undefined);
});
