import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {V3_FX_TYPES,v3MoveFxCoverage} from '../public/js/v3-move-fx.js';

const outputUrl=new URL('../../docs/r7-move-fx-coverage.json',import.meta.url);
const coverage=v3MoveFxCoverage(publicV3Catalog.moves);
const report={
 catalogVersion:publicV3Catalog.metadata.catalogVersion,
 generatedBy:'app/scripts/generate-move-fx-coverage.mjs',
 moveCount:coverage.length,
 coveredMoveCount:coverage.filter(entry=>entry.id).length,
 typePalette:[...V3_FX_TYPES],
 profiles:[...new Set(coverage.map(entry=>entry.id))].sort(),
 moves:coverage
};
const next=`${JSON.stringify(report,null,2)}\n`;
if(process.argv.includes('--verify')){
 const current=await readFile(outputUrl,'utf8').catch(()=>null);
 if(current!==next)throw new Error(`Move FX coverage is stale: ${fileURLToPath(outputUrl)}`);
 console.log(`move FX coverage OK — ${report.coveredMoveCount}/${report.moveCount} moves, ${report.typePalette.length} type colors`);
}else{
 await writeFile(outputUrl,next);
 console.log(`wrote ${fileURLToPath(outputUrl)}`);
}
