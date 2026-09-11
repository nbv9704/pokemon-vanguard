import {applyEconomyTransaction,ensureEconomyState,recordActionReceipt} from './v2-economy-ledger.mjs';
import {markV2Tutorial} from './v2-release.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));

function rewardFor(result,session,config){
 if(session.regulationId==='sandbox-v2')return clone(config.sandbox);
 if(result.reason==='surrender')return clone(config.surrender);
 if(result.winner==='A')return clone(config.exhibition.win);
 if(result.winner==='B')return clone(config.exhibition.loss);
 return clone(config.exhibition.draw);
}

export function settleV2Battle(state,catalog){
 const session=state.battleV2,result=session?.battle?.result;if(!result||session.phase!=='FINISHED')return {state,settled:false,reward:null};
 if(!catalog?.economy?.battle)throw new Error('Economy config is required to settle a v2 battle');ensureEconomyState(state);
 const receiptId=result.receiptId||`${session.id}:result`,existing=state.rewardReceipts.find(entry=>entry.receiptId===receiptId);if(existing){session.reward=clone(existing.reward);return {state,settled:false,reward:clone(existing.reward)};}
 const config=catalog.economy.battle,baseReward=rewardFor(result,session,config),badges=state.badges=state.badges||state.gymProgress?.badges||[];let firstClear=false;
 if(session.regulationId!=='sandbox-v2'&&result.reason!=='surrender'&&result.winner==='A'&&Number.isInteger(session.gym)&&!badges.includes(session.gym)){baseReward.coins+=config.gymFirstClear.coins;baseReward.crystals+=config.gymFirstClear.crystals;firstClear=true;}
 const eligible=baseReward.coins>0||baseReward.crystals>0,reward={coins:baseReward.coins,crystals:baseReward.crystals,firstClear,eligible};
 const actionId=`battle.settle:${session.id}`,action={type:'battle.settle'},fingerprint=JSON.stringify({type:action.type,battleId:session.id,receiptId,winner:result.winner,reason:result.reason,gym:session.gym,regulationId:session.regulationId});
 const transaction=applyEconomyTransaction(state,{receiptId,actionId,kind:'battle-v2',delta:{coins:reward.coins,crystals:reward.crystals},details:{battleId:session.id,winner:result.winner,reason:result.reason,firstClear,regulationId:session.regulationId,gym:session.gym}});if(!transaction.ok)return {state,settled:false,reward:null,error:transaction.code};
 if(firstClear){badges.push(session.gym);badges.sort((a,b)=>a-b);}state.gymProgress={...(state.gymProgress||{}),badges:[...badges]};if(result.winner==='A'&&eligible)state.wins=Math.max(0,Math.trunc(state.wins||0))+1;
 const compatibility={receiptId,battleId:session.id,kind:'battle-v2',winner:result.winner,reason:result.reason,reward:clone(reward)};state.rewardReceipts.push(compatibility);recordActionReceipt(state,{actionId,kind:'battle.settle',fingerprint,receiptId,result:compatibility});
 markV2Tutorial(state,'battle');if(eligible)markV2Tutorial(state,'reward');session.reward=reward;state.notice=result.reason==='surrender'?'Đã đầu hàng · không có thưởng':session.regulationId==='sandbox-v2'?'Sandbox hoàn tất · không có thưởng':`${result.winner==='A'?'Chiến thắng':result.winner==='B'?'Thất bại':'Hòa'} · +${reward.coins} coins · +${reward.crystals} crystals`;
 return {state,settled:true,reward:clone(reward)};
}
