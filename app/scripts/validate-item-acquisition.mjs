import {v3Catalog} from '../server/v3-catalog.mjs';
import {V3_BEGINNING_ITEM_IDS,V3_ITEM_ACQUISITION_SOURCE,v3ItemAcquisition,validateV3ItemAcquisitionCatalog} from '../server/v3-item-acquisition.mjs';

const problems=validateV3ItemAcquisitionCatalog(v3Catalog),counts={};
for(const item of v3Catalog.items){const acquisition=v3ItemAcquisition(item);counts[acquisition.kind]=(counts[acquisition.kind]||0)+1;}
if(V3_BEGINNING_ITEM_IDS.length!==10)problems.push(`expected 10 Beginning items, got ${V3_BEGINNING_ITEM_IDS.length}`);
for(const [kind,expected] of Object.entries({beginning:10,shop:122,'mega-tutorial':8,deposit:1}))if((counts[kind]||0)!==expected)problems.push(`expected ${expected} ${kind} items, got ${counts[kind]||0}`);
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log(`item acquisition OK — ${v3Catalog.items.length} battle items · ${counts.beginning} Beginning · ${counts.shop} Shop · ${counts['mega-tutorial']} tutorial · ${counts.deposit} deposit-only`);
console.log(`source: ${V3_ITEM_ACQUISITION_SOURCE}`);
