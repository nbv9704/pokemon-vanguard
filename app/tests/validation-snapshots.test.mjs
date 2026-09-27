import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyValidationSnapshots} from '../scripts/verify-validation-snapshots.mjs';

const root=fileURLToPath(new URL('../content-validation/',import.meta.url));
test('immutable validation snapshots match the review manifest',async()=>{
 const manifest=JSON.parse(await readFile(path.join(root,'snapshot-manifest.json'),'utf8'));
 assert.ok(Object.keys(manifest.files).length>=20);
 assert.equal(await verifyValidationSnapshots(root),Object.keys(manifest.files).length);
});

test('snapshot verification rejects altered or unmanifested normalized inputs',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'vanguard-validation-'));
 try{
  const name='pv-ma/normalized/items.json',folder=path.join(dir,'pv-ma','normalized'),file=path.join(folder,'items.json');
  await mkdir(folder,{recursive:true});const contents='[]';await writeFile(file,contents);
  await writeFile(path.join(dir,'snapshot-manifest.json'),JSON.stringify({schemaVersion:1,files:{[name]:createHash('sha256').update(contents).digest('hex')}}));
  assert.equal(await verifyValidationSnapshots(dir),1);
  await writeFile(file,'[{}]');await assert.rejects(verifyValidationSnapshots(dir),/changed/);
  await writeFile(file,contents);await writeFile(path.join(folder,'unreviewed.json'),'{}');await assert.rejects(verifyValidationSnapshots(dir),/file set/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
