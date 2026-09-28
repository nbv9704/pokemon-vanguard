import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const checker=path.resolve('scripts/check-import-boundaries.mjs');
const roots=['rules-v3','mechanics-v3','server','content-import','public'];

function fixture(files){
 const root=mkdtempSync(path.join(tmpdir(),'pv-import-boundaries-'));
 for(const directory of roots)mkdirSync(path.join(root,directory),{recursive:true});
 for(const [name,source] of Object.entries(files)){
  const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,source);
 }
 return root;
}

function run(root){
 return spawnSync(process.execPath,['--experimental-vm-modules','--no-warnings',checker,root],{encoding:'utf8'});
}

test('import boundary gate accepts the intended rules-to-mechanics direction',()=>{
 const root=fixture({'rules-v3/state.mjs':'export const state = {};','mechanics-v3/use-state.mjs':"import {state} from '../rules-v3/state.mjs'; export {state};"});
 try{const result=run(root);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/0 cycles/u);}
 finally{rmSync(root,{recursive:true,force:true});}
});

test('import boundary gate rejects a rules-to-mechanics reverse dependency',()=>{
 const root=fixture({'rules-v3/state.mjs':"import '../mechanics-v3/effect.mjs';",'mechanics-v3/effect.mjs':'export const effect = true;'});
 try{const result=run(root);assert.equal(result.status,1);assert.match(result.stderr,/rules may import only rules/u);}
 finally{rmSync(root,{recursive:true,force:true});}
});

test('import boundary gate rejects dependency cycles',()=>{
 const root=fixture({'mechanics-v3/a.mjs':"import './b.mjs';",'mechanics-v3/b.mjs':"import './a.mjs';"});
 try{const result=run(root);assert.equal(result.status,1);assert.match(result.stderr,/dependency cycle/u);}
 finally{rmSync(root,{recursive:true,force:true});}
});
