const routeKeys={
 home:['trainingV3','profileV1','missions','rankedV1'],collection:['trainingV3'],teams:['trainingV3','battleV3'],recruitment:['trainingV3','recruitmentV2','recruitmentV3','coins','recruitmentTickets'],shop:['shopV3','coins','bagV1'],bag:['bagV1'],missions:['missions'],friends:['socialV1','trainingPvpV1'],profile:['profileV1','trainingV3'],settings:[],mail:['mailboxV1','adminGiftsV1'],gym:['trainingV3','badges'],training:['trainingV2','trainingV3'],battle:['battle','battleV2','battleV3','rankedV1','trainingPvpV1','trainingV3']
};
const critical=new Set(['battle','battleV2','battleV3','rankedV1','trainingPvpV1']);
export function deltaCanPatchChrome({envelope,route,hasView,playback}){
 if(envelope?.type!=='state-delta'||!hasView||playback)return false;
 const dependencies=new Set(routeKeys[route]||[]);
 return !envelope.changedKeys.some(key=>critical.has(key)||dependencies.has(key));
}
