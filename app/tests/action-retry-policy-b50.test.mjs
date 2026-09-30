import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {playerActionAck,playerActionRetryScope} from '../server/player-action-retry-policy.mjs';

test('B50 classifies durable account mutations separately from session-owned PvP commands',()=>{
 const durable=['shopV3.buy','recruit.refresh','recruitV3.permanent','mail.claim','build.save','teamV3.save','battleV2.commands','battleV3.surrender','socialV1.chat.send','rankedV1.surrender','rankedV1.dismiss'];
 const session=['rankedV1.queue.join','rankedV1.preview.lock','rankedV1.commands','rankedV1.replacements','trainingPvpV1.room.create','trainingPvpV1.commands'];
 for(const type of durable)assert.equal(playerActionRetryScope(type),'durable',type);
 for(const type of session)assert.equal(playerActionRetryScope(type),'session',type);
 assert.equal(playerActionRetryScope('mailboxV1.read'),'idempotent-metadata');
 assert.equal(playerActionRetryScope('legacy.finish'),'compatibility-migration');
 assert.equal(playerActionRetryScope('unknown.write'),'unsupported');
});

test('B50 ACKs make the persistence promise explicit and fail closed without a policy',()=>{
 assert.deepEqual(playerActionAck({type:'mail.claim',actionId:'mail:1'},{duplicate:true},{revision:8}),{type:'action-ack',actionId:'mail:1',actionType:'mail.claim',duplicate:true,commitStatus:'committed',committedRevision:8});
 assert.deepEqual(playerActionAck({type:'rankedV1.commands',actionId:'ranked:1'},{authoritativeRevision:12},{revision:8}),{type:'action-ack',actionId:'ranked:1',actionType:'rankedV1.commands',duplicate:false,commitStatus:'session',authoritativeRevision:12});
 assert.throws(()=>playerActionAck({type:'mailboxV1.read',actionId:'read:1'},{},{revision:8}),error=>error.code==='ACTION_RETRY_POLICY_MISSING');
});

test('B50 dispatcher cannot handcraft ambiguous ACKs and V2 retry UI uses the shared outbox',async()=>{
 const dispatcher=await readFile(new URL('../server/player-action-dispatch.mjs',import.meta.url),'utf8'),client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');
 assert.doesNotMatch(dispatcher,/type:'action-ack'/);
 assert.match(dispatcher,/playerActionAck\(message\.action,result/);
 assert.match(client,/RecruitmentView\(\{onChange:redrawWorkspace,sendAction:commerceRetry\.send/);
 assert.match(client,/if\(a==="claim"\)commerceRetry\.send/);
});
