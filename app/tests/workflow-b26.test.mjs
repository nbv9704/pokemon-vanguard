import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {verifyWorkflow} from '../scripts/verify-workflow-b26.mjs';

const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const fixtureFiles=[
 'README.md','AGENTS.md','app/AGENTS.md','app/.dev.vars.example','app/package.json','app/package-lock.json',
 'app/logic-src','app/rules-v3','app/mechanics-v3','app/server','app/public','app/content-active/active.json',
 'app/server/legacy/logic-v1.js','app/src/logic.js','app/src/v2-engine.mjs',
 'app/supabase/migrations/202609260001_atomic_pair_saves.sql','app/supabase/migrations/202609260002_admin_campaign_identity.sql','app/supabase/migrations/202610010004_hot_state_archive_index.sql',
 'docs/developer-workflow-b26.md','docs/code-structure.md','docs/archive/README-pre-B26.md',
 'docs/project-optimization-progress-2026-09-26.md','app/docs/optimization-b09-operations.md'
];
async function fixture(){
 const output=await mkdtemp(path.join(tmpdir(),'pv-b26-workflow-'));
 for(const f of fixtureFiles){
  const target=path.join(output,f),source=path.join(root,f);
  await mkdir(path.dirname(target),{recursive:true});
  // Directory markers alone are sufficient: the verifier checks their existence.
  if(['app/logic-src','app/rules-v3','app/mechanics-v3','app/server','app/public'].includes(f))await mkdir(target,{recursive:true});
  else await cp(source,target);
 }
 return output;
}
test('B26 active docs and all referenced npm commands/paths agree',async()=>{
 assert.deepEqual(await verifyWorkflow(root),{paths:23,scripts:11,lockfile:true});
});
test('B26 verifier catches a stale/removed npm command instead of silently documenting it',async()=>{
 const temp=await fixture();
 try{
  const file=path.join(temp,'app/package.json'),pkg=JSON.parse(await readFile(file,'utf8'));
  delete pkg.scripts['release:verify'];await writeFile(file,JSON.stringify(pkg));
  await assert.rejects(verifyWorkflow(temp),/Required npm script absent: release:verify/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('B26 verifier catches contradictory quickstart/documentation',async()=>{
 const temp=await fixture();
 try{
  const file=path.join(temp,'README.md'),body=await readFile(file,'utf8');
  await writeFile(file,body.replace('AUTH_ALLOW_LOCAL_BETA=true','AUTH_ALLOW_LOCAL_BETA=unavailable'));
  await assert.rejects(verifyWorkflow(temp),/README local beta security setup/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
