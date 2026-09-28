import {meta,viewFor} from '../src/logic.js';
import {v2Catalog} from './v2-catalog.mjs';
import {v3Catalog} from './v3-catalog.mjs';
import {v2TrainingView} from './v2-progression.mjs';
import {v3TrainingView} from './v3-progression.mjs';
import {v2RecruitmentView} from './v2-recruitment.mjs';
import {v3RecruitmentView} from './v3-recruitment.mjs';
import {v2BattleView} from './v2-battle-actions.mjs';
import {v3BattleView} from './v3-battle-view.mjs';
import {missionView} from './missions.mjs';
import {ticketBagView} from './ticket-bag.mjs';
import {v3ShopView} from './v3-item-shop.mjs';
import {profileView} from './profile-view.mjs';
import {adminGiftView} from './admin-gifts.mjs';
import {systemMailboxView} from './mailbox-v1.mjs';
import {legacyAdventurePublicView} from './player-public-view.mjs';

/** Produce only reviewed player-facing projections; never spread the raw save. */
export function createPlayerStateProjector({clock,ranked,trainingPvp,social}){
 return function project(room,player){
  const legacyView=viewFor(room.state,player);
  const frame={type:'state',status:'playing',seats:[room.state.owner],you:player,connected:room.clients.size,result:null,meta};
  if(legacyView.spectator)return {...frame,view:{spectator:true}};
  const serverNow=clock.now(),publicAdventure=legacyAdventurePublicView(legacyView);
  const recruitmentV2=v2RecruitmentView(room.state,v2Catalog,{serverNow});
  const viewNow=recruitmentV2?.effectiveNow??serverNow;
  const recruitmentV3=v3RecruitmentView(room.state,v3Catalog,{serverNow});
  const adminGifts=room.state.progressionV3?adminGiftView(room.state,v3Catalog,{now:serverNow}):null;
  const systemMailbox=systemMailboxView(room.state,v2Catalog,{now:serverNow});
  const mailboxV1={version:1,unreadCount:systemMailbox.unreadCount+(adminGifts?.unreadCount||0),pendingCount:systemMailbox.pendingCount+(adminGifts?.pendingCount||0),system:systemMailbox.mails};
  const view={...publicAdventure,
   recruitmentTickets:room.state.wallet?.recruitmentTickets||0,
   missions:missionView(room.state,serverNow),
   trainingV2:v2TrainingView(room.state,v2Catalog,{now:viewNow}),
   trainingV3:room.state.progressionV3?v3TrainingView(room.state.progressionV3,v3Catalog):null,
   bagV1:room.state.progressionV3?ticketBagView(room.state,v3Catalog):null,
   shopV3:room.state.progressionV3?v3ShopView(room.state,v3Catalog):null,
   profileV1:room.state.progressionV3?profileView(room.state,v3Catalog,{serverNow}):null,
   rankedV1:room.state.progressionV3?ranked.viewFor(room.name,room.state):null,
   trainingPvpV1:room.state.progressionV3?trainingPvp.viewFor(room.name):null,
   socialV1:room.state.progressionV3?social.viewFor(room.name,room.state):null,
   mailboxV1,adminGiftsV1:adminGifts,recruitmentV2,recruitmentV3,
   battleV2:v2BattleView(room.state,v2Catalog),battleV3:v3BattleView(room.state)
  };
  return {...frame,view};
 };
}
