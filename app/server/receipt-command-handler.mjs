// Receipt-backed commands must inspect the durable save before each retry.
// An earlier storage.save may have committed and then lost its acknowledgement.
// The live room is published only after persistence (or a durable duplicate).
export async function commitReceiptCommand({accountId,liveState,load,persist,apply,action,now}){
 const authoritative=await load(accountId);
 const previous=authoritative||liveState;
 if(!previous)return {ok:false,code:'PLAYER_SAVE_NOT_FOUND'};
 const outcome=apply(previous,action,now);
 if(!outcome.ok)return outcome;
 if(!outcome.duplicate)await persist(accountId,outcome.state);
 return {...outcome,state:outcome.duplicate?previous:outcome.state};
}
