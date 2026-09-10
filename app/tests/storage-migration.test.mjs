import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {JsonAdventureStorage} from '../server/storage-json.mjs';
import {setup,applyAction} from '../server/legacy/logic-v1.js';
import {migrateV1ToV2} from '../server/migrations.mjs';

const identities=JSON.parse(await readFile(new URL('../content/species-identities.json',import.meta.url),'utf8'));

test('JSON storage saves atomically, backs up and restores validated state',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'aether-storage-')),backups=path.join(root,'backups'),storage=new JsonAdventureStorage(path.join(root,'saves'));
 try{
  assert.equal(await storage.load('room'),null);await storage.save('room',{owner:'one',coins:10});
  const backup=await storage.backup('room',backups,'before-test');await storage.save('room',{owner:'one',coins:20});
  assert.equal((await storage.load('room')).coins,20);assert.equal((await storage.restore('room',backup)).coins,10);assert.equal((await storage.load('room')).coins,10);
  await assert.rejects(storage.load('../escape'),/Invalid adventure room name/);
  await writeFile(storage.pathFor('broken'),'{bad json');await assert.rejects(storage.load('broken'),/JSON/);assert.equal(await readFile(storage.pathFor('broken'),'utf8'),'{bad json');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('v1 migration preserves progression and is idempotent',()=>{
 const v1=setup(['migration-owner']);v1.coins=3210;v1.gems=777;v1.pity=12;v1.summons=18;v1.wins=4;v1.badges=[0,1];v1.mail=[0];v1.collection[0].level=9;v1.collection[0].item=4;
 const result=migrateV1ToV2(v1,identities);assert.equal(result.status,'migrated');assert.equal(result.state.schemaVersion,2);
 assert.deepEqual(result.state.wallet,{coins:3210,crystals:777});assert.equal(result.state.pity,12);assert.equal(result.state.mons[0].legacyLevel,9);assert.equal(result.state.builds[0].itemId,'swift-feather');assert.equal(result.state.teams[0].buildIds.length,6);
 const again=migrateV1ToV2(result.state,identities);assert.equal(again.status,'current');assert.deepEqual(again.state,result.state);
});

test('migration defers an active v1 battle and rejects newer saves',()=>{
 const owner='active-owner',active=applyAction(setup([owner]),owner,{type:'battle',mode:'single'}),before=JSON.stringify(active);
 const result=migrateV1ToV2(active,identities);assert.equal(result.status,'deferred-active-battle');assert.equal(JSON.stringify(result.state),before);
 assert.throws(()=>migrateV1ToV2({schemaVersion:3},identities),/newer/);
});

