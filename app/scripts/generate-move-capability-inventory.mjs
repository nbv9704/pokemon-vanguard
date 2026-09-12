import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMoveCapabilityInventory} from '../mechanics-v3/capability-inventory.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),snapshotId=process.argv[2];
if(!snapshotId)throw new Error('usage: npm run mechanics:inventory -- <snapshot-id>');
const normalized=path.join(appRoot,'content-candidates',snapshotId,'normalized'),readJson=file=>readFile(file,'utf8').then(JSON.parse);
const [moves,manifestCatalog]=await Promise.all([readJson(path.join(normalized,'moves.json')),readJson(path.join(appRoot,'content-src','mechanics-v3-manifests.json'))]);
const inventory=buildMoveCapabilityInventory(moves,manifestCatalog.moves);
const rows=Object.entries(inventory.summary.byPrimaryQueue).map(([queue,count])=>`| ${queue} | ${count} |`);
const markdown=[`# Move capability inventory — ${snapshotId}`,'','Description signals organize manual research only. They never change implementation or legality.','','## Summary','',`- Moves: ${inventory.summary.total}`,`- Manifest-reviewed: ${inventory.summary.manifestReviewed}`,`- Manual review remaining: ${inventory.summary.manualReview}`,'','## Primary review queues','','| Queue | Moves |','| --- | ---: |',...rows,''];
await Promise.all([writeFile(path.join(normalized,'move-capability-inventory.json'),JSON.stringify(inventory,null,2)+'\n'),writeFile(path.join(normalized,'move-capability-inventory.md'),markdown.join('\n'))]);
console.log(`move inventory ${snapshotId}: ${inventory.summary.total} moves; ${inventory.summary.manifestReviewed} manifest-reviewed; ${inventory.summary.manualReview} pending review`);
