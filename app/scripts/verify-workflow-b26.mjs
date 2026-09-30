import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REQUIRED_SCRIPTS=['dev','start','check','test','test:inventory','compile:logic','content:inventory','package:full','release:verify','workflow:validate','assets:responsive:validate'];
const REQUIRED_FILES=[
 'README.md','AGENTS.md','app/AGENTS.md','app/.dev.vars.example',
 'app/package.json','app/package-lock.json','app/logic-src','app/rules-v3',
 'app/mechanics-v3','app/server','app/public','app/content-active/active.json',
 'app/server/legacy/logic-v1.js','app/src/logic.js','app/src/v2-engine.mjs',
 'app/supabase/migrations/202609260001_atomic_pair_saves.sql',
 'app/supabase/migrations/202609260002_admin_campaign_identity.sql',
 'app/supabase/migrations/202610010004_hot_state_archive_index.sql',
 'docs/developer-workflow-b26.md','docs/code-structure.md',
 'docs/archive/README-pre-B26.md','docs/project-optimization-progress-2026-09-26.md',
 'app/docs/optimization-b09-operations.md'
];
const contains=(text,pattern,label)=>{if(!pattern.test(text))throw new Error(`Workflow contract missing ${label}`);};

export async function verifyWorkflow(root=ROOT){
 for(const file of REQUIRED_FILES)await access(path.join(root,file));
 const read=file=>readFile(path.join(root,file),'utf8');
 const [readme,rootAgents,appAgents,guide,structure,operations,pkgText,lockText,example]=await Promise.all([
  'README.md','AGENTS.md','app/AGENTS.md','docs/developer-workflow-b26.md',
  'docs/code-structure.md','app/docs/optimization-b09-operations.md',
  'app/package.json','app/package-lock.json','app/.dev.vars.example'
 ].map(read));
 const pkg=JSON.parse(pkgText),lock=JSON.parse(lockText);
 for(const script of REQUIRED_SCRIPTS){
  if(typeof pkg.scripts?.[script]!=='string'||!pkg.scripts[script])throw new Error(`Required npm script absent: ${script}`);
  if(!readme.includes(`npm run ${script}`)&&!guide.includes(`npm run ${script}`)&&!(script==='start'&&(readme.includes('npm start')||guide.includes('npm start'))))throw new Error(`Undocumented npm script: ${script}`);
 }
 if(!pkg.scripts.check.includes('workflow:validate'))throw new Error('npm run check must include workflow:validate');
 if(lock.name!==pkg.name||lock.packages?.['']?.name!==pkg.name||JSON.stringify(lock.packages?.['']?.dependencies)!==JSON.stringify(pkg.dependencies))throw new Error('Local package and lockfile disagree');
 for(const [name,text] of Object.entries({README:readme,'root AGENTS':rootAgents,'app AGENTS':appAgents,guide,structure})){
  contains(text,/rules-v3\//,`${name}: V3 rules`);
  contains(text,/logic-src\//,`${name}: generated V2 owner`);
 }
 contains(readme,/npm ci[\s\S]*npm run check[\s\S]*npm test/, 'README clean install order');
 const envExample=readme.match(/```text\n([\s\S]*?)```/)?.[1]||'';
 contains(envExample,/^AUTH_SESSION_SECRET=<unique-random-string-at-least-32-characters>$/m,'README secret placeholder');
 contains(envExample,/^AUTH_ALLOW_LOCAL_BETA=true$/m,'README local beta security setup');
 contains(guide,/PUBLIC_ORIGIN/,'HTTPS canonical origin');
 contains(guide,/202609260001_atomic_pair_saves\.sql[\s\S]*202609260002_admin_campaign_identity\.sql/,'ordered SQL migration contract');
 contains(readme,/docs\/developer-workflow-b26\.md/,'README canonical workflow link');
 contains(rootAgents,/docs\/developer-workflow-b26\.md/,'root AGENTS canonical workflow link');
 contains(appAgents,/developer-workflow-b26\.md/,'app AGENTS canonical workflow link');
 contains(structure,/developer-workflow-b26\.md/,'structure canonical workflow link');
 contains(operations,/Historical B09 snapshot/,'dated B09 operations notice');
 contains(readme,/archived pre-B26 README/,'historical README explicitly archived');
 contains(guide,/mid-match restart|mid-match restart support/,'open PvP recovery declared');
 contains(guide,/39-file set/,'project UI symbol contract declared');
 if(!example.includes('AUTH_ALLOW_LOCAL_BETA=false'))throw new Error('Dev template must disable public local beta by default');
 if(readme.includes('npm install\n'))throw new Error('Quickstart must use lockfile npm ci');
 return {paths:REQUIRED_FILES.length,scripts:REQUIRED_SCRIPTS.length,lockfile:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const value=await verifyWorkflow();
 console.log(`B26 workflow OK — ${value.paths} required paths, ${value.scripts} npm scripts, consistent package lockfile`);
}
