import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,utimesSync,symlinkSync,rmSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnPython} from '../scripts/python-executable.mjs';
const packageScript=fileURLToPath(new URL('../scripts/package-full.py',import.meta.url));
const verifyScript=fileURLToPath(new URL('../scripts/verify-release.py',import.meta.url));
const run=(script,args)=>spawnPython(script,args,{encoding:'utf8'});

test('release is byte-stable across input mtimes, verified per-file, private dirs excluded',()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'pv-package-b09-'));const root=path.join(tmp,'Fixture');
 try{
  mkdirSync(path.join(root,'app','public'),{recursive:true});
  mkdirSync(path.join(root,'app','.local-data'),{recursive:true});
  mkdirSync(path.join(root,'app','.restore-backups'),{recursive:true});
  mkdirSync(path.join(root,'app','.storage.lock'),{recursive:true});
  writeFileSync(path.join(root,'app','package.json'),'{}');
  writeFileSync(path.join(root,'app','.dev.vars.example'),'SESSION_SECRET=fixture');
  writeFileSync(path.join(root,'app','public','file.js'),'console.log("public")');
  writeFileSync(path.join(root,'app','.local-data','player.json'),'save');
  writeFileSync(path.join(root,'app','.restore-backups','player.pvbackup.json'),'backup');
  writeFileSync(path.join(root,'app','.storage.lock','owner.json'),'lock');
  writeFileSync(path.join(root,'app','.dev.vars'),'secret');
  symlinkSync(path.join(root,'app','.local-data'),path.join(root,'app','public','leak'),process.platform==='win32'?'junction':'dir');
  const a=path.join(tmp,'a.zip'),b=path.join(tmp,'b.zip');
  const args=['--project-root',root,'--output',a];
  const first=run(packageScript,args);assert.equal(first.status,0,first.stderr);
  utimesSync(path.join(root,'app','public','file.js'),new Date('2023-03-03'),new Date('2023-03-03'));
  const second=run(packageScript,['--project-root',root,'--output',b]);assert.equal(second.status,0,second.stderr);
  assert.deepEqual(readFileSync(a),readFileSync(b));
  const inspect=run('-c',['import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); n=[x for x in z.namelist() if x.endswith("/RELEASE-MANIFEST.json")]; print(json.loads(z.read(n[0]))["root"])',a]);
  assert.equal(inspect.status,0,inspect.stderr);assert.equal(inspect.stdout.trim(),'PokemonVanguard');
  const check=run(verifyScript,[a]);assert.equal(check.status,0,check.stderr);assert.match(check.stdout,/manifest\/CRC\/security PASS/);
  const dry=run(packageScript,['--project-root',root,'--dry-run']);assert.equal(dry.status,0,dry.stderr);
  assert.match(dry.stdout,/EXCLUDED.*\.local-data/);assert.match(dry.stdout,/EXCLUDED.*\.restore-backups/);assert.match(dry.stdout,/EXCLUDED.*\.storage.lock/);assert.match(dry.stdout,/EXCLUDED symlink app\/public\/leak/);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
