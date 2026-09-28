// Characterization test for the actual CI gates (not just their config text).
// Fixtures are synthetic and deleted in finally. Never touches player data.
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await mkdtemp(path.join(tmpdir(),'pv-b28-contracts-'));
// eslint's typed parser needs the fixture to exist in the configured project;
// --stdin tests do not provide an on-disk TypeScript program member.
const negativeSource=path.join(app,'server','__pv_b28_async_gate_fixture__.mjs');
const run=(executable,args,cwd)=>spawnSync(executable,args,{cwd,encoding:'utf8',timeout:20000});
const output=result=>[result.stdout,result.stderr].join('\n');
try{
 await writeFile(negativeSource,'export function missingAwait(){ Promise.reject(new Error("synthetic")); }\n','utf8');
 const lint=run(process.execPath,[path.join(app,'node_modules','eslint','bin','eslint.js'),negativeSource],app);
 if(lint.error||lint.status===0||!output(lint).includes('@typescript-eslint/no-floating-promises'))throw Error(`Unhandled Promise gate not active: ${output(lint).slice(-700)}`);
 // A second syntactic fixture must fail the import-boundary gate, not merely
 // fail parsing or missing-file resolution. Keep this isolated from the repo.
 for(const folder of ['rules-v3','mechanics-v3','server','content-import','public'])await mkdir(path.join(temporary,folder));
 await writeFile(path.join(temporary,'server','private.mjs'),'export const secret=1;\n');
 await writeFile(path.join(temporary,'public','wrong.js'),"import {secret} from '../server/private.mjs';export const leak=secret;\n");
 const imported=run(process.execPath,['--experimental-vm-modules','--no-warnings',path.join(app,'scripts','check-import-boundaries.mjs'),temporary],app);
 if(imported.error||imported.status===0||!output(imported).includes('browser UI may import only browser UI'))throw Error(`Wrong-layer import gate not active: ${output(imported).slice(-700)}`);
 console.log('B28 negative contract gates OK — rejected unhandled Promise and browser→server import');
}finally{
 await rm(negativeSource,{force:true});await rm(temporary,{recursive:true,force:true});
}
