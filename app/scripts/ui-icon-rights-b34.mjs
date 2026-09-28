/** Offline-only integrity and human permission gate for the 39 optional LA icons. */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pokemonUiIconEntries} from '../server/pokemon-ui-icons.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const pageFor=asset=>`https://archives.bulbagarden.net/wiki/File:${encodeURIComponent(asset.file)}`;
const approval=(row)=>row.status==='approved'&&['permission','compatible-license'].includes(row.basis)&&
 typeof row.reviewer==='string'&&row.reviewer.trim().length>=2&&
 /^\d{4}-\d{2}-\d{2}$/.test(row.reviewedAt)&&!Number.isNaN(Date.parse(row.reviewedAt))&&
 typeof row.evidence==='string'&&/^https:\/\/\S+/.test(row.evidence)&&
 typeof row.sha256==='string'&&/^[a-f\d]{64}$/.test(row.sha256);

export function validateRightsRegistry(assets,registry){
 if(registry.schemaVersion!==1||!Array.isArray(registry.icons)||registry.icons.length!==assets.length||assets.length!==39)throw Error('Icon rights registry must cover exactly 39 icons');
 const indexed=new Map();
 for(const row of registry.icons){
  if(indexed.has(row.path))throw Error(`Duplicate icon rights entry: ${row.path}`);
  indexed.set(row.path,row);
 }
 for(const asset of assets){
  const row=indexed.get(asset.path);
  if(!row||row.kind!==asset.kind||row.id!==asset.id||row.sourceUrl!==asset.url||row.sourcePage!==pageFor(asset))throw Error(`Missing or stale icon provenance: ${asset.path}`);
  if(row.status!=='pending'&&row.status!=='approved'&&row.status!=='replace')throw Error(`Invalid review status: ${asset.path}`);
  if(row.status==='approved'&&!approval(row))throw Error(`Incomplete human approval: ${asset.path}`);
  if(row.status!=='approved'&&[row.basis,row.evidence,row.reviewer,row.reviewedAt,row.sha256].some(value=>value!==null))throw Error(`Unreviewed icon has approval metadata: ${asset.path}`);
 }
 return indexed;
}

export function verifyApprovedIconBytes(asset,row,bytes){
 if(!approval(row))throw Error(`Unapproved local icon: ${asset.path}; do not ship third-party art without human review`);
 if(hash(bytes)!==row.sha256)throw Error(`Approved icon hash differs: ${asset.path}`);
 if(bytes.length<24||bytes.length>256*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==asset.size[0]||bytes.readUInt32BE(20)!==asset.size[1])throw Error(`Approved icon format/dimensions mismatch: ${asset.path}`);
}

export async function auditUiIconRights({root=ROOT,assets=pokemonUiIconEntries(),registry=null,read=readFile}={}){
 const actual=registry||JSON.parse(await read(path.join(root,'docs/ui-icon-rights-b34.json'),'utf8'));
 const indexed=validateRightsRegistry(assets,actual);
 let present=0;
 for(const asset of assets){
  let bytes;
  try{bytes=await read(path.join(root,asset.path));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  present++;
  const row=indexed.get(asset.path);
  verifyApprovedIconBytes(asset,row,bytes);
 }
 if(present!==0&&present!==assets.length)throw Error(`Partial local icon mirror: ${present}/${assets.length}`);
 return {expected:assets.length,present,approved:actual.icons.filter(approval).length,mode:present===0?'remote-fallback-only':'fully-approved-local'};
}

export async function assertUiIconFetchApproved({root=ROOT,assets=pokemonUiIconEntries()}={}){
 const registry=JSON.parse(await readFile(path.join(root,'docs/ui-icon-rights-b34.json'),'utf8'));
 const indexed=validateRightsRegistry(assets,registry);
 const pending=assets.filter(asset=>!approval(indexed.get(asset.path)));
 if(pending.length)throw Error(`Icon download disabled: ${pending.length}/39 lack documented redistribution approval and pinned SHA-256. See docs/ui-icon-rights-b34.json`);
 return indexed;
}

function approvedImageRecord(item){
 const proof=item.rightsEvidence;
 return item.licenseStatus==='approved-for-public-redistribution'&&proof&&
  approval({status:'approved',...proof})&&proof.sha256===item.source?.sha256;
}

export async function auditPublicAssetRights({root=ROOT}={}){
 const manifest=JSON.parse(await readFile(path.join(root,'docs/image-assets-b25.json'),'utf8'));
 const groups={};let pendingImageRecords=0;
 for(const item of [...manifest.items,...manifest.sprites]){
  const status=item.licenseStatus||'missing-review-status';
  groups[status]=(groups[status]||0)+1;
  if(!approvedImageRecord(item))pendingImageRecords++;
 }
 const icons=await auditUiIconRights({root});
 return {icons,existing:groups,needsHumanReview:pendingImageRecords+(39-icons.approved)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await auditPublicAssetRights();
 console.log(JSON.stringify(result,null,2));
 if(process.argv.includes('--release')){
  if(result.needsHumanReview||result.icons.mode!=='fully-approved-local')throw Error('Public redistribution rights gate NOT CLEARED. See app/docs/image-rights-and-browser-qa-b34.md');
 }
}
