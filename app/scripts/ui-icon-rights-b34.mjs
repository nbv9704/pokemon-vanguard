/** Public-asset rights summary. Project-owned B36 symbols need no upstream registry. */
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectProjectUiSymbols} from './validate-project-ui-symbols-b36.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function approvedImageRecord(item){
 const proof=item.rightsEvidence;
 return item.licenseStatus==='approved-for-public-redistribution'&&proof&&
  typeof proof.reviewer==='string'&&proof.reviewer.trim().length>=2&&
  /^\d{4}-\d{2}-\d{2}$/.test(proof.reviewedAt)&&typeof proof.evidence==='string'&&/^https:\/\/\S+/.test(proof.evidence)&&
  /^[a-f\d]{64}$/.test(proof.sha256)&&proof.sha256===item.source?.sha256;
}

export async function auditPublicAssetRights({root=ROOT}={}){
 const manifest=JSON.parse(await readFile(path.join(root,'docs/image-assets-b25.json'),'utf8'));
 const groups={};let pendingImageRecords=0;
 for(const item of [...manifest.items,...manifest.sprites]){
  const status=item.licenseStatus||'missing-review-status';
  groups[status]=(groups[status]||0)+1;
  if(!approvedImageRecord(item))pendingImageRecords++;
 }
 const projectSymbols=await inspectProjectUiSymbols({root});
 return {projectSymbols,existing:groups,needsHumanReview:pendingImageRecords,releaseReady:pendingImageRecords===0&&projectSymbols.complete};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await auditPublicAssetRights();
 console.log(JSON.stringify(result,null,2));
 if(process.argv.includes('--release')&&!result.releaseReady)throw Error('Public redistribution gate NOT CLEARED. Finish existing asset review and supply all project-owned UI symbols.');
}
