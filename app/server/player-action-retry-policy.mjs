// One source of truth for what an ACK promises. Durable actions are backed by
// account/pair receipts; session actions only dedupe while their live PvP
// owner exists. Mid-match restoration remains a separate lifecycle concern.
const DURABLE=new Set([
 'adminGift.claim','bagV1.rankProtection','blueprint.import','build.save','buildV3.save',
 'mail.claim','mission.claim','mission.claimAll','recruit.refresh','recruit.trial',
 'recruit.permanent','recruitV3.sync','recruitV3.refresh','recruitV3.trial',
 'recruitV3.permanent','replicaV3.apply','shopV3.buy','team.save','teamV3.save',
 'teamV3.activate','rankedV1.surrender','rankedV1.dismiss'
]);
const SESSION_RANKED=new Set(['rankedV1.queue.join','rankedV1.queue.leave','rankedV1.preview.lock','rankedV1.commands','rankedV1.replacements']);

export function playerActionRetryScope(type){
 if(typeof type!=='string')return 'unsupported';
 if(DURABLE.has(type)||type.startsWith('battleV2.')||type.startsWith('battleV3.')||type.startsWith('socialV1.'))return 'durable';
 if(SESSION_RANKED.has(type)||type.startsWith('trainingPvpV1.'))return 'session';
 if(type==='mailboxV1.read')return 'idempotent-metadata';
 if(type==='legacy.finish')return 'compatibility-migration';
 return 'unsupported';
}

export function playerActionAck(action,result,state){
 const scope=playerActionRetryScope(action?.type);
 if(!['durable','session'].includes(scope))throw Object.assign(Error(`No retry ACK policy for ${String(action?.type)}`),{code:'ACTION_RETRY_POLICY_MISSING'});
 return {type:'action-ack',actionId:action.actionId,actionType:action.type,duplicate:!!result?.duplicate,commitStatus:scope==='durable'?'committed':'session',...(scope==='durable'&&Number.isSafeInteger(state?.revision)?{committedRevision:state.revision}:{}),...(Number.isSafeInteger(result?.authoritativeRevision)?{authoritativeRevision:result.authoritativeRevision}:{})};
}
