import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMoves,abilities,items} from '../content-src/battle-catalog.mjs';
import {createSpecies} from '../content-src/species-catalog.mjs';
import {economy} from '../content-src/economy-config.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const identities=JSON.parse(await readFile(path.join(root,'content','species-identities.json'),'utf8'));
const output={moves:createMoves(),abilities,items,species:createSpecies(identities),economy};
await mkdir(path.join(root,'content'),{recursive:true});
for(const [name,value] of Object.entries(output))await writeFile(path.join(root,'content',`${name}.json`),JSON.stringify(value,null,2)+'\n');
console.log(`generated ${output.species.length} species, ${output.moves.length} moves, ${output.abilities.length} abilities, ${output.items.length} items + economy config`);
