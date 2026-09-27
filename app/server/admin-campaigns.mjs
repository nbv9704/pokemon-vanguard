// Stable command identity for an Admin Gift campaign. A retry carries the same ID,
// content fingerprint and frozen audience, not an accidental new giveaway.
import {createHash} from 'node:crypto';

export const validCampaignId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);
const sorted=value=>[...new Set(value||[])].sort();
export function campaignFingerprint(adminId,target,gift){
 const audience=target?.scope==='selected'?{scope:'selected',userIds:sorted((target.userIds||[]).map(String))}:target?.scope==='player'?{scope:'player',userId:String(target.userId||'')}:target?.scope==='rank'?{scope:'rank',tierId:String(target.tierId||'')}:{scope:String(target?.scope||'player')};
 const reward=gift.reward||{};
 const data={version:1,adminId:String(adminId),target:audience,gift:{title:gift.title,message:gift.message,mailType:gift.mailType,unreadTtlMs:gift.unreadTtlMs,readTtlMs:gift.readTtlMs,reward:{coins:reward.coins||0,crystals:reward.crystals||0,recruitmentTickets:reward.recruitmentTickets||0,shopTickets:reward.shopTickets||0,trainingTickets:reward.trainingTickets||0,rankTickets:reward.rankTickets||0},itemIds:sorted(gift.itemIds),speciesIds:sorted(gift.speciesIds)}};
 return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
export const giftFingerprint=gift=>campaignFingerprint(gift.sentBy||'admin',{scope:'gift'},gift);
