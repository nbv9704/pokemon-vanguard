import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';

const initial={schemaVersion:3,wallet:{coins:100,crystals:0,recruitmentTickets:0}};
const state=coins=>({...initial,wallet:{...initial.wallet,coins}});
const pair=(a=110,b=90)=>[{userId:'a',state:state(a)},{userId:'b',state:state(b)}];
async function fixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'pv-pair-wal-'));t.after(()=>rm(dir,{recursive:true,force:true}));const storage=new JsonAdventureStorage(dir);await storage.save('a',initial);await storage.save('b',initial);return {dir,storage};}

class CrashOnSecond extends JsonAdventureStorage{
 constructor(dir){super(dir);this.failRight=false;}
 async writeState(id,text){if(this.failRight&&id==='b'){this.failRight=false;throw Object.assign(new Error('Injected disk write failure'),{code:'ENOSPC'});}return super.writeState(id,text);}
}

test('JSON pair WAL saves both players, keeps a durable receipt, and rejects ID payload changes',async t=>{
 const {dir,storage}=await fixture(t),op='ranked:settlement:wal-test';
 assert.deepEqual(await storage.savePair(pair(),op),{duplicate:false});
 assert.equal((await storage.load('a')).wallet.coins,110);assert.equal((await storage.load('b')).wallet.coins,90);
 const restarted=new JsonAdventureStorage(dir);
 assert.deepEqual(await restarted.savePair(pair(),op),{duplicate:true});
 await assert.rejects(restarted.savePair(pair(800,90),op),e=>e.code==='STORAGE_PAIR_ID_CONFLICT');
 assert.equal((await restarted.load('a')).wallet.coins,110);
});

test('JSON pair WAL repairs a partial commit after simulated restart before exposing accounts',async t=>{
 const {dir}=await fixture(t),faulty=new CrashOnSecond(dir);
 faulty.failRight=true;
 await assert.rejects(faulty.savePair(pair(), 'social:wal:partial'),e=>e.code==='ENOSPC');
 assert.equal(JSON.parse(await readFile(path.join(dir,'a.json'))).wallet.coins,110);
 assert.equal(JSON.parse(await readFile(path.join(dir,'b.json'))).wallet.coins,100);
 await assert.rejects(faulty.load('a'),e=>e.code==='STORAGE_PAIR_RESTART_REQUIRED');
 await assert.rejects(faulty.save('a',state(5)),e=>e.code==='STORAGE_PAIR_RESTART_REQUIRED');
 const reopened=new JsonAdventureStorage(dir);assert.equal((await reopened.load('b')).wallet.coins,90);
 assert.equal((await reopened.load('a')).wallet.coins,110);
 assert.deepEqual(await reopened.savePair(pair(),'social:wal:partial'),{duplicate:true});
});

test('JSON WAL refuses to overwrite an externally diverged account during repair',async t=>{
 const {dir}=await fixture(t),faulty=new CrashOnSecond(dir);faulty.failRight=true;
 await assert.rejects(faulty.savePair(pair(),'social:wal:conflict'));
 await writeFile(path.join(dir,'b.json'),JSON.stringify(state(999)));
 const reopened=new JsonAdventureStorage(dir);
 await assert.rejects(reopened.load('a'),e=>e.code==='STORAGE_PAIR_RECOVERY_CONFLICT');
 assert.equal(JSON.parse(await readFile(path.join(dir,'b.json'))).wallet.coins,999);
 await assert.rejects(reopened.save('b',state(1)),e=>e.code==='STORAGE_PAIR_RECOVERY_CONFLICT');
});

test('corrupt WAL fails closed; single-save and restore cannot bypass it',async t=>{
 const {dir}=await fixture(t),pending=path.join(dir,'.transactions','pending.json');
 await mkdir(path.dirname(pending),{recursive:true});await writeFile(pending,'{"version":1,"entries":');
 const storage=new JsonAdventureStorage(dir);
 await assert.rejects(storage.load('a'),e=>e.code==='STORAGE_PAIR_JOURNAL_CORRUPT');
 await assert.rejects(storage.save('a',state(0)),e=>e.code==='STORAGE_PAIR_JOURNAL_CORRUPT');
 const trusted=path.join(dir,'trusted-backup.bak');await writeFile(trusted,JSON.stringify(initial));
 await assert.rejects(storage.restore('a',trusted),e=>e.code==='STORAGE_PAIR_JOURNAL_CORRUPT');
 assert.equal(JSON.parse(await readFile(path.join(dir,'a.json'))).wallet.coins,100);
});

test('parallel callers using the same operation ID execute once through shared directory queue',async t=>{
 const {dir,storage}=await fixture(t),second=new JsonAdventureStorage(dir);
 const results=await Promise.all([storage.savePair(pair(),'social:parallel:id'),second.savePair([...pair()].reverse(),'social:parallel:id')]);
 assert.deepEqual(results.map(r=>r.duplicate).sort(),[false,true]);
 assert.equal((await storage.load('a')).wallet.coins,110);assert.equal((await second.load('b')).wallet.coins,90);
});

test('invalid pair arguments do not alter player saves or emit a WAL',async t=>{
 const {storage}=await fixture(t);
 await assert.rejects(storage.savePair([{userId:'a',state:state(5)}],'invalid'),e=>e.code==='STORAGE_PAIR_INVALID');
 await assert.rejects(storage.savePair([{userId:'a',state:state(5)},{userId:'a',state:state(6)}],'invalid'),e=>e.code==='STORAGE_PAIR_INVALID');
 await assert.rejects(storage.savePair(pair(),'bad/operation'),e=>e.code==='STORAGE_PAIR_INVALID');
 assert.equal((await storage.load('a')).wallet.coins,100);
});


test('recovery recreates a missing receipt when both account files were already written',async t=>{
 const {dir,storage}=await fixture(t),original=storage.pairJournal.writeReceipt.bind(storage.pairJournal);
 storage.pairJournal.writeReceipt=async()=>{throw Object.assign(new Error('Interrupted before receipt'),{code:'ENOSPC'});};
 await assert.rejects(storage.savePair(pair(),'ranked:receipt:replay'),e=>e.code==='ENOSPC');
 assert.equal(JSON.parse(await readFile(path.join(dir,'a.json'))).wallet.coins,110);
 assert.equal(JSON.parse(await readFile(path.join(dir,'b.json'))).wallet.coins,90);
 storage.pairJournal.writeReceipt=original;
 const reopened=new JsonAdventureStorage(dir);
 assert.equal((await reopened.load('a')).wallet.coins,110);
 assert.deepEqual(await reopened.savePair(pair(),'ranked:receipt:replay'),{duplicate:true});
});

test('WAL repairs failure before writing either account on restart',async t=>{
 const {dir}=await fixture(t),faulty=new CrashOnSecond(dir);
 const write=faulty.writeState.bind(faulty);let once=true;
 faulty.writeState=(room,encoded)=>{if(once){once=false;throw Error('Simulated crash before first rename');}return write(room,encoded);};
 await assert.rejects(faulty.savePair(pair(),'social:first-write'));
 const reopened=new JsonAdventureStorage(dir);
 assert.equal((await reopened.load('a')).wallet.coins,110);
 assert.equal((await reopened.load('b')).wallet.coins,90);
});
