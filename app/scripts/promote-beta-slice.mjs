import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMechanicsCoverage} from '../mechanics-v3/coverage.mjs';
import {validateBetaSlice} from '../mechanics-v3/beta-slice.mjs';
import {HANDLER_DEFINITIONS} from '../mechanics-v3/handlers/index.mjs';
import {TEST_EVIDENCE} from '../mechanics-v3/test-evidence.mjs';
import {buildPromotedBetaCatalog} from '../content-import/promote-beta.mjs';
import {sha256} from '../content-import/snapshot.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),snapshotId=process.argv[2];
if(!snapshotId)throw new Error('usage: npm run content:promote -- <snapshot-id> [--slice <file>] [--apply]');
const apply=process.argv.includes('--apply')||process.argv.includes('apply')||process.env.npm_config_apply==='true',candidateRoot=path.join(root,'content-candidates',snapshotId),normalized=path.join(candidateRoot,'normalized');
const sliceArg=process.argv.indexOf('--slice'),sliceFile=sliceArg>=0?process.argv[sliceArg+1]:'beta-slice-v17.json',reviewFile=sliceFile.replace(/\.json$/, '-review.json');
const readJson=file=>readFile(file,'utf8').then(JSON.parse);
const [slice,review,fetchManifest,rules,manifests,species,moves,abilities,items]=await Promise.all([
 readJson(path.join(root,'content-src',sliceFile)),readJson(path.join(root,'content-src',reviewFile)),readJson(path.join(candidateRoot,'fetch-manifest.json')),readJson(path.join(root,'rules-v3','rules-contract.json')),readJson(path.join(root,'content-src','mechanics-v3-manifests.json')),
 ...['species','moves','abilities','items'].map(name=>readJson(path.join(normalized,`${name}.json`)))
]);
if(slice.snapshotId!==snapshotId)throw new Error(`slice expects snapshot ${slice.snapshotId}`);
const catalog={species,moves,abilities,items},coverage=buildMechanicsCoverage(catalog,manifests,HANDLER_DEFINITIONS.map(handler=>handler.id),TEST_EVIDENCE),gate=validateBetaSlice(slice,catalog,coverage);
if(!gate.ok)throw new Error(gate.problems.join('; '));
const promoted=buildPromotedBetaCatalog({slice,review,fetchManifest,catalog,manifests,coverage,rules}),body=JSON.stringify(promoted,null,2)+'\n',hash=sha256(Buffer.from(body)),targetRoot=path.join(root,'content-active','catalogs',promoted.metadata.catalogVersion),catalogFile=path.join(targetRoot,'catalog.json'),pointerFile=path.join(root,'content-active','active.json');
console.log(`${apply?'APPLY':'DRY RUN'} ${promoted.metadata.catalogVersion}: ${promoted.species.length} Pokémon, ${promoted.moves.length} moves, ${promoted.abilities.length} abilities, ${promoted.items.length} items; sha256 ${hash}`);
if(apply){await mkdir(targetRoot,{recursive:true});await atomicJson(catalogFile,promoted);await atomicJson(pointerFile,{schemaVersion:1,catalogVersion:promoted.metadata.catalogVersion,catalogFile:`catalogs/${promoted.metadata.catalogVersion}/catalog.json`,sha256:hash});console.log(`active catalog: ${pointerFile}`);}

async function atomicJson(file,value){const temporary=`${file}.${process.pid}.tmp`;await mkdir(path.dirname(file),{recursive:true});await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,file);}
