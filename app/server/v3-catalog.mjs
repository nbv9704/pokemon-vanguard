import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from '../content-import/snapshot.mjs';
import {publicBetaCatalog} from '../content-import/promote-beta.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','content-active'),pointer=JSON.parse(readFileSync(path.join(root,'active.json'),'utf8')),file=path.resolve(root,pointer.catalogFile);
if(!file.startsWith(root+path.sep))throw new Error('active catalog path escapes content-active');
const body=readFileSync(file);if(sha256(body)!==pointer.sha256)throw new Error('active catalog hash mismatch');
const lists=JSON.parse(body.toString('utf8'));
export const v3Catalog={...lists,speciesById:Object.fromEntries(lists.species.map(entry=>[entry.id,entry])),movesById:Object.fromEntries(lists.moves.map(entry=>[entry.id,entry])),abilitiesById:Object.fromEntries(lists.abilities.map(entry=>[entry.id,entry])),itemsById:Object.fromEntries(lists.items.map(entry=>[entry.id,entry]))};
export const publicV3Catalog=publicBetaCatalog(lists);
