import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/package-full.py',import.meta.url));
const verify=fileURLToPath(new URL('../scripts/verify-release.py',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(file,args)=>{
 const variants=process.env.PYTHON?[[process.env.PYTHON,[]]]:process.platform==='win32'?[['py',['-3']],['python',[]]]:[['python3',[]],['python',[]]];
 let result;for(const [cmd,prefix] of variants){result=spawnSync(cmd,[...prefix,file,...args],{encoding:'utf8'});if(!result.error||result.error.code!=='ENOENT')break;}
 assert.equal(result.status,0,result.stderr||result.error?.message);return result;
};
test('source archives are content reproducible, normalized, and leave local data unchanged',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pv-b25-repro-')),root=join(dir,'project');
 try{
  mkdirSync(join(root,'app/.local-data'),{recursive:true});
  writeFileSync(join(root,'app/package.json'),'{}\n');
  writeFileSync(join(root,'app/.dev.vars.example'),'EXAMPLE=1\n');
  writeFileSync(join(root,'app/.local-data/save.json'),'USER_SAVE');
  writeFileSync(join(root,'app/.dev.vars'),'SECRET');
  const before=hash(readFileSync(join(root,'app/.local-data/save.json')));
  const zip1=join(dir,'a.zip'),zip2=join(dir,'b.zip');
  run(script,['--project-root',root,'--output',zip1]);
  writeFileSync(join(root,'app/package.json'),'{}\n'); // mtime update, same contents
  run(script,['--project-root',root,'--output',zip2]);
  assert.equal(hash(readFileSync(zip1)),hash(readFileSync(zip2)),'same-runtime zip contents and bytes must be stable');
  run(verify,[zip1]);run(verify,[zip2]);
  assert.equal(hash(readFileSync(join(root,'app/.local-data/save.json'))),before);
  assert.equal(readFileSync(join(root,'app/.dev.vars'),'utf8'),'SECRET');
  assert.ok(statSync(zip1).size>0);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
