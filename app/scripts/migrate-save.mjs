import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {migrateV1ToV2} from '../server/migrations.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),inputIndex=args.indexOf('--input');
const dryRun=args.includes('--dry-run')||process.env.npm_config_dry_run==='true';
const input=inputIndex>=0?args[inputIndex+1]:args.find(arg=>!arg.startsWith('--'))||(process.env.npm_config_input!=='true'?process.env.npm_config_input:null);
if(!dryRun||!input){
 console.error('Usage: npm run migrate:save -- --dry-run --input <copy-of-save.json>');process.exitCode=1;
}else{
 try{
  const inputPath=path.resolve(input);
  const state=JSON.parse(await readFile(inputPath,'utf8'));
  const identities=JSON.parse(await readFile(path.join(appRoot,'content','species-identities.json'),'utf8'));
  const result=migrateV1ToV2(state,identities);
  console.log(JSON.stringify({mode:'dry-run',input:path.basename(inputPath),status:result.status,...result.report},null,2));
  console.log('No save file was changed.');
 }catch(error){console.error(`Migration dry-run failed: ${error.message}`);process.exitCode=1;}
}
