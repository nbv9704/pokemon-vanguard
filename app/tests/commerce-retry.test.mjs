import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CommercePendingActions,createCommerceRetryController,commerceActionLabel} from '../public/js/commerce-pending-actions.js';

const storage=()=>{const db=new Map();return {getItem:key=>db.get(key)||null,setItem:(key,value)=>db.set(key,value),removeItem:key=>db.delete(key)};};
const action=Object.freeze({type:'shopV3.buy',itemId:'charcoal',payment:'ticket',actionId:'shop:stable-b06'});
test('Shop pending outbox keeps exact payload/ID across reload and discards only matching ACK',()=>{
 const mem=storage(),pending=new CommercePendingActions({storage:mem,scope:'player-A'});
 assert.equal(pending.begin(action),true);assert.equal(pending.begin({...action,actionId:'other'}),false);
 assert.equal(new CommercePendingActions({storage:mem,scope:'player-B'}).pending,null);
 const restored=new CommercePendingActions({storage:mem,scope:'player-A'});
 assert.deepEqual(restored.pending,action);assert.equal(restored.acknowledge('unrelated'),false);
 assert.deepEqual(restored.pending,action);assert.equal(restored.reject(action.actionId,'NETWORK_UNKNOWN'),true);
 assert.match(restored.lastError,/NETWORK_UNKNOWN/);assert.equal(restored.acknowledge(action.actionId),true);
 assert.equal(new CommercePendingActions({storage:mem,scope:'player-A'}).pending,null);
});
test('commerce retry requires an explicit user intent and never mints a new action ID',()=>{
 const mem=storage(),pending=new CommercePendingActions({storage:mem,scope:'player'}),sent=[];let ready=true,busy=false;
 const controls=createCommerceRetryController({outbox:pending,sendAction:payload=>{sent.push(payload);return true;},isBusy:()=>busy,isReady:()=>ready});
 assert.equal(controls.send(action),true);assert.deepEqual(sent,[action]);assert.equal(controls.send({...action,actionId:'different'}),false);
 ready=false;assert.equal(controls.retry(),false);assert.equal(sent.length,1);
 ready=true;busy=true;assert.equal(controls.retry(),false);busy=false;
 assert.equal(controls.retry(),true);assert.deepEqual(sent,[action,action]);
 assert.equal(pending.acknowledge('wrong-id'),false);assert.deepEqual(pending.pending,action);
 pending.discard();assert.equal(controls.retry(),false);assert.equal(commerceActionLabel(action),'Shop Ticket purchase');
});
test('invalid pending payloads and blocked session storage do not execute arbitrary saved actions',()=>{
 const mem=storage();mem.setItem('pv:commerce-pending:v1:player',JSON.stringify({version:1,action:{type:'battleV3.commands',actionId:'shop:valid'}}));
 assert.equal(new CommercePendingActions({storage:mem,scope:'player'}).pending,null);
 const broken=new CommercePendingActions({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},scope:'blocked'});
 assert.equal(broken.persistent,false);assert.equal(broken.begin(action),true);assert.equal(broken.persistent,false);
});
test('Mission, Admin Gift and Rank protection intents survive reload and retain their exact IDs',()=>{
 for(const candidate of [
  {type:'mission.claim',category:'daily',missionId:'daily-login',actionId:'mission:one'},
  {type:'mission.claimAll',category:'weekly',actionId:'mission:all'},
  {type:'adminGift.claim',giftId:'campaign-1',actionId:'gift:one'},
  {type:'bagV1.rankProtection',enabled:true,actionId:'bag:one'}
 ]){const mem=storage(),pending=new CommercePendingActions({storage:mem,scope:'player'});assert.equal(pending.begin(candidate),true);assert.deepEqual(new CommercePendingActions({storage:mem,scope:'player'}).pending,candidate);}
});
test('schema-2 Build, Team and Blueprint intents are accepted only with stable IDs and valid payloads',()=>{
 for(const candidate of [
  {type:'build.save',build:{buildId:'build-1'},expectedRevision:1,actionId:'v2:build'},
  {type:'team.save',team:{teamId:'team-1'},expectedRevision:1,actionId:'v2:team'},
  {type:'blueprint.import',blueprint:'{"schemaVersion":1}',actionId:'v2:blueprint'}
 ]){const pending=new CommercePendingActions({storage:storage(),scope:'v2'});assert.equal(pending.begin(candidate),true);assert.deepEqual(pending.pending,candidate);}
});
test('schema-2 Recruitment and Mail intents survive reload with the exact payload and ID',()=>{
 for(const candidate of [
  {type:'recruit.refresh',expectedRevision:2,cycleId:7,actionId:'v2:recruit:refresh'},
  {type:'recruit.trial',expectedRevision:2,cycleId:7,speciesId:'emberlyn',actionId:'v2:recruit:trial'},
  {type:'recruit.permanent',expectedRevision:2,cycleId:7,speciesId:'emberlyn',payment:'ticket',actionId:'v2:recruit:permanent'},
  {type:'mail.claim',mailId:0,actionId:'v2:mail:claim'}
 ]){const mem=storage(),pending=new CommercePendingActions({storage:mem,scope:'v2-commerce'});assert.equal(pending.begin(candidate),true);assert.deepEqual(new CommercePendingActions({storage:mem,scope:'v2-commerce'}).pending,candidate);}
});
test('schema-2 PvE battle intents retain exact command IDs through the commerce outbox',()=>{
 for(const candidate of [
  {type:'battleV2.preview.start',mode:'single',regulationId:'alpha-single',difficulty:'normal',actionId:'v2:battle:start'},
  {type:'battleV2.preview.lock',buildIds:['a','b','c'],actionId:'v2:battle:lock'},
  {type:'battleV2.commands',phaseRevision:1,commands:[{kind:'move'}],actionId:'v2:battle:command'},
  {type:'battleV2.replacements',phaseRevision:2,replacements:[{slot:0,monId:'a'}],actionId:'v2:battle:replace'},
  {type:'battleV2.surrender',actionId:'v2:battle:surrender'}
 ]){const pending=new CommercePendingActions({storage:storage(),scope:'v2-battle'});assert.equal(pending.begin(candidate),true);assert.deepEqual(pending.pending,candidate);}
});
test('Shop and Recruitment use explicit commerce outbox; header does not call socket-connected status saved',async()=>{
 const client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');
 assert.match(client,/new ShopView\(\{sendAction:commerceRetry\.send/);
 assert.match(client,/new V3RecruitmentView\(\{sendAction:action=>action\.type==='recruitV3\.sync'\?send\(action\):commerceRetry\.send\(action\)/);
 assert.match(client,/commercePending\.acknowledge\(frame\.actionId\)/);
 assert.match(client,/new MissionView\(\{sendAction:commerceRetry\.send/);
 assert.match(client,/new BagView\(\{sendAction:commerceRetry\.send/);
 assert.match(client,/admin-gift"\)commerceRetry\.send/);
 assert.match(client,/new (?:modules\.)?TrainingEditor\(\{fetchImpl:.*sendAction:commerceRetry\.send/);
 assert.match(client,/new (?:modules\.)?TeamBuilder\(\{onChange:redrawWorkspace,sendAction:commerceRetry\.send/);
 assert.match(client,/new (?:modules\.)?V2BattleScreen\(\{onChange:.*sendAction:commerceRetry\.send/);
 assert.match(client,/new (?:modules\.)?RecruitmentView\(\{onChange:redrawWorkspace,sendAction:commerceRetry\.send/);
 assert.match(client,/if\(a==="claim"\)commerceRetry\.send/);
 assert.match(client,/function commerceBanner\(\)/);
 assert.doesNotMatch(client,/ADVENTURE SAVED/);
});
