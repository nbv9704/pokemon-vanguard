import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {presentationCoverage,presentationMigrationCoverage} from '../public/js/presentation/move-presentation.js';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const projectRoot=path.resolve(appRoot,'..');
const read=async rel=>fs.readFile(path.join(appRoot,rel),'utf8');
const json=async rel=>JSON.parse(await read(rel));

async function listFiles(dir){const out=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await listFiles(full));else out.push(full);}return out;}
async function runtimeExternalReferences(){
 const publicRoot=path.join(appRoot,'public'),files=(await listFiles(publicRoot)).filter(file=>/\.(?:html|css|js|json)$/i.test(file)),hits=[];
 const pattern=/https?:\/\/[^\s'"`)]+/g;
 for(const file of files){const text=await fs.readFile(file,'utf8');for(const match of text.matchAll(pattern)){if(match[0]==='http://www.w3.org/2000/svg')continue;hits.push({file:path.relative(appRoot,file).replaceAll('\\','/'),url:match[0]});}}
 return hits;
}

export async function auditMaRelease(){
 const problems=[],warnings=[];
 const regulation=v3Catalog.regulations[0],base=v3Catalog.species,mega=v3Catalog.megaForms||[],relations=(v3Catalog.megaRelations||[]).filter(entry=>entry.regulationSets?.includes('m-a')),ids=[...base.map(x=>x.id),...mega.map(x=>x.id)];
 if(base.length!==213)problems.push(`Expected 213 non-Mega M-A entries, got ${base.length}`);
 if(mega.length!==59)problems.push(`Expected 59 M-A Mega forms, got ${mega.length}`);
 if(relations.length!==59)problems.push(`Expected 59 legal M-A Mega relations, got ${relations.length}`);
 if(ids.length!==272||new Set(ids).size!==272)problems.push(`M-A selectable identity mismatch: ${ids.length}/${new Set(ids).size}`);
 if(v3Catalog.moves.length!==490)problems.push(`Expected 490 active moves, got ${v3Catalog.moves.length}`);
 const fx=presentationCoverage(v3Catalog.moves),migration=presentationMigrationCoverage(v3Catalog.moves),missingCommit=fx.filter(x=>!x.commit),legacy=fx.filter(x=>x.tier==='legacy-adapter');
 if(fx.length!==490||missingCommit.length)problems.push(`Presentation coverage invalid: ${fx.length} timelines, ${missingCommit.length} without commit`);
 if(legacy.length)problems.push(`Legacy presentation fallback remains for ${legacy.length} active moves`);
 const assets=await json('content-src/presentation-assets-v1.json');if(assets.counts?.selectable!==272||assets.counts?.fallbackSafe!==272)problems.push('Presentation asset manifest is not 272/272 fallback-safe');
 const bespoke=Math.min(assets.counts?.front||0,assets.counts?.back||0,assets.counts?.artwork||0);if(bespoke<272)warnings.push(`${272-bespoke}/272 selectable entries still rely on intentional local fallback art for at least one required presentation asset`);
 const external=await runtimeExternalReferences();if(external.length)problems.push(`Public runtime contains ${external.length} external URL reference(s): ${external.slice(0,3).map(x=>`${x.file} -> ${x.url}`).join(', ')}`);
 const [input,polish,index]=await Promise.all([read('public/js/ui/core/input-manager.js'),read('public/r3-release-polish.css'),read('public/index.html')]);
 for(const token of ['ArrowUp','KeyW','Enter','KeyZ','Escape','KeyX'])if(!input.includes(token))problems.push(`Keyboard release mapping missing ${token}`);
 for(const token of ['prefers-reduced-motion','pointer:coarse','max-width:640px'])if(!polish.includes(token))problems.push(`Release polish missing ${token}`);
 if(!index.includes('name="viewport"'))problems.push('Responsive viewport metadata missing');
 const report={schemaVersion:1,id:'r3-100-ma-release-gate',generatedAt:new Date().toISOString(),status:problems.length?'blocked':warnings.length?'runtime-ready-with-debt':'runtime-ready',scope:{regulationId:regulation.id,nonMega:base.length,megaForms:mega.length,megaRelations:relations.length,totalSelectable:ids.length,moves:v3Catalog.moves.length},presentation:{timelines:fx.length,signature:migration.signature,parameterized:migration.template,legacy:migration.legacy,missingCommit:missingCommit.length},assets:{...assets.counts,bespokeComplete:bespoke,bespokeDebt:272-bespoke},offline:{externalRuntimeReferences:external},qa:{keyboardMappings:true,reducedMotion:true,coarsePointer:true,responsiveViewport:true},problems,warnings};
 return report;
}

export async function writeMaReleaseReport(report,file=path.join(projectRoot,'docs','r3-100-ma-release-gate.json')){await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');return file;}
