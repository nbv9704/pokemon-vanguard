const clone=value=>JSON.parse(JSON.stringify(value));

function initialProgression(state,catalog){
 const mons=(state.collection||[]).map(owned=>{const species=catalog.species.find(entry=>entry.legacyId===owned.id);return {monId:`mon-${species.id}`,speciesId:species.id,ownership:'permanent',trialExpiresAt:null,legacyLevel:owned.level||5};});
 const builds=mons.map(mon=>{const species=catalog.speciesById[mon.speciesId];return {buildId:`build-${mon.speciesId}-1`,monId:mon.monId,...clone(species.defaultBuild),revision:1};});
 const bySpecies=new Map(builds.map(build=>[build.monId.slice(4),build.buildId])),buildIds=(state.team||[]).map(id=>catalog.species.find(entry=>entry.legacyId===id)?.id).map(id=>bySpecies.get(id)).filter(Boolean);
 return {revision:1,nextMonId:1,nextBuildId:1,nextTeamId:1,nextBlueprintId:1,mons,builds,teams:[{teamId:'team-default',name:'Đội hiện tại',buildIds,revision:1}],blueprints:[],activeTeamId:'team-default'};
}

export function getV2ProgressionState(state,catalog){
 if(state.schemaVersion>=2&&Array.isArray(state.mons)&&Array.isArray(state.builds)&&Array.isArray(state.teams))return clone({revision:state.progressionRevision||1,nextMonId:state.nextMonId||1,nextBuildId:state.nextBuildId||1,nextTeamId:state.nextTeamId||1,nextBlueprintId:state.nextBlueprintId||1,mons:state.mons,builds:state.builds,teams:state.teams,blueprints:state.blueprints||[],activeTeamId:state.activeTeamId});
 return clone(state.progressionV2||initialProgression(state,catalog));
}

export function storeV2Progression(state,progression){
 if(state.schemaVersion>=2){state.progressionRevision=progression.revision;state.nextMonId=progression.nextMonId;state.nextBuildId=progression.nextBuildId;state.nextTeamId=progression.nextTeamId;state.nextBlueprintId=progression.nextBlueprintId;state.mons=progression.mons;state.builds=progression.builds;state.teams=progression.teams;state.blueprints=progression.blueprints||[];state.activeTeamId=progression.activeTeamId;delete state.progressionV2;}
 else state.progressionV2=progression;
 return state;
}

export function v2Coins(state){return state.schemaVersion>=2?state.wallet?.coins??state.coins??0:state.coins||0;}
export function debitV2Coins(state,amount){if(state.schemaVersion>=2){state.wallet=state.wallet||{coins:state.coins||0,crystals:state.gems||0,recruitmentTickets:state.recruitmentTickets||0};state.wallet.coins-=amount;state.coins=state.wallet.coins;}else state.coins-=amount;}
export function synchronizeWallet(state){if(state.schemaVersion>=2)state.wallet={coins:Math.max(0,Math.trunc(state.coins||0)),crystals:Math.max(0,Math.trunc(state.gems||0)),recruitmentTickets:Math.max(0,Math.trunc(state.recruitmentTickets??state.wallet?.recruitmentTickets??0))};return state;}

export function allocateV2MonId(progression){let monId;do monId=`mon-${progression.nextMonId++}`;while(progression.mons.some(mon=>mon.monId===monId));return monId;}
