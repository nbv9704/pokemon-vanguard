import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCandidate} from '../content-import/candidate.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const snapshotId=process.argv[2],regulation=process.argv[3]||'m-a';
if(!snapshotId)throw new Error('usage: npm run pokemon:candidate -- <snapshot-id> [regulation]');
const result=await buildCandidate({candidateRoot:path.join(appRoot,'content-candidates',snapshotId),regulation});
console.log(`candidate ${snapshotId}/${regulation}: ${JSON.stringify(result.provenance.counts)}`);
if(result.unresolved.length)process.exitCode=2;
