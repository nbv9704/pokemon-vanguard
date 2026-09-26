import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const testDir=path.join(root,'tests');
const batchSize=Math.max(1,Number.parseInt(process.env.PV_TEST_BATCH_SIZE||'18',10)||18);
const timeoutMs=Math.max(30_000,Number.parseInt(process.env.PV_TEST_BATCH_TIMEOUT_MS||'120000',10)||120000);
const files=(await readdir(testDir)).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`tests/${name}`);
if(!files.length){console.error('No test files found.');process.exit(1);}
const batches=[];for(let i=0;i<files.length;i+=batchSize)batches.push(files.slice(i,i+batchSize));
const total={tests:0,pass:0,fail:0,skipped:0,todo:0};
const parseSummary=text=>{for(const [key,label] of [['tests','tests'],['pass','pass'],['fail','fail'],['skipped','skipped'],['todo','todo']]){const match=text.match(new RegExp(`^# ${label} (\\d+)$`,'m'));if(match)total[key]+=Number(match[1]);}};

for(let i=0;i<batches.length;i++){
 const batch=batches[i];
 console.log(`\n=== Test batch ${i+1}/${batches.length} · ${batch.length} files ===`);
 const args=['--test','--test-force-exit',...batch];
 const child=spawn(process.execPath,args,{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
 let out='',err='';
 child.stdout.on('data',chunk=>{const text=chunk.toString();out+=text;process.stdout.write(text);});
 child.stderr.on('data',chunk=>{const text=chunk.toString();err+=text;process.stderr.write(text);});
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),1500).unref();},timeoutMs);
 const code=await new Promise(resolve=>child.on('close',resolve));clearTimeout(timer);
 if(timedOut){console.error(`Batch ${i+1} timed out after ${timeoutMs} ms.`);process.exit(1);}
 if(code!==0){console.error(`Batch ${i+1} failed with exit code ${code}.`);process.exit(code||1);}
 parseSummary(out);
}
console.log(`\n=== Aggregate test summary ===`);
console.log(`files ${files.length}`);
console.log(`tests ${total.tests}`);
console.log(`pass ${total.pass}`);
console.log(`fail ${total.fail}`);
console.log(`skipped ${total.skipped}`);
console.log(`todo ${total.todo}`);
if(total.fail!==0||total.tests!==total.pass+total.skipped+total.todo)process.exit(1);
