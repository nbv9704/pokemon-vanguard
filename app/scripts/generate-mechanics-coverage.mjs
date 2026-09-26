import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMechanicsCoverage} from '../mechanics-v3/coverage.mjs';
import {HANDLER_DEFINITIONS} from '../mechanics-v3/handlers/index.mjs';
import {TEST_EVIDENCE} from '../mechanics-v3/test-evidence.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),snapshotId=process.argv[2];
if(!snapshotId)throw new Error('usage: npm run mechanics:coverage -- <snapshot-id>');
const normalized=path.join(appRoot,'content-candidates',snapshotId,'normalized'),readJson=file=>readFile(file,'utf8').then(JSON.parse);
const [moves,abilities,items,manifests]=await Promise.all([
 readJson(path.join(normalized,'moves.json')),readJson(path.join(normalized,'abilities.json')),readJson(path.join(normalized,'items.json')),
 readJson(path.join(appRoot,'content-src','mechanics-v3-manifests.json'))
]);
const coverage=buildMechanicsCoverage({moves,abilities,items},manifests,HANDLER_DEFINITIONS.map(handler=>handler.id),TEST_EVIDENCE);
const reasons=new Map();
for(const entry of coverage.entries)for(const format of ['single','double'])if(entry.formats[format].reason)reasons.set(entry.formats[format].reason,(reasons.get(entry.formats[format].reason)||0)+1);
const markdown=[`# Mechanics coverage — ${snapshotId}`,'',`Generated from manifest schema ${manifests.schemaVersion}. Descriptions were not interpreted as mechanics.`,'','## Summary','',`- Entries: ${coverage.summary.total}`,`- Single: ${coverage.summary.single.supported} runtime-supported / ${coverage.summary.single.blocked} runtime-blocked`,`- Double: ${coverage.summary.double.supported} runtime-supported / ${coverage.summary.double.blocked} runtime-blocked`,`- Reviewed: ${coverage.summary.reviewed.single.reviewed}/${coverage.summary.total} Single; ${coverage.summary.reviewed.double.reviewed}/${coverage.summary.total} Double`,'','## By kind','',...Object.entries(coverage.summary.byKind).map(([kind,value])=>`- ${kind}: ${value.total} total; ${value.singleSupported} Single; ${value.doubleSupported} Double`),'','## Block reasons','',...[...reasons].sort((a,b)=>a[0].localeCompare(b[0])).map(([reason,count])=>`- ${reason}: ${count}`),''];
await mkdir(normalized,{recursive:true});
await Promise.all([writeFile(path.join(normalized,'mechanics-coverage.json'),JSON.stringify(coverage,null,2)+'\n'),writeFile(path.join(normalized,'mechanics-coverage.md'),markdown.join('\n'))]);
console.log(`mechanics coverage ${snapshotId}: ${coverage.summary.total} entries; Single ${coverage.summary.single.supported}/${coverage.summary.total}; Double ${coverage.summary.double.supported}/${coverage.summary.total}`);
