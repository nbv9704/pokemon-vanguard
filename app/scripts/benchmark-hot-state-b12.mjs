// Repeatable synthetic benchmark. It never reads a real player save.
import {performance} from 'node:perf_hooks';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {broadcastSharedFrames} from '../server/state-broadcast.mjs';
import {findAppendOnlyBy} from '../server/append-only-index.mjs';

const scales=[1_000,10_000,100_000],iterations=5;
const round=value=>Number(value.toFixed(3));
const percentile=(values,fraction)=>values.toSorted((a,b)=>a-b)[Math.ceil(values.length*fraction)-1];
function timed(work,count=iterations){const values=[];for(let i=0;i<count;i++){const start=performance.now();work();values.push(performance.now()-start);}return {p50Ms:round(percentile(values,.5)),p95Ms:round(percentile(values,.95))};}
const receipt=index=>({actionId:`action:${index}`,fingerprint:`${index.toString(16).padStart(64,'0')}`,kind:'shop.purchase',receiptId:`receipt:${index}`,result:{ok:true,itemId:'leftovers',quantity:1}});
const ledger=index=>({receiptId:`receipt:${index}`,actionId:`action:${index}`,kind:'shop.purchase',delta:{coins:-100,crystals:0,recruitmentTickets:0},balanceBefore:{coins:1_000_000-index,crystals:0,recruitmentTickets:0},balanceAfter:{coins:999_900-index,crystals:0,recruitmentTickets:0},details:{itemId:'leftovers'}});
const battleEvent=index=>({kind:'damage',turn:Math.floor(index/4)+1,sourceId:'a1',targetId:'b1',moveId:'tackle',hpBefore:200-index%200,hpAfter:199-index%200,amount:1});
const message=index=>({id:`message:${index}`,fromAccountId:'a',toAccountId:'b',text:`Synthetic message ${index}`,sentAt:index});
function syntheticState(count){return {schemaVersion:3,revision:count,owner:'synthetic',wallet:{coins:1_000_000,crystals:0,recruitmentTickets:0},economyLedger:Array.from({length:count},(_,index)=>ledger(index)),actionReceipts:Array.from({length:count},(_,index)=>receipt(index)),battleV3:{battle:{events:Array.from({length:count},(_,index)=>battleEvent(index))}},socialV1:{friends:Array.from({length:100},(_,index)=>({accountId:`friend:${index}`})),conversations:Object.fromEntries(Array.from({length:100},(_,friend)=>[`friend:${friend}`,Array.from({length:100},(_,offset)=>message(friend*100+offset))]))}};}
function branchBytes(state){return Object.fromEntries([['economyLedger',state.economyLedger],['actionReceipts',state.actionReceipts],['battleEvents',state.battleV3.battle.events],['socialConversations',state.socialV1.conversations]].map(([key,value])=>[key,Buffer.byteLength(JSON.stringify(value))]));}
function lookupCost(entries){const first=entries[0].actionId,last=entries.at(-1).actionId;return {first:timed(()=>entries.find(entry=>entry.actionId===first),25),last:timed(()=>entries.find(entry=>entry.actionId===last),25),missing:timed(()=>entries.find(entry=>entry.actionId==='missing'),25)};}
function indexedLookupCost(entries){const start=performance.now();findAppendOnlyBy(entries,'actionId','warm-index');const buildMs=round(performance.now()-start),first=entries[0].actionId,last=entries.at(-1).actionId;return {buildMs,first:timed(()=>findAppendOnlyBy(entries,'actionId',first),25),last:timed(()=>findAppendOnlyBy(entries,'actionId',last),25),missing:timed(()=>findAppendOnlyBy(entries,'actionId','missing'),25)};}
function broadcastCost(frame,tabs){const clients=new Map(Array.from({length:tabs},(_,index)=>[{id:index},'owner'])),send=()=>{};let naiveProjections=0;const naive=timed(()=>{for(const audience of clients.values()){JSON.stringify(structuredClone(frame));naiveProjections++;}},3),sharedProjections={count:0},shared=timed(()=>broadcastSharedFrames(clients,{project:()=>{sharedProjections.count++;return structuredClone(frame);},send}),3);return {tabs,frameBytes:Buffer.byteLength(JSON.stringify(frame)),naive:{...naive,projections:naiveProjections/3},shared:{...shared,projections:sharedProjections.count/3}};}

const folder=await mkdtemp(path.join(os.tmpdir(),'pv-hot-state-b12-')),storage=new JsonAdventureStorage(folder),results=[];
try{
 for(const count of scales){
  const state=syntheticState(count),encoded=JSON.stringify(state),serialize=timed(()=>JSON.stringify(state));
  const writeStart=performance.now();await storage.save(`scale-${count}`,state);const durableWriteMs=performance.now()-writeStart;
  results.push({count,totalBytes:Buffer.byteLength(encoded),branches:branchBytes(state),serialize,durableJsonWriteMs:round(durableWriteMs),actionReceiptLinearLookup:lookupCost(state.actionReceipts),actionReceiptIndexedLookup:indexedLookupCost(state.actionReceipts),broadcast:broadcastCost({type:'state',view:{revision:state.revision,battleHistory:state.battleV3.battle.events}},4)});
 }
}finally{await rm(folder,{recursive:true,force:true});}
console.log(JSON.stringify({tool:'hot-state-broadcast-benchmark-b12-v1',node:process.version,platform:process.platform,iterations,scales,syntheticOnly:true,notes:['No real player save is read.','Durable JSON write includes encode, parse validation, temporary-file fsync, reread validation, and rename.','Broadcast comparison uses four same-audience tabs and the current unbounded battle-history shape; it measures the reusable broadcast primitive, not browser render time.'],results},null,2));
