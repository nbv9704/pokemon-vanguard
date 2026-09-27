import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverTests} from './test-inventory.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {runnable:files,archived,archiveReason}=await discoverTests(root);
if(process.argv.includes('--list-json')){console.log(JSON.stringify({files,archived,archiveReason},null,2));process.exit(0);}
if(!files.length){console.error('No supported .test.mjs files found recursively in tests/.');process.exit(1);}
if(archived.length)console.log(`Archived (not run): ${archived.join(', ')} — ${archiveReason}`);
const batchSize=Math.max(1,Number.parseInt(process.env.PV_TEST_BATCH_SIZE||'18',10)||18);
const timeoutMs=Math.max(30_000,Number.parseInt(process.env.PV_TEST_BATCH_TIMEOUT_MS||'120000',10)||120000);
const forceExit=process.env.PV_TEST_FORCE_EXIT!=='0';
const batches=[];for(let i=0;i<files.length;i+=batchSize)batches.push(files.slice(i,i+batchSize));
const total={tests:0,pass:0,fail:0,skipped:0,todo:0};
const keys=Object.keys(total);
function summary(output){
 const lines=output.split(/\r?\n/),result={};
 for(const key of keys){const matches=lines.filter(line=>new RegExp(`^# ${key} \\d+$`).test(line));if(matches.length!==1)throw new Error(`Expected one Node TAP summary for ${key}; found ${matches.length}`);result[key]=Number(matches[0].split(' ').at(-1));}
 if(result.tests===0||result.tests!==result.pass+result.fail+result.skipped+result.todo)throw new Error('Invalid test batch summary');
 return result;
}
for(let i=0;i<batches.length;i++){
 const batch=batches[i];console.log(`\n=== Test batch ${i+1}/${batches.length} · ${batch.length} files ===`);
 const args=['--test',...(forceExit?['--test-force-exit']:[]),...batch];
 const child=spawn(process.execPath,args,{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
 let out='',timedOut=false,spawnError=null;
 child.stdout.on('data',chunk=>{const value=chunk.toString();out+=value;process.stdout.write(value);});
 child.stderr.on('data',chunk=>process.stderr.write(chunk));
 child.on('error',error=>{spawnError=error;});
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),1500).unref();},timeoutMs);
 const code=await new Promise(resolve=>child.on('close',resolve));clearTimeout(timer);
 if(spawnError){console.error(`Batch ${i+1} failed to spawn: ${spawnError.message}`);process.exit(1);}
 if(timedOut){console.error(`Batch ${i+1} timed out after ${timeoutMs} ms.`);process.exit(1);}
 if(code!==0){console.error(`Batch ${i+1} failed with exit code ${code}.`);process.exit(code||1);}
 try{const parsed=summary(out);for(const key of keys)total[key]+=parsed[key];}catch(error){console.error(error.message);process.exit(1);}
}
console.log('\n=== Aggregate test summary ===');
console.log(`files ${files.length}\narchived_ts ${archived.length}`);
for(const key of keys)console.log(`${key} ${total[key]}`);
if(total.fail!==0||total.tests!==total.pass+total.skipped+total.todo)process.exit(1);
