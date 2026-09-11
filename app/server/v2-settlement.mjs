import {markV2Tutorial} from './v2-release.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));

export function settleV2Battle(state){
 const session=state.battleV2,result=session?.battle?.result;if(!result||session.phase!=='FINISHED')return {state,settled:false,reward:null};
 const receiptId=result.receiptId||`${session.id}:result`,receipts=state.rewardReceipts=state.rewardReceipts||[],existing=receipts.find(entry=>entry.receiptId===receiptId);
 if(existing){session.reward=clone(existing.reward);return {state,settled:false,reward:clone(existing.reward)};}
 let coins=0,crystals=0,firstClear=false;const eligible=session.regulationId!=='sandbox-v2'&&result.reason!=='surrender';
 if(eligible){coins=result.winner==='A'?180:60;crystals=result.winner==='A'?80:20;}
 const badges=state.badges=state.badges||state.gymProgress?.badges||[];
 if(eligible&&result.winner==='A'&&Number.isInteger(session.gym)&&!badges.includes(session.gym)){badges.push(session.gym);badges.sort((a,b)=>a-b);coins+=500;crystals+=300;firstClear=true;}
 const reward={coins,crystals,firstClear,eligible};receipts.push({receiptId,battleId:session.id,kind:'battle-v2',winner:result.winner,reason:result.reason,reward:clone(reward)});
 state.coins=Math.max(0,Math.trunc(state.coins||state.wallet?.coins||0))+coins;state.gems=Math.max(0,Math.trunc(state.gems||state.wallet?.crystals||0))+crystals;state.wallet={coins:state.coins,crystals:state.gems};state.gymProgress={...(state.gymProgress||{}),badges:[...badges]};if(result.winner==='A'&&eligible)state.wins=Math.max(0,Math.trunc(state.wins||0))+1;markV2Tutorial(state,'battle');if(eligible)markV2Tutorial(state,'reward');
 session.reward=reward;state.notice=result.reason==='surrender'?'Đã đầu hàng · không có thưởng':session.regulationId==='sandbox-v2'?'Sandbox hoàn tất · không có thưởng':`${result.winner==='A'?'Chiến thắng':result.winner==='B'?'Thất bại':'Hòa'} · +${coins} coins · +${crystals} crystals`;
 return {state,settled:true,reward:clone(reward)};
}
