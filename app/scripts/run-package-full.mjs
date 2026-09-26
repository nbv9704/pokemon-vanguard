import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./package-full.py',import.meta.url));
const configured=process.env.PYTHON?.trim();
const candidates=configured
 ? [[configured,[]]]
 : process.platform==='win32'
  ? [['py',['-3']],['python',[]],['python3',[]]]
  : [['python3',[]],['python',[]]];

let lastError=null;
for(const [command,prefix] of candidates){
 const result=spawnSync(command,[...prefix,script,...process.argv.slice(2)],{stdio:'inherit'});
 if(!result.error)process.exit(result.status??1);
 lastError=result.error;
 if(result.error.code!=='ENOENT')break;
}

console.error(`Unable to launch Python: ${lastError?.message||'no supported interpreter found'}`);
process.exit(1);
