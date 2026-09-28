import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OperationsJournal} from '../server/operational-observability.mjs';
import {AccountCoordinator} from '../server/account-coordinator.mjs';
const run=promisify(execFile),script=fileURLToPath(new URL('../scripts/benchmark-operations-b30.mjs',import.meta.url));
test('B30 synthetic benchmark quick mode carries fixture/catalog identity, raw results and compares safely',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-bench-test-'));
 try{
  const first=path.join(dir,'baseline.json'),second=path.join(dir,'repeat.json');
  await run(process.execPath,[script,'--quick','--output',first]);
  await run(process.execPath,[script,'--quick','--compare',first,'--output',second]);
  const a=JSON.parse(await readFile(first,'utf8')),b=JSON.parse(await readFile(second,'utf8'));
  assert.deepEqual(a.metadata,b.metadata);
  assert.equal(a.metadata.syntheticOnly,true);
  assert.equal(a.metadata.fixtureVersion,'B30-fixture-quick-1');
  assert.deepEqual(a.results.map(item=>item.scenario),['small','large','long-history-double']);
  assert.equal(b.comparison.length,3);
  for(const item of a.results){assert.equal(item.serialization.rawMs.length,7);assert.equal(item.save.rawMs.length,4);assert.ok(item.fixtureBytes>0);}
  assert.equal(a.concurrentPairOperations.rawMs.length,5);
  const incompatible=path.join(dir,'wrong.json');
  const malformed={...a,metadata:{...a.metadata,catalogContractSha256:'bad'}};
  const {writeFile}=await import('node:fs/promises');await writeFile(incompatible,JSON.stringify(malformed));
  await assert.rejects(run(process.execPath,[script,'--quick','--compare',incompatible]),/Incompatible baseline/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('B30 synthetic soak keeps diagnostic retention capped and concurrent account queues drain',async()=>{
 const journal=new OperationsJournal({maxEntries:32});
 for(let i=0;i<10_000;i++)journal.record({domain:'storage',operation:'save',outcome:i%17?'ok':'error',errorCode:'STORAGE_TIMEOUT'});
 assert.equal(journal.snapshot().retained,32);assert.equal(journal.snapshot().counts.ok+journal.snapshot().counts.error,10_000);
 const coordination=new AccountCoordinator(),seen=[];
 await Promise.all(Array.from({length:320},(_,i)=>coordination.withAccounts([`synthetic-${i%7}`,`synthetic-${(i+1)%7}`],async()=>{seen.push(i);await Promise.resolve();})));
 assert.equal(seen.length,320);assert.equal(coordination.pending.length,0);assert.equal(coordination.active.size,0);
});
