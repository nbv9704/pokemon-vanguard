// B35: WS command routing is isolated from transport/session and account join.
// All mutations remain inside the same AccountCoordinator lock as before.
import {validateAction,applyAction} from '../src/logic.js';
import {upgradeAdventure,synchronizeLegacyState} from './v2-release.mjs';
import {isV2RecruitmentAction,applyV2RecruitmentAction} from './v2-recruitment.mjs';
import {isV3RecruitmentAction,applyV3RecruitmentAction} from './v3-recruitment.mjs';
import {isV2EconomyAction,applyV2EconomyAction} from './v2-economy.mjs';
import {isMailboxAction,applyMailboxAction} from './mailbox-v1.mjs';
import {isAdminGiftAction,applyAdminGiftAction} from './admin-gifts.mjs';
import {isMissionAction,applyMissionAction,recordMissionEvent} from './missions.mjs';
import {isV3ShopAction,applyV3ShopAction} from './v3-item-shop.mjs';
import {isV3PlayerAction,applyV3PlayerAction} from './v3-player-actions.mjs';
import {applyV3BattlePlayerAction} from './v3-battle-player-actions.mjs';
import {applyV2ProgressionAction} from './v2-progression.mjs';
import {applyV2BattlePlayerAction} from './v2-battle-player-actions.mjs';
import {applyBagAction} from './ticket-bag.mjs';
import {commitReceiptCommand} from './receipt-command-handler.mjs';
import {validSocialActionId} from './social-action-receipts.mjs';

const validActionId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);
const pvpAck=(action,result,state)=>{
 const durable=action.type==='rankedV1.surrender'||action.type==='rankedV1.dismiss';
 return {type:'action-ack',actionId:action.actionId,actionType:action.type,duplicate:!!result.duplicate,commitStatus:durable?'committed':'session',...(durable&&Number.isSafeInteger(state?.revision)?{committedRevision:state.revision}:{}),...(Number.isSafeInteger(result.authoritativeRevision)?{authoritativeRevision:result.authoritativeRevision}:{})};
};

/** Dependencies are scoped to one server instance, not process-global state. */
export function createPlayerActionDispatcher({accounts,ranked,social,trainingPvp,storage,
  migrationBackups,v2Catalog,v3Catalog,clock,persist,broadcast,send}){
 const loadForAction=(id,key)=>storage.loadForAction?.(id,key)??storage.load(id);
 return async function dispatchPlayerAction({ws,name,room,player,session,message,fail}){
        if(message.action?.type?.startsWith('rankedV1.')){if(trainingPvp.busy(name))return fail('TRAINING_ROOM_ACTIVE');const result=await ranked.action(name,session||{provider:'local',name:player},message.action);if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));if(validActionId(message.action.actionId))send(ws,pvpAck(message.action,result,room.state));return;}
        if(message.action?.type?.startsWith('socialV1.')){const result=await social.action(name,session||{provider:'local',name:player},message.action),actionId=message.action.actionId;if(!result.ok){send(ws,{type:'error',error:result.code,...(validSocialActionId(actionId)?{actionId}:{})});return;}if(validSocialActionId(actionId))send(ws,{type:'action-ack',actionId,actionType:message.action.type,duplicate:!!result.duplicate});return;}
        if(message.action?.type?.startsWith('trainingPvpV1.'))return accounts.withAccounts(trainingPvp.accountIdsForAction(name,message.action),async()=>{if(ranked.busy(name))return fail('RANKED_MATCH_ACTIVE');const result=await trainingPvp.action(name,session||{provider:'local',name:player},message.action);if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));if(validActionId(message.action.actionId))send(ws,pvpAck(message.action,result,room.state));});
        return accounts.withAccounts([name],async()=>{
        if(ranked.busy(name)&&(message.action?.type?.startsWith('battleV3.')||['buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)||isV3RecruitmentAction(message.action)||isV3ShopAction(message.action)||message.action?.type==='bagV1.rankProtection'))return fail('RANKED_MATCH_ACTIVE');
        if(trainingPvp.busy(name)&&(message.action?.type?.startsWith('battleV3.')||['buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)||isV3RecruitmentAction(message.action)||isV3ShopAction(message.action)||message.action?.type==='bagV1.rankProtection'))return fail('TRAINING_ROOM_ACTIVE');
        if(validActionId(message.action?.actionId)){const durable=await loadForAction(name,message.action.actionId);if(durable)room.state=durable;}
        if(message.action?.type==='legacy.finish'){
          if((room.state.schemaVersion||1)>=2||!room.state.battle?.result)return fail('NO_LEGACY_RESULT');
          await storage.backup(name,migrationBackups,'pre-v2-schema');const upgraded=upgradeAdventure(room.state,v2Catalog);await persist(name,upgraded.state);room.state=upgraded.state;broadcast(room);return;
        }
        if(isMailboxAction(message.action)){
          const result=applyMailboxAction(room.state,message.action,{now:clock.now()});if(!result.ok)return fail(result.code);
          if(result.changed)await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(isAdminGiftAction(message.action)){
          const result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:(state,action)=>applyAdminGiftAction(state,action,v3Catalog,{now:clock.now()})});if(!result.ok)return fail(result.code);
          room.state=result.state;broadcast(room);if(message.action.actionId!==undefined)send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if(isMissionAction(message.action)){
          const result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:(state,action)=>applyMissionAction(state,action,{serverNow:clock.now()})});if(!result.ok)return fail(result.code);
          room.state=result.state;broadcast(room);send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if(message.action?.type==='bagV1.rankProtection'){
          const result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:applyBagAction});if(!result.ok)return fail(result.code);
          room.state=result.state;broadcast(room);if(message.action.actionId!==undefined)send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if(isV3ShopAction(message.action)){
          const result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:(state,action)=>applyV3ShopAction(state,action,v3Catalog)});
          if(!result.ok)return fail(result.code);
          room.state=result.state;broadcast(room);
          send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if(room.state.battle&&!room.state.battle.result&&(['build.save','team.save','blueprint.import','buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)||isV2RecruitmentAction(message.action)||isV3RecruitmentAction(message.action)||message.action?.type?.startsWith('battleV2.')||message.action?.type?.startsWith('battleV3.')))return fail('LEGACY_BATTLE_ACTIVE');
        if(isV3PlayerAction(message.action)){
          // Read authoritative storage for receipt-backed actions. A previous
          // commit may have succeeded despite a lost storage acknowledgement.
          const saved=message.action.actionId!==undefined?await loadForAction(name,message.action.actionId):null;
          const result=applyV3PlayerAction(saved||room.state,message.action,v3Catalog,{now:clock.now()});
          if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
          if(!result.duplicate)await persist(name,result.state);
          room.state=result.state;broadcast(room);
          if(message.action.actionId!==undefined)send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,duplicate:!!result.duplicate});
          return;
        }
        if(isV3RecruitmentAction(message.action)){
          const now=clock.now(),result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,now,apply:(state,action)=>{
           if(!state.progressionV3)return {ok:false,code:'SCHEMA_V3_NOT_READY'};
           const applied=applyV3RecruitmentAction(state,action,v3Catalog,{serverNow:now});
           if(applied.ok&&!applied.duplicate&&['recruitV3.trial','recruitV3.permanent'].includes(action.type))recordMissionEvent(applied.state,'recruits',1,now);
           return applied;
          }});
          if(!result.ok)return fail(result.code);
          room.state=result.state;broadcast(room);
          send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if(message.action?.type?.startsWith('battleV3.')){
          const result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:(base,action)=>applyV3BattlePlayerAction(base,action,v3Catalog,{now:clock.now()})});
          if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
          room.state=result.state;broadcast(room);
          if(message.action.actionId!==undefined)send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if (['build.save','team.save','blueprint.import'].includes(message.action?.type)) {
          const result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:(state,action)=>applyV2ProgressionAction(state,action,v2Catalog)});
          if (!result.ok) return fail(result.code);
          room.state=result.state;broadcast(room);if(message.action.actionId!==undefined)send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if (room.state.schemaVersion>=2&&isV2RecruitmentAction(message.action)) {
          const result=applyV2RecruitmentAction(room.state,message.action,v2Catalog,{serverNow:clock.now()});
          if (!result.ok) return fail(result.code);
          if(!result.duplicate&&['recruit.trial','recruit.permanent'].includes(message.action.type))recordMissionEvent(result.state,'recruits',1,clock.now());
          synchronizeLegacyState(result.state,v2Catalog);await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if (room.state.schemaVersion>=2&&isV2EconomyAction(message.action)) {
          const result=applyV2EconomyAction(room.state,message.action,v2Catalog,{now:clock.now()});
          if (!result.ok) return fail(result.code);
          synchronizeLegacyState(result.state,v2Catalog);await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(room.state.schemaVersion>=2&&message.action?.type==='summon')return fail('LEGACY_SUMMON_DISABLED');
        if (typeof message.action?.type === 'string' && message.action.type.startsWith('battleV2.')) {
          const wasFinished=room.state.battleV2?.phase==='FINISHED',now=clock.now(),result=await commitReceiptCommand({accountId:name,liveState:room.state,load:(id,action)=>loadForAction(id,action.actionId),persist,action:message.action,apply:(state,action)=>{const applied=applyV2BattlePlayerAction(state,action,v2Catalog,{serverNow:now});if(applied.ok&&!applied.duplicate&&!wasFinished&&applied.state.battleV2?.phase==='FINISHED'){recordMissionEvent(applied.state,'battles',1,now);if(applied.state.battleV2.result?.winner==='A'||applied.state.battleV2.battle?.result?.winner==='A')recordMissionEvent(applied.state,'wins',1,now);}return applied;}});
          if (!result.ok) return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
          room.state=result.state;broadcast(room);if(message.action.actionId!==undefined)send(ws,{type:'action-ack',actionId:message.action.actionId,actionType:message.action.type,committedRevision:result.state.revision,duplicate:!!result.duplicate});return;
        }
        if(room.state.schemaVersion>=2&&message.action?.type==='battle')return fail('LEGACY_BATTLE_DISABLED');
        const valid = validateAction(room.state,player,message.action);
        if (!valid.ok) return fail(valid.error);
        let next = applyAction(room.state,player,message.action);
        if((next.schemaVersion||1)>=2)synchronizeLegacyState(next,v2Catalog);
        await persist(name,next);room.state = next;
        broadcast(room);
        });
 };
}
