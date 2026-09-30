import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {SupabaseAdventureStorage} from '../server/storage-supabase.mjs';
import {findAppendOnlyBy} from '../server/append-only-index.mjs';
import {commitReceiptCommand} from '../server/receipt-command-handler.mjs';

const receipts=(count,prefix='action')=>Array.from({length:count},(_,index)=>({actionId:`${prefix}-${index}`,kind:'test',fingerprint:`fp-${index}`,receiptId:`receipt-${index}`,result:{index}}));
const execFileAsync=promisify(execFile);
const state=(owner,count=600)=>({schemaVersion:1,owner,revision:1,actionReceipts:receipts(count),economyLedger:Array.from({length:count},(_,index)=>({receiptId:`ledger-${index}`,kind:'test',delta:{coins:0}})),battle:{id:'finished-battle',phase:'FINISHED',result:{winner:'A'},events:Array.from({length:count},(_,index)=>({kind:'event',index}))}});

test('JSON storage archives old receipts and finished events before bounding hot state',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-hot-state-'));try{
  const storage=new JsonAdventureStorage(dir),original=state('hot-json');await storage.save('hot-json',original);
  assert.equal(original.actionReceipts.length,512);assert.equal(original.economyLedger.length,512);assert.equal(original.battle.events.length,512);
  const cold=await storage.load('hot-json');assert.equal(cold.actionReceipts[0].actionId,'action-88');assert.equal(findAppendOnlyBy(cold.actionReceipts,'actionId','action-0'),null);
  const hydrated=await storage.loadForAction('hot-json','action-0');assert.equal(findAppendOnlyBy(hydrated.actionReceipts,'actionId','action-0').result.index,0);assert.equal(hydrated.actionReceipts.length,513);
  const ledger=await storage.loadForAction('hot-json','ledger-0');assert.equal(findAppendOnlyBy(ledger.economyLedger,'receiptId','ledger-0').kind,'test');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('JSON pair saves compact both accounts and preserve archived retry lookup',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-hot-pair-'));try{
  const storage=new JsonAdventureStorage(dir),left=state('left',513),right=state('right',513);
  await storage.savePair([{userId:'left',state:left},{userId:'right',state:right}],'hot-pair-1');
  assert.equal(left.actionReceipts.length,512);assert.equal(right.actionReceipts.length,512);
  assert.equal(findAppendOnlyBy((await storage.loadForAction('left','action-0')).actionReceipts,'actionId','action-0').fingerprint,'fp-0');
  assert.equal(findAppendOnlyBy((await storage.loadForAction('right','action-0')).actionReceipts,'actionId','action-0').fingerprint,'fp-0');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('segmented JSON archive is readable after a real process restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-hot-restart-'));try{
  await new JsonAdventureStorage(dir).save('restart',state('restart',513));
  const moduleUrl=new URL('../server/storage-json.mjs',import.meta.url).href,script=`import {JsonAdventureStorage} from ${JSON.stringify(moduleUrl)};const state=await new JsonAdventureStorage(process.argv[1]).loadForAction('restart','action-0');process.stdout.write(JSON.stringify(state.actionReceipts.find(row=>row.actionId==='action-0')));`;
  const {stdout}=await execFileAsync(process.execPath,['--input-type=module','-e',script,dir]);assert.equal(JSON.parse(stdout).result.index,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a command retry older than the hot window is resolved from archive without persisting twice',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pv-hot-retry-'));try{
  const storage=new JsonAdventureStorage(dir),initial=state('retry',513);await storage.save('retry',initial);let writes=0;
  const action={type:'synthetic',actionId:'action-0'},result=await commitReceiptCommand({accountId:'retry',liveState:null,load:(id,input)=>storage.loadForAction(id,input.actionId),persist:async()=>{writes++;},action,apply:(saved,input)=>{
   const prior=findAppendOnlyBy(saved.actionReceipts,'actionId',input.actionId);return prior?{ok:true,state:saved,duplicate:true,receipt:prior.result}:{ok:true,state:{...saved,mutated:true},duplicate:false};
  }});
  assert.equal(result.ok,true);assert.equal(result.duplicate,true);assert.equal(result.receipt.index,0);assert.equal(writes,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Supabase adapter uses existing backup storage for archive and hydrates one old key',async()=>{
 const userId='11111111-1111-4111-8111-111111111111',archives=new Map(),calls=[];let cloudState=null,revision=0;
 const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 const fetchImpl=async(url,init={})=>{calls.push([url,init.method||'GET']);const parsed=new URL(url),resource=parsed.pathname.split('/').at(-1);
  if(resource==='game_saves'){if((init.method||'GET')==='GET')return response(cloudState?[{state:cloudState,revision}]:[]);cloudState=JSON.parse(init.body).state;revision++;return response([{revision}]);}
  if(resource==='game_save_backups'){
   if((init.method||'GET')==='GET'){const filter=parsed.searchParams.get('label')||'',labels=filter.startsWith('in.(')?filter.slice(4,-1).split(','):[filter.replace(/^eq\./,'')];return response(labels.flatMap(label=>archives.has(label)?[{label,state:archives.get(label)}]:[]));}
   const body=JSON.parse(init.body);for(const row of Array.isArray(body)?body:[body])archives.set(row.label,row.state);return response([]);
  }
  throw new Error(`Unexpected mock request: ${url}`);
 };
 const storage=new SupabaseAdventureStorage({url:'https://project.supabase.co',secretKey:'sb_secret_test',fetchImpl});storage.revisions.set(userId,null);
 const original=state('cloud',513);await storage.save(userId,original);assert.equal(original.actionReceipts.length,512);assert.ok(archives.size>=3);assert.equal(revision,2);
 const hydrated=await storage.loadForAction(userId,'action-0');assert.equal(findAppendOnlyBy(hydrated.actionReceipts,'actionId','action-0').result.index,0);assert.ok(calls.some(([url,method])=>method==='POST'&&url.includes('game_save_backups')));
});

test('Supabase archive lookup migration is a narrow partial index with no browser grant',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/202610010004_hot_state_archive_index.sql',import.meta.url),'utf8');
 assert.match(sql,/create index if not exists game_save_backups_hot_archive_lookup_idx/i);assert.match(sql,/\(user_id, label\)/i);assert.match(sql,/where label like 'hot-v1:%'/i);assert.doesNotMatch(sql,/grant\s+/i);
});
