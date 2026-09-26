import {readFile} from 'node:fs/promises';
import {UI_ICONS,TICKET_ASSETS,RANK_BOX_ASSETS} from '../public/js/reward-assets.js';
import {RANKED_TIERS} from '../server/ranked-tiers.mjs';

// Asset registry covers only files already added by the project owner.
const expectKeys=(actual,expected,label)=>{
 if(actual.join('|')!==expected.join('|'))throw new Error(`${label} registry changed: ${actual}`);
};
expectKeys(Object.keys(UI_ICONS),['vp','pokegem','bag'],'UI icons');
expectKeys(Object.keys(TICKET_ASSETS),['training','recruitment','rank','shop'],'Tickets');
expectKeys(Object.keys(RANK_BOX_ASSETS),RANKED_TIERS.map(tier=>tier.id),'Rank boxes versus authoritative tier IDs');
const entries=[...Object.values(UI_ICONS),...Object.values(TICKET_ASSETS),...Object.values(RANK_BOX_ASSETS)];
if(new Set(entries).size!==entries.length)throw new Error('Reward asset paths must be unique');
for(const src of entries){
 if(!/^\/assets\/(icons|items)\/[a-zA-Z0-9_-]+\.png$/.test(src))throw new Error(`Unexpected asset URL: ${src}`);
 const bytes=await readFile(new URL(`../public${src}`,import.meta.url));
 if(bytes.length<100||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Invalid PNG: ${src}`);
 if(bytes.readUInt32BE(16)<64||bytes.readUInt32BE(20)<64)throw new Error(`Asset too small: ${src}`);
 if(![4,6].includes(bytes[25]))throw new Error(`Asset must have alpha channel: ${src}`);
 if(bytes.subarray(-8).toString('hex')!=='49454e44ae426082')throw new Error(`PNG missing IEND chunk: ${src}`);
}
console.log(`UI reward assets OK — ${Object.keys(UI_ICONS).length} UI icons, ${Object.keys(TICKET_ASSETS).length} tickets, ${Object.keys(RANK_BOX_ASSETS).length} rank boxes (${entries.length}/${entries.length})`);
