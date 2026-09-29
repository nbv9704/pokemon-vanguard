import {spawnSync} from 'node:child_process';
import {assetReleaseLocations,deploySupabaseAssetRelease,readLocalAssetRelease,verifyRemoteAssetRelease} from './asset-release-lib.mjs';

const mode=process.argv[2]||'plan',bucket=process.env.PV_ASSET_BUCKET||'pokemon-vanguard-assets';
const release=await readLocalAssetRelease(),supabaseUrl=process.env.SUPABASE_URL;
const progress=({stage,completed,total})=>{if(completed===total||completed%50===0)console.log(`${stage}: ${completed}/${total}`);};
if(mode==='plan'){
 const summary={release:release.release,files:release.files,bytes:release.bytes,bucket,requiredEnvironment:['SUPABASE_URL','SUPABASE_SECRET_KEY','PV_ASSET_BUCKET'],publicAssetBaseUrl:supabaseUrl?assetReleaseLocations({supabaseUrl,bucket,release:release.release}).publicBase:'<SUPABASE_URL>/storage/v1/object/public/<PV_ASSET_BUCKET>/releases/'+release.release};console.log(JSON.stringify(summary,null,2));
}else if(mode==='verify'){
 if(!supabaseUrl)throw new Error('SUPABASE_URL is required');const result=await verifyRemoteAssetRelease({release,supabaseUrl,bucket,onProgress:progress});console.log(`remote asset release verified: ${result.files} objects, ${result.bytes} bytes\nPUBLIC_ASSET_BASE_URL=${result.publicBase}`);
}else if(mode==='deploy'){
 if(!supabaseUrl)throw new Error('SUPABASE_URL is required');const rights=spawnSync(process.execPath,['scripts/ui-icon-rights-b34.mjs','--release'],{stdio:'inherit'});if(rights.status!==0)throw new Error('Public asset deployment blocked: distribution-rights gate did not pass');const secretKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;const result=await deploySupabaseAssetRelease({release,supabaseUrl,bucket,secretKey,onProgress:progress});console.log(`immutable asset release deployed and verified\nPUBLIC_ASSET_BASE_URL=${result.publicBase}`);
}else throw new Error('Usage: node scripts/manage-asset-release.mjs plan|deploy|verify');
