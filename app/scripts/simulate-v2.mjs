import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {availableParallelism} from 'node:os';
import {Worker} from 'node:worker_threads';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {summarizeSimulation} from '../server/v2-simulation-report.mjs';

const args=process.argv.slice(2),positional=args.filter(value=>!value.startsWith('--')),numberArg=(name,fallback,position)=>{const index=args.indexOf(`--${name}`),value=index>=0?Number(args[index+1]):positional[position]!==undefined?Number(positional[position]):fallback;if(!Number.isInteger(value)||value<1)throw new Error(`--${name} must be a positive integer`);return value;};
const seed=numberArg('seed',100,0),matches=numberArg('matches',10000,1),difficultyIndex=args.indexOf('--difficulty'),difficulty=difficultyIndex>=0?args[difficultyIndex+1]:'hard',root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..'),outputArg=args.indexOf('--output'),output=outputArg>=0?path.resolve(args[outputArg+1]):path.join(root,'reports',`balance-v2-seed-${seed}-${matches}.csv`),teams=v2Catalog.aiTeams.exhibition;if(!['easy','normal','hard'].includes(difficulty))throw new Error('--difficulty must be easy, normal or hard');
const csvCell=value=>{const text=String(value);return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};

const workerIndex=args.indexOf('--workers'),workers=Math.min(matches,workerIndex>=0?numberArg('workers',4,2):Math.min(4,availableParallelism())),ranges=Array.from({length:workers},(_,index)=>{const start=Math.floor(matches*index/workers),end=Math.floor(matches*(index+1)/workers);return {start,count:end-start};});let completed=0;
const chunks=await Promise.all(ranges.map(range=>new Promise((resolve,reject)=>{const worker=new Worker(new URL('./simulate-v2-worker.mjs',import.meta.url),{workerData:{...range,seed,difficulty}});worker.on('message',message=>{if(message.progress){completed+=message.progress;if(completed%1000===0)console.log(`simulated ${completed}/${matches}`);}if(message.rows)resolve(message.rows);});worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(new Error(`simulation worker exited ${code}`));});}))),rows=chunks.flat();
const columns=['seed','mode','matchup','firstSide','aiDifficulty','turns','winner','moveUsage','speciesUsage','timeout'],csv=[columns.join(','),...rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\n')+'\n',summary=summarizeSimulation(rows,teams),summaryPath=output.replace(/\.csv$/i,'.summary.json');
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,csv,'utf8');await writeFile(summaryPath,JSON.stringify({...summary,seed,difficulty,report:path.basename(output)},null,2)+'\n','utf8');
console.log(`balance report: ${output}`);console.log(`matches=${summary.matches} averageTurns=${summary.averageTurns} timeoutRate=${summary.timeoutRate}% flaggedTeams=${summary.flags.teamsAbove65Percent.join('|')||'none'}`);
