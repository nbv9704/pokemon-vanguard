import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SourceTextModule} from 'node:vm';

const defaultAppRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appRoot=process.argv[2]?path.resolve(process.argv[2]):defaultAppRoot;
const roots=['rules-v3','mechanics-v3','server','content-import','public'];
const rootFiles=['local-server.mjs'];
const ignoredPrefixes=['server/legacy/'];
const serverPublicDataAllowlist=new Set(['public/js/ui/pokemon-symbol-assets-data.js']);

const slash=value=>value.replaceAll('\\','/');
const relative=file=>slash(path.relative(appRoot,file));
function walk(directory,out=[]){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name),name=relative(file);
  if(ignoredPrefixes.some(prefix=>name.startsWith(prefix)))continue;
  if(entry.isDirectory())walk(file,out);
  else if(/\.(?:js|mjs)$/.test(entry.name))out.push(file);
 }
 return out;
}

const files=[...roots.flatMap(root=>walk(path.join(appRoot,root))),...rootFiles.map(file=>path.join(appRoot,file)).filter(existsSync)].sort();
const graph=new Map(files.map(file=>[path.resolve(file),[]]));
const problems=[];

function resolveLocal(from,specifier){
 const base=path.resolve(path.dirname(from),specifier),candidates=[base,`${base}.js`,`${base}.mjs`,path.join(base,'index.js'),path.join(base,'index.mjs')];
 return candidates.find(existsSync)||null;
}
function layer(name){
 if(name.startsWith('rules-v3/'))return 'rules';
 if(name.startsWith('mechanics-v3/'))return 'mechanics';
 if(name.startsWith('server/'))return 'server';
 if(name.startsWith('public/'))return 'public';
 return 'composition';
}
function boundaryProblem(from,to){
 const fromName=relative(from),toName=relative(to),fromLayer=layer(fromName),toLayer=layer(toName);
 if(fromLayer==='rules'&&toLayer!=='rules')return 'rules may import only rules';
 if(fromLayer==='mechanics'&&!['rules','mechanics'].includes(toLayer))return 'mechanics may import only rules or mechanics';
 if(fromLayer==='public'&&toLayer!=='public')return 'browser UI may import only browser UI';
 if(fromLayer==='server'&&toLayer==='public'&&!serverPublicDataAllowlist.has(toName))return 'server may not import browser implementation';
 return null;
}

for(const file of files){
 const source=readFileSync(file,'utf8'),name=relative(file),module=new SourceTextModule(source,{identifier:name});
 if(layer(name)==='mechanics'&&/\bfetch\s*\(/u.test(source))problems.push(`${name}: mechanics may not perform network fetches`);
 const dynamicSpecifiers=[...source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/gu)].map(match=>match[2]);
 for(const specifier of new Set([...module.dependencySpecifiers,...dynamicSpecifiers])){
  if(!specifier.startsWith('.'))continue;
  const target=resolveLocal(file,specifier);
  if(!target){problems.push(`${name}: unresolved local import ${specifier}`);continue;}
  if(graph.has(target))graph.get(path.resolve(file)).push(target);
  const violation=boundaryProblem(file,target);if(violation)problems.push(`${name} -> ${relative(target)}: ${violation}`);
 }
}

const state=new Map(),stack=[],stackIndex=new Map(),cycles=[];
function visit(file){
 state.set(file,1);stackIndex.set(file,stack.length);stack.push(file);
 for(const target of graph.get(file)||[]){
  if(!state.has(target))visit(target);
  else if(state.get(target)===1){
   const cycle=stack.slice(stackIndex.get(target)).concat(target).map(relative);
   const canonical=cycle.slice(0,-1).toSorted().join('|');
   if(!cycles.some(entry=>entry.canonical===canonical))cycles.push({canonical,cycle});
  }
 }
 stack.pop();stackIndex.delete(file);state.set(file,2);
}
for(const file of graph.keys())if(!state.has(file))visit(file);
for(const {cycle} of cycles)problems.push(`dependency cycle: ${cycle.join(' -> ')}`);

if(problems.length){
 console.error(`Import boundary gate failed — ${problems.length} problem(s):`);
 for(const problem of problems)console.error(`- ${problem}`);
 process.exit(1);
}
console.log(`import boundaries OK — ${files.length} modules, ${[...graph.values()].reduce((sum,edges)=>sum+edges.length,0)} local edges, 0 cycles`);
