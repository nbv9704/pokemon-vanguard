import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRouteImageSnapshot,assertSafeReportDirectory} from '../scripts/image-route-audit-b34.mjs';
import {IMAGE_VARIANTS} from '../public/js/image-variants.js';
import {selectSamples,assertGallerySelection,summarizeGalleryCaptures} from '../scripts/image-browser-qa-b26.mjs';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../docs/image-assets-b25.json',import.meta.url),'utf8'));
const samples=selectSamples(manifest);

test('real-route image audit redacts all URL/alt/player data and checks mapped DPR1/2 variants',()=>{
 const [src,entry]=Object.entries(IMAGE_VARIANTS)[0];
 const row={viewport:360,viewportHeight:740,dpr:2,readyState:'complete',clsArmed:true,clsSinceArm:0,paintFcp:100,
  imageRows:[{src,selected:entry.two,width:112,height:112,cssWidth:48,cssHeight:48,complete:true,hasSrcset:true},
   {src:'external',selected:'/api/ui-symbols/type-icon/fire',width:86,height:86,cssWidth:18,cssHeight:18,complete:true,hasSrcset:false}],
  imageTiming:[{bytes:150,decodedBytes:200}]};
 const report=analyzeRouteImageSnapshot(row,{label:'bag'});
 assert.equal(report.passed,true);assert.equal(report.responsive,1);assert.equal(report.remoteFallback,1);
 assert.equal(report.network.transferBytes,150);
 assert.doesNotMatch(JSON.stringify({...report,notes:[]}),/https?:\/\/|cookie|player-account-123/);
 row.imageRows[0].selected=entry.one;
 assert.deepEqual(analyzeRouteImageSnapshot(row,{label:'bag'}).wrongVariant,[0]);
 row.imageRows[0].selected=entry.two;row.imageRows[0].width=20;
 assert.deepEqual(analyzeRouteImageSnapshot(row,{label:'bag'}).insufficient,[0]);
 row.fallbackTextRows=[{named:true,decorative:false},{named:false,decorative:true}];
 assert.equal(analyzeRouteImageSnapshot(row,{label:'bag'}).offlineSymbolBadges,2);
 row.fallbackTextRows.push({named:false,decorative:false});
 assert.deepEqual(analyzeRouteImageSnapshot(row,{label:'bag'}).unlabelledFallback,[2]);
 row.imageRows[1].width=0;
 assert.deepEqual(analyzeRouteImageSnapshot(row,{label:'bag'}).missing,[1]);
 assert.throws(()=>analyzeRouteImageSnapshot(row,{label:'credentials'}),/Unknown route/);
});

test('synthetic browser QA rejects wrong srcset asset and missing image, not merely .png suffix',()=>{
 const rows=samples.map(entry=>({alt:entry.id,complete:true,failed:false,cssWidth:entry.displayCssPx,
  naturalWidth:entry.variants['2x'].width,currentSrc:`http://127.0.0.1:1234${entry.variants['2x'].url}`}));
 assert.doesNotThrow(()=>assertGallerySelection({images:rows},samples,{mode:'optimized',dpr:2}));
 const wrong=structuredClone(rows);wrong[0].currentSrc=wrong[1].currentSrc;
 assert.throws(()=>assertGallerySelection({images:wrong},samples,{mode:'optimized',dpr:2}),/Wrong DPR2/);
 const missing=structuredClone(rows);missing[0].failed=true;
 assert.throws(()=>assertGallerySelection({images:missing},samples,{mode:'optimized',dpr:2}),/Missing/);
});

test('synthetic capture comparisons require every baseline/optimized viewport and DPR',()=>{
 const rows=[];
 for(const width of [360,1366])for(const dpr of [1,2])for(const mode of ['baseline','optimized'])
  rows.push({width,dpr,mode,transferBytes:mode==='baseline'?1000:250,resourceBytes:mode==='baseline'?800:200,cls:0,firstContentfulPaint:12});
 const comparisons=summarizeGalleryCaptures(rows);
 assert.equal(comparisons.length,4);assert.deepEqual(comparisons.map(c=>c.transferSaved),[750,750,750,750]);
 assert.throws(()=>summarizeGalleryCaptures(rows.slice(1)),/Missing/);
});

test('real-route reports must use absolute paths outside checkout, including symlink target checks',()=>{
 assert.throws(()=>assertSafeReportDirectory('/repo/app/docs/qa',{repo:'/repo'}),/outside the repository/);
 assert.throws(()=>assertSafeReportDirectory('relative',{repo:'/repo'}),/absolute directory/);
 assert.doesNotThrow(()=>assertSafeReportDirectory('/tmp/qa',{repo:'/repo'}));
});
