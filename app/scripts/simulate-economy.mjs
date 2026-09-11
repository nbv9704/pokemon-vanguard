import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {simulateRecruitmentEconomy} from '../server/v2-economy-simulation.mjs';

const args=process.argv.slice(2),numberArg=(name,fallback)=>{const index=args.indexOf(`--${name}`),value=index>=0?Number(args[index+1]):fallback;if(!Number.isInteger(value)||value<1)throw new Error(`--${name} must be a positive integer`);return value;},seed=numberArg('seed',424242),cycles=numberArg('cycles',100000),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..'),outputIndex=args.indexOf('--output'),output=outputIndex>=0?path.resolve(args[outputIndex+1]):path.join(root,'reports',`recruitment-m4-seed-${seed}-${cycles}.summary.json`),report=simulateRecruitmentEconomy({cycles,seed,catalog:v2Catalog});
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');console.log(`recruitment report: ${output}`);console.log(`cycles=${report.cycles} lineupSize=${report.lineupSize} invalidLineups=${report.invalidLineups} appearanceRange=${report.minAppearances}-${report.maxAppearances}`);
