// Shared launcher for package and release verification on Windows/Linux.
import {spawnSync} from 'node:child_process';
function candidates(){
 const configured=process.env.PYTHON?.trim();
 return configured?[[configured,[]]]:process.platform==='win32'
  ?[['py',['-3']],['python',[]],['python3',[]]]
  :[['python3',[]],['python',[]]];
}
export function spawnPython(script,args=[],options={}){
 let last=null;
 for(const [command,prefix] of candidates()){
  const result=spawnSync(command,[...prefix,script,...args],options);
  if(!result.error)return result;
  last=result.error;if(result.error.code!=='ENOENT')break;
 }
 return {status:null,error:last};
}
export function runPython(script,args=process.argv.slice(2)){
 const result=spawnPython(script,args,{stdio:'inherit'});
 if(!result.error)return result.status??1;
 console.error(`Python 3 is required: ${result.error?.message||'no interpreter found'}`);
 return 1;
}
