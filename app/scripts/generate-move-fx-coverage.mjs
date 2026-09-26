import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {V3_FX_TYPES,v3MoveFxCoverage} from '../public/js/v3-move-fx.js';
import {presentationCoverage,presentationMigrationCoverage} from '../public/js/presentation/move-presentation.js';

const outputUrl=new URL('../../docs/r7-move-fx-coverage.json',import.meta.url);
const legacy=v3MoveFxCoverage(publicV3Catalog.moves),presentation=presentationCoverage(publicV3Catalog.moves),byMove=new Map(presentation.map(entry=>[entry.moveId,entry]));
const coverage=legacy.map(entry=>({...entry,presentation:byMove.get(entry.moveId)}));
const migration=presentationMigrationCoverage(publicV3Catalog.moves);
const tierCounts=Object.fromEntries([...new Set(coverage.map(entry=>entry.presentation?.tier).filter(Boolean))].sort().map(tier=>[tier,coverage.filter(entry=>entry.presentation?.tier===tier).length]));
const templateCounts=Object.fromEntries([...new Set(coverage.map(entry=>entry.presentation?.template).filter(Boolean))].sort().map(template=>[template,coverage.filter(entry=>entry.presentation?.template===template).length]));
const report={
 catalogVersion:publicV3Catalog.metadata.catalogVersion,
 generatedBy:'app/scripts/generate-move-fx-coverage.mjs',
 moveCount:coverage.length,
 coveredMoveCount:coverage.filter(entry=>entry.id).length,
 presentationMoveCount:coverage.filter(entry=>entry.presentation?.commit).length,
 typePalette:[...V3_FX_TYPES],
 profiles:[...new Set(coverage.map(entry=>entry.id))].sort(),
 presentationTiers:[...new Set(coverage.map(entry=>entry.presentation?.tier).filter(Boolean))].sort(),
 presentationSummary:{
  commitMarkers:coverage.filter(entry=>entry.presentation?.commit).length,
  castCueCount:coverage.reduce((sum,entry)=>sum+(entry.presentation?.castCues||0),0),
  impactCueCount:coverage.reduce((sum,entry)=>sum+(entry.presentation?.impactCues||0),0),
  tierCounts,
  templateCounts,
  signatureMoveCount:migration.signature,
  parameterizedMoveCount:migration.template,
  legacyMoveCount:migration.legacy
 },
 moves:coverage
};
const next=`${JSON.stringify(report,null,2)}\n`;
if(process.argv.includes('--verify')){
 const current=await readFile(outputUrl,'utf8').catch(()=>null);
 if(current!==next)throw new Error(`Move FX coverage is stale: ${fileURLToPath(outputUrl)}`);
 if(report.presentationMoveCount!==report.moveCount)throw new Error(`Presentation coverage incomplete: ${report.presentationMoveCount}/${report.moveCount}`);
 if(migration.legacy!==0)throw new Error(`Move FX migration still has ${migration.legacy} legacy presentation fallback(s)`);
 if(migration.signature<30)throw new Error(`Signature presentation coverage regressed: ${migration.signature}/30 minimum`);
 console.log(`move FX coverage OK — ${report.coveredMoveCount}/${report.moveCount} profiles; ${report.presentationMoveCount}/${report.moveCount} timelines; ${migration.signature} signature + ${migration.template} parameterized + ${migration.legacy} legacy; ${report.typePalette.length} type colors`);
}else{
 await writeFile(outputUrl,next);
 console.log(`wrote ${fileURLToPath(outputUrl)} — ${report.presentationMoveCount}/${report.moveCount} presentation timelines`);
}
