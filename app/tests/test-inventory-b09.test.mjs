import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {discoverTests} from '../scripts/test-inventory.mjs';

test('recursive test discovery includes nested mjs, documents excluded TS and skips fixture dirs',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pv-discovery-b09-'));
 try{
  for(const dir of ['tests/nested','tests/fixtures','tests/archive'])await mkdir(path.join(root,dir),{recursive:true});
  for(const file of ['tests/active.test.mjs','tests/nested/nested.test.mjs','tests/fixtures/fixture.test.mjs','tests/archive/cloud.test.ts','tests/original.test.ts'])await writeFile(path.join(root,file),'');
  const result=await discoverTests(root);
  assert.deepEqual(result.runnable,['tests/active.test.mjs','tests/nested/nested.test.mjs']);
  assert.deepEqual(result.archived,['tests/original.test.ts']);
  assert.match(result.archiveReason,/Node/);
 }finally{await rm(root,{recursive:true,force:true});}
});
