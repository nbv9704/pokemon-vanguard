import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','content');
const read=name=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
const lists={species:read('species.json'),moves:read('moves.json'),abilities:read('abilities.json'),items:read('items.json')};
export const v2Catalog={...lists,speciesById:Object.fromEntries(lists.species.map(value=>[value.id,value])),movesById:Object.fromEntries(lists.moves.map(value=>[value.id,value])),abilitiesById:Object.fromEntries(lists.abilities.map(value=>[value.id,value])),itemsById:Object.fromEntries(lists.items.map(value=>[value.id,value]))};
export const publicV2Catalog=lists;
