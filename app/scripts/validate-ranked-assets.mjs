import {readFile} from 'node:fs/promises';

const EXPECTED=['pokeball.png','greatball.png','ultraball.png','masterball.png','challenger.png'];
const PNG_SIGNATURE='89504e470d0a1a0a';

for(const name of EXPECTED){
 const bytes=await readFile(new URL(`../public/ranks/${name}`,import.meta.url));
 if(bytes.subarray(0,8).toString('hex')!==PNG_SIGNATURE)throw new Error(`Rank asset is not a PNG: ${name}`);
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),colorType=bytes[25];
 if(width<64||height<64)throw new Error(`Rank asset is too small: ${name} (${width}x${height})`);
 if(colorType!==4&&colorType!==6)throw new Error(`Rank asset must preserve alpha transparency: ${name}`);
}
console.log(`rank assets OK — ${EXPECTED.length}/${EXPECTED.length}`);
