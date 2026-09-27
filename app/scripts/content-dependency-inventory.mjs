// Read-only content inventory. Unknown historical snapshots are NOT deemed safe to delete.
import {createHash} from 'node:crypto';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const active=path.join(root,'content-active');
const pointer=JSON.parse(await readFile(path.join(active,'active.json'),'utf8'));
const activeFile=path.resolve(active,pointer.catalogFile);
if(!activeFile.startsWith(active+path.sep))throw new Error('Active path traversal');
const activeBody=await readFile(activeFile);
const hash=createHash('sha256').update(activeBody).digest('hex');
if(hash!==pointer.sha256)throw new Error('Active catalog SHA-256 mismatch');
const usage=[];
for(const section of ['server','tests','scripts']){
 const dir=path.join(root,section);
 const files=await readdir(dir,{recursive:true,withFileTypes:true});
 for(const file of files){if(!file.isFile()||!(/\.(?:mjs|js|json)$/).test(file.name))continue;
  const full=path.join(file.parentPath||file.path,file.name),body=await readFile(full,'utf8');
  usage.push({path:path.relative(root,full).replaceAll('\\','/'),body});
 }
}
const catalogs=[];const dirs=(await readdir(path.join(active,'catalogs'),{withFileTypes:true})).filter(item=>item.isDirectory()).map(item=>item.name).sort();
for(const version of dirs){const file=path.join(active,'catalogs',version,'catalog.json');let fileStat;try{fileStat=await stat(file);}catch{continue;}
 const refs=usage.filter(entry=>entry.body.includes(version)).map(entry=>entry.path);
 const kind=file===activeFile?'active':refs.length?'referenced-in-code':'unclassified-retain';
 catalogs.push({version,bytes:fileStat.size,classification:kind,references:refs});
}
const result={activeVersion:pointer.catalogVersion,activeSha256:hash,catalogs,totalBytes:catalogs.reduce((sum,item)=>sum+item.bytes,0),note:'unclassified-retain versions may be needed by save migration/replay: no automatic deletion or archive.'};
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else console.log(`Content inventory OK: active ${pointer.catalogVersion}; ${catalogs.length} snapshots; ${(result.totalBytes/1048576).toFixed(2)} MiB; active SHA-256 verified.\n`+catalogs.filter(item=>item.classification!=='unclassified-retain').map(item=>`${item.classification}: ${item.version} (${item.references.length} refs)`).join('\n'));
