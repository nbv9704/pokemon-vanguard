import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchSnapshot} from '../content-import/snapshot.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const snapshotId=process.argv[2];
if(!snapshotId)throw new Error('usage: npm run pokemon:fetch -- <snapshot-id>');
const {candidateRoot,manifest}=await fetchSnapshot({appRoot,snapshotId});
console.log(`fetched ${manifest.sources.length} sources to ${path.relative(appRoot,candidateRoot)}`);
