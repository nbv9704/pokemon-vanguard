import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCandidateDirectory} from '../content-import/validate-candidate.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const snapshotId=process.argv[2];
if(!snapshotId)throw new Error('usage: npm run pokemon:validate -- <snapshot-id>');
const result=await validateCandidateDirectory(path.join(appRoot,'content-candidates',snapshotId));
console.log(`${result.valid?'valid':'invalid'} candidate ${snapshotId}: ${result.problems.length} problem(s); manual review pending`);
if(!result.valid){for(const problem of result.problems)console.error(`- ${problem}`);process.exitCode=1;}
