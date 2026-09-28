import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLocalServer} from '../local-server.mjs';

const makeEnv=()=>({AUTH_SESSION_SECRET:randomBytes(48).toString('hex'),AUTH_ALLOW_LOCAL_BETA:'true'});

test('B26 clean local quickstart rejects default placeholder secrets',()=>{
 assert.throws(()=>createLocalServer({authRequired:true,authEnv:{AUTH_SESSION_SECRET:'replace-with-at-least-32-random-characters'}}),/AUTH_SESSION_SECRET/);
});

test('B26 clean local quickstart serves shell, issues beta cookie and restores session without external Supabase',async()=>{
 const saveDir=await mkdtemp(path.join(tmpdir(),'pv-b26-clean-'));
 const app=createLocalServer({authRequired:true,authEnv:makeEnv(),saveDir});
 try{
  const port=await app.listen(0),base=`http://127.0.0.1:${port}`;
  const before=await fetch(base+'/api/auth/session');
  assert.equal(before.status,200);assert.equal((await before.json()).authenticated,false);
  const shell=await fetch(base+'/');assert.equal(shell.status,200);
  assert.match(await shell.text(),/<html/i);
  const login=await fetch(base+'/api/auth/dev',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':base},
   body:'legacyPlayerId=b26-clean-probe',redirect:'manual'
  });
  assert.equal(login.status,303);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const after=await fetch(base+'/api/auth/session',{headers:{Cookie:cookie}});
  const data=await after.json();
  assert.equal(data.authenticated,true);assert.equal(data.user?.playerId,'b26-clean-probe');
 }finally{await app.close();await rm(saveDir,{force:true,recursive:true});}
});
