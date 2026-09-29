import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir,rm,utimes,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JsonAdventureStorage} from '../server/storage-json.mjs';

const helper=fileURLToPath(new URL('./helpers/json-storage-child.mjs',import.meta.url));
const base=(owner='alpha',coins=100)=>({schemaVersion:3,owner,revision:1,wallet:{coins,crystals:0,recruitmentTickets:0}});
async function fixture(t,options={}){const dir=await mkdtemp(path.join(os.tmpdir(),'pv-json-b43-'));t.after(()=>rm(dir,{recursive:true,force:true}));return {dir,storage:new JsonAdventureStorage(dir,options)};}
function child(args){return new Promise((resolve,reject)=>{const proc=spawn(process.execPath,[helper,...args],{stdio:['ignore','pipe','pipe']}),out=[],err=[];proc.stdout.on('data',x=>out.push(x));proc.stderr.on('data',x=>err.push(x));proc.on('error',reject);proc.on('exit',(code,signal)=>resolve({code,signal,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));});}

test('save schema rejects corrupt, future, invalid economy and dangling progression references without replacing the last good save',async t=>{
 const {dir,storage}=await fixture(t),valid=base();await storage.save('alpha',valid);
 const invalid=[{...valid,owner:''},{...valid,schemaVersion:4},{...valid,wallet:{...valid.wallet,coins:-1}},{...valid,progressionV3:{catalogVersion:'v1',mons:[],builds:[{buildId:'b1',monId:'missing'}],teams:[]}}];
 for(const candidate of invalid){await assert.rejects(storage.save('alpha',candidate),error=>/^STORAGE_SAVE_(SCHEMA|VERSION|REFERENCE)_/.test(error.code));assert.deepEqual(await storage.load('alpha'),valid);}
 const corrupt=path.join(dir,'broken.json');await writeFile(corrupt,'{"schemaVersion":3,"wallet":');await assert.rejects(storage.load('broken'));assert.equal(await readFile(corrupt,'utf8'),'{"schemaVersion":3,"wallet":');
});

test('write failure leaves the prior valid save byte-identical and stale unique temp files are reclaimed',async t=>{
 const {dir,storage}=await fixture(t,{staleTempMs:20}),valid=base();await storage.save('alpha',valid);const before=await readFile(path.join(dir,'alpha.json'),'utf8');
 const original=storage.writeState.bind(storage);storage.writeState=async()=>{throw Object.assign(new Error('permission denied'),{code:'EACCES'});};
 await assert.rejects(storage.save('alpha',base('alpha',999)),error=>error.code==='EACCES');storage.writeState=original;assert.equal(await readFile(path.join(dir,'alpha.json'),'utf8'),before);
 const stale=path.join(dir,'alpha.json.11111111-1111-4111-8111-111111111111.tmp');await writeFile(stale,'partial');const old=new Date(Date.now()-1000);await utimes(stale,old,old);
 const reopened=new JsonAdventureStorage(dir,{staleTempMs:20});assert.deepEqual(await reopened.load('alpha'),valid);await assert.rejects(readFile(stale),error=>error.code==='ENOENT');
});

test('versioned backups carry checksum/account metadata, enforce retention and make a pre-restore safety backup',async t=>{
 let timestamp=Date.UTC(2026,8,29,10);const {dir,storage}=await fixture(t,{now:()=>timestamp,backupRetention:2}),backups=path.join(dir,'backups');
 await storage.save('alpha',base('alpha',10));const first=await storage.backup('alpha',backups,'manual');timestamp+=1000;
 await storage.save('alpha',base('alpha',20));const second=await storage.backup('alpha',backups,'manual');timestamp+=1000;
 await storage.save('alpha',base('alpha',30));const third=await storage.backup('alpha',backups,'manual');
 const files=await readdir(backups);assert.equal(files.length,2);assert.equal(files.some(name=>first.endsWith(name)),false);
 const envelope=JSON.parse(await readFile(second,'utf8'));assert.equal(envelope.version,1);assert.equal(envelope.userId,'alpha');assert.match(envelope.checksum,/^[a-f0-9]{64}$/);assert.equal(envelope.schemaVersion,3);
 await assert.rejects(storage.restore('beta',second),error=>error.code==='STORAGE_RESTORE_ACCOUNT_MISMATCH');
 const tampered=JSON.parse(await readFile(third,'utf8'));tampered.state.wallet.coins=777;await writeFile(third,JSON.stringify(tampered));await assert.rejects(storage.restore('alpha',third),error=>error.code==='STORAGE_BACKUP_CHECKSUM_MISMATCH');assert.equal((await storage.load('alpha')).wallet.coins,30);
 assert.equal((await storage.restore('alpha',second)).wallet.coins,20);assert.equal((await storage.load('alpha')).wallet.coins,20);assert.equal((await readdir(path.join(dir,'.restore-backups'))).length,1);
});

test('restore preserves a corrupt current save verbatim before replacing it with a verified backup',async t=>{
 const {dir,storage}=await fixture(t),backups=path.join(dir,'backups');await storage.save('alpha',base('alpha',10));const backup=await storage.backup('alpha',backups,'known-good'),raw='{"schemaVersion":3,"wallet":';await writeFile(path.join(dir,'alpha.json'),raw);
 assert.equal((await storage.restore('alpha',backup)).wallet.coins,10);const recoveryFiles=await readdir(path.join(dir,'.restore-backups'));assert.equal(recoveryFiles.length,1);const recovery=JSON.parse(await readFile(path.join(dir,'.restore-backups',recoveryFiles[0]),'utf8'));assert.equal(recovery.validState,false);assert.equal(recovery.rawState,raw);assert.match(recovery.checksum,/^[a-f0-9]{64}$/);
});

test('cross-process directory lock serializes independent pair WAL commits',async t=>{
 const {dir,storage}=await fixture(t,{staleLockMs:150});for(const id of ['a','b','c','d'])await storage.save(id,base(id));
 const results=await Promise.all([child(['pair',dir,'a','b','pair:child:ab']),child(['pair',dir,'c','d','pair:child:cd'])]);for(const result of results)assert.equal(result.code,0,result.stderr);
 const reopened=new JsonAdventureStorage(dir,{staleLockMs:150});for(const id of ['a','c'])assert.equal((await reopened.load(id)).wallet.coins,110);for(const id of ['b','d'])assert.equal((await reopened.load(id)).wallet.coins,90);
 assert.deepEqual(await reopened.savePair([{userId:'a',state:base('a',110)},{userId:'b',state:base('b',90)}],'pair:child:ab'),{duplicate:true});
});

test('real process termination after the first rename leaves WAL that a fresh process rolls forward',async t=>{
 const {dir,storage}=await fixture(t,{staleLockMs:150});await storage.save('a',base('a'));await storage.save('b',base('b'));
 const crashed=await child(['crash',dir,'a','b','pair:crash:ab']);assert.equal(crashed.code,91,crashed.stderr);
 const reopened=new JsonAdventureStorage(dir,{staleLockMs:150,lockTimeoutMs:5000});assert.equal((await reopened.load('a')).wallet.coins,110);assert.equal((await reopened.load('b')).wallet.coins,90);
 assert.deepEqual(await reopened.savePair([{userId:'a',state:base('a',110)},{userId:'b',state:base('b',90)}],'pair:crash:ab'),{duplicate:true});
});

test('an abandoned stale storage lock is recovered without deleting player data',async t=>{
 const {dir,storage}=await fixture(t);await storage.save('alpha',base());const lock=path.join(dir,'.storage.lock');await mkdir(lock);await writeFile(path.join(lock,'owner.json'),JSON.stringify({token:'dead'}));const old=new Date(Date.now()-1000);await utimes(lock,old,old);
 const reopened=new JsonAdventureStorage(dir,{staleLockMs:20,lockTimeoutMs:2000});assert.equal((await reopened.load('alpha')).wallet.coins,100);assert.equal((await reopened.save('alpha',base('alpha',101))),undefined);assert.equal((await reopened.load('alpha')).wallet.coins,101);
});
