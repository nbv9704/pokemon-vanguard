// Deterministic fixture generator; NEVER read .local-data, profile or secret.
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir,cpus,totalmem,platform,arch} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {AccountCoordinator} from '../server/account-coordinator.mjs';
import {broadcastSharedFrames} from '../server/state-broadcast.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const quantile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
const summarize=values=>({count:values.length,rawMs:values.map(value=>Number(value.toFixed(3))),p50Ms:Number(quantile(values,.5).toFixed(3)),p95Ms:Number(quantile(values,.95).toFixed(3))});
const fixture=(count,mode='single')=>({schemaVersion:3,revision:1,owner:'synthetic',wallet:{coins:1000,crystals:0,recruitmentTickets:0},progressionV3:{catalogVersion:'synthetic-b30',mons:Array.from({length:Math.min(count,160)},(_,i)=>({monId:`m${i}`,speciesId:'pikachu',ownership:'permanent'})),builds:[],teams:[],ownedItemIds:[]},actionReceipts:Array.from({length:count},(_,i)=>({actionId:`synthetic-${i}`,fingerprint:`${i}`,type:'shopV3.buy'})),battleV3:{mode,battle:{turn:30,activeSlots:mode==='double'?2:1,events:Array.from({length:Math.min(2000,count)},(_,i)=>({kind:'damage',damage:i%30,turn:Math.floor(i/4)}))}}});
async function timed(work,count=7){await work();const values=[];for(let i=0;i<count;i++){const started=performance.now();await work();values.push(performance.now()-started);}return summarize(values);}
async function main(){
 const quick=process.argv.includes('--quick');
 const outIndex=process.argv.indexOf('--output'),compareIndex=process.argv.indexOf('--compare');
 const output=outIndex>=0?process.argv[outIndex+1]:null,compare=compareIndex>=0?process.argv[compareIndex+1]:null;
 if((outIndex>=0&&!output)||(compareIndex>=0&&!compare))throw new Error('Usage: --output path [--compare baseline.json]');
 const folder=await mkdtemp(path.join(tmpdir(),'pv-ops-b30-')),results=[];
 try{
  const storage=new JsonAdventureStorage(folder);
  for(const [name,size,mode] of (quick?[['small',16,'single'],['large',200,'single'],['long-history-double',500,'double']]:[['small',16,'single'],['large',2000,'single'],['long-history-double',10000,'double']])){
   const state=fixture(size,mode),frame={type:'state',view:state},clients=new Map(Array.from({length:4},(_,i)=>[{id:i},'owner']));
   const serialization=await timed(()=>JSON.stringify(state));
   const save=await timed(()=>storage.save(`synthetic-${name}`,state),4);
   const load=await timed(()=>storage.load(`synthetic-${name}`),4);
   const broadcast=await timed(()=>broadcastSharedFrames(clients,{project:()=>frame,send:()=>{}}));
   results.push({scenario:name,fixtureBytes:Buffer.byteLength(JSON.stringify(state)),serialization,save,load,broadcast});
  }
  const coordinator=new AccountCoordinator(),concurrent=await timed(async()=>Promise.all(Array.from({length:20},(_,i)=>coordinator.withAccounts([`synthetic-${i%4}`,`synthetic-${(i+1)%4}`],()=>Promise.resolve(i)))),5);
  const catalog=await readFile(path.join(root,'content/catalog-contract.json'));
  const metadata={format:'pv-operational-benchmark-v1',fixtureVersion:quick?'B30-fixture-quick-1':'B30-fixture-1',syntheticOnly:true,node:process.version,platform:platform(),arch:arch(),cpus:cpus().length,totalMemoryBytes:totalmem(),catalogContractSha256:sha(catalog),benchmarkSha256:sha(await readFile(fileURLToPath(import.meta.url))),warmup:1};
  const report={metadata,results,concurrentPairOperations:concurrent};
  if(compare){const previous=JSON.parse(await readFile(compare,'utf8'));
   if(previous.metadata?.format!==metadata.format||previous.metadata?.fixtureVersion!==metadata.fixtureVersion||previous.metadata?.catalogContractSha256!==metadata.catalogContractSha256||previous.metadata?.benchmarkSha256!==metadata.benchmarkSha256)throw new Error('Incompatible baseline schema/fixture/catalog');
   report.comparison=results.map((value,index)=>({scenario:value.scenario,p95SaveRatio:Number((value.save.p95Ms/Math.max(.001,previous.results[index]?.save.p95Ms||0)).toFixed(3))}));
  }
  if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');else process.stdout.write(JSON.stringify(report,null,2)+'\n');
 }finally{await rm(folder,{recursive:true,force:true});}
}
await main();
