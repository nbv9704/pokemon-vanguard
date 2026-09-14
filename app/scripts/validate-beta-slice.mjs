import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMechanicsCoverage} from '../mechanics-v3/coverage.mjs';
import {validateBetaSlice} from '../mechanics-v3/beta-slice.mjs';
import {HANDLER_DEFINITIONS} from '../mechanics-v3/handlers/index.mjs';
import {TEST_EVIDENCE} from '../mechanics-v3/test-evidence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sliceFile=process.argv[2]||'beta-slice-v16.json',slice=await readJson(path.join(root,'content-src',sliceFile));
const normalized=path.join(root,'content-candidates',slice.snapshotId,'normalized');
const [species,moves,abilities,items,manifests]=await Promise.all(['species.json','moves.json','abilities.json','items.json'].map(file=>readJson(path.join(normalized,file))).concat(readJson(path.join(root,'content-src','mechanics-v3-manifests.json'))));
const catalog={species,moves,abilities,items},coverage=buildMechanicsCoverage(catalog,manifests,HANDLER_DEFINITIONS.map(handler=>handler.id),TEST_EVIDENCE),result=validateBetaSlice(slice,catalog,coverage);
if(!result.ok){console.error(result.problems.join('\n'));process.exitCode=1;}else console.log(`${slice.id}: ${result.summary.members} Pokémon, ${result.summary.types.length} types, ${result.summary.moveIds.length} moves, ${result.summary.abilityIds.length} abilities, ${result.summary.itemIds.length} items`);

function readJson(file){return readFile(file,'utf8').then(JSON.parse);}
