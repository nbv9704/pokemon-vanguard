// B27 compatibility entrypoint: inventory uses the pinned retention policy.
// Detect a clean runtime-source release the same way as the primary check gate.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateCatalogRetention} from './validate-catalog-retention-b27.mjs';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let mode=process.argv.includes('--runtime')?'runtime':'source';
if(mode==='source'){
 try{const release=JSON.parse(await readFile(path.join(app,'..','RELEASE-MANIFEST.json'),'utf8'));if(release.kind==='runtime')mode='runtime';}
 catch(error){if(error?.code!=='ENOENT')throw error;}
}
const result=await validateCatalogRetention({mode});
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else console.log(`Content inventory B27 OK: ${result.sourceCatalogs} reviewed snapshots (${(result.totalBytes/1048576).toFixed(2)} MiB); active runtime ${(result.activeBytes/1048576).toFixed(2)} MiB; retained source-history ${(result.historyBytes/1048576).toFixed(2)} MiB.`);
