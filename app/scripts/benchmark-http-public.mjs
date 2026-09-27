// Repeatable catalog serialization/compression baseline; never reads player saves.
import {performance} from 'node:perf_hooks';
import {brotliCompressSync,gzipSync} from 'node:zlib';
import {publicV3Catalog} from '../server/v3-catalog.mjs';
import {publicV2Catalog} from '../server/v2-catalog.mjs';
const warmup=3,iterations=10;
function measure(catalog){
 const raw=Buffer.from(JSON.stringify(catalog)),gzip=gzipSync(raw),br=brotliCompressSync(raw);
 const samples=[];
 for(let i=0;i<warmup+iterations;i++){
  const start=performance.now();JSON.stringify(catalog);const ms=performance.now()-start;
  if(i>=warmup)samples.push(ms);
 }
 samples.sort((a,b)=>a-b);
 return {rawBytes:raw.length,gzipBytes:gzip.length,brotliBytes:br.length,serializeP50Ms:Number(samples[Math.floor(samples.length*.5)].toFixed(3)),serializeP95Ms:Number(samples[Math.ceil(samples.length*.95)-1].toFixed(3))};
}
console.log(JSON.stringify({tool:'public-catalog-benchmark-v1',node:process.version,platform:process.platform,warmup,iterations,catalogs:{v2:measure(publicV2Catalog),v3:measure(publicV3Catalog)},scope:'single-process CPU and payload sizes, not end-to-end network/browser measurements'},null,2));
