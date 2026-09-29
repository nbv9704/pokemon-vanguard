const failure=(code,message)=>Object.assign(new Error(message||code),{code});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const identifier=(value,label)=>{if(typeof value!=='string'||value.length<1||value.length>160)throw failure('STORAGE_SAVE_SCHEMA_INVALID',`Invalid ${label}`);return value;};
const safeCount=(value,label)=>{if(value!==undefined&&(!Number.isSafeInteger(value)||value<0))throw failure('STORAGE_SAVE_SCHEMA_INVALID',label.startsWith('wallet.')?`Invalid adventure wallet balance: ${label.slice(7)}`:`Invalid ${label}`);};
const uniqueIds=(rows,key,label)=>{
 if(!Array.isArray(rows))throw failure('STORAGE_SAVE_SCHEMA_INVALID',`Invalid ${label}`);
 const ids=new Set();for(const row of rows){if(!record(row))throw failure('STORAGE_SAVE_SCHEMA_INVALID',`Invalid ${label} entry`);const id=identifier(row[key],`${label}.${key}`);if(ids.has(id))throw failure('STORAGE_SAVE_SCHEMA_INVALID',`Duplicate ${label}.${key}: ${id}`);ids.add(id);}return ids;
};
function validateProgression(progression){
 if(!record(progression))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid progressionV3');
 if(progression.catalogVersion!==undefined)identifier(progression.catalogVersion,'progressionV3.catalogVersion');
 const mons=uniqueIds(progression.mons,'monId','progressionV3.mons'),builds=uniqueIds(progression.builds,'buildId','progressionV3.builds'),teams=uniqueIds(progression.teams,'teamId','progressionV3.teams');
 const ownedItems=progression.ownedItemIds===undefined?null:new Set(progression.ownedItemIds);
 for(const build of progression.builds){if(!mons.has(build.monId))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Build references missing mon: ${build.monId}`);if(build.itemId!==undefined){identifier(build.itemId,'progressionV3.build.itemId');if(ownedItems&&build.itemId!=='none'&&!ownedItems.has(build.itemId))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Build references unowned item: ${build.itemId}`);}if(build.moveIds!==undefined){if(!Array.isArray(build.moveIds)||build.moveIds.some(id=>typeof id!=='string'||!id))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid progressionV3 build moves');}}
 for(const team of progression.teams){if(!Array.isArray(team.buildIds)||new Set(team.buildIds).size!==team.buildIds.length)throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid progressionV3 team build IDs');for(const id of team.buildIds)if(!builds.has(id))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Team references missing build: ${id}`);}
 if(progression.activeTeamId!==undefined&&progression.activeTeamId!==null&&!teams.has(progression.activeTeamId))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Missing active team: ${progression.activeTeamId}`);
 if(progression.ownedItemIds!==undefined&&(!Array.isArray(progression.ownedItemIds)||progression.ownedItemIds.some(id=>typeof id!=='string'||!id)||new Set(progression.ownedItemIds).size!==progression.ownedItemIds.length))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid progressionV3 owned items');
}
function validateV2References(state){
 if(!['mons','builds','teams'].some(key=>state[key]!==undefined))return;
 const mons=uniqueIds(state.mons,'monId','mons'),builds=uniqueIds(state.builds,'buildId','builds'),teams=uniqueIds(state.teams,'teamId','teams');
 for(const build of state.builds)if(!mons.has(build.monId))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Build references missing mon: ${build.monId}`);
 for(const team of state.teams){if(!Array.isArray(team.buildIds))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid team build IDs');for(const id of team.buildIds)if(!builds.has(id))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Team references missing build: ${id}`);}
 if(state.activeTeamId!==undefined&&state.activeTeamId!==null&&!teams.has(state.activeTeamId))throw failure('STORAGE_SAVE_REFERENCE_INVALID',`Missing active team: ${state.activeTeamId}`);
}
export function validateAdventureSave(state){
 if(!record(state))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid adventure save root');
 const version=state.schemaVersion===undefined?1:state.schemaVersion;
 if(!Number.isInteger(version)||version<1||version>3)throw failure('STORAGE_SAVE_VERSION_UNSUPPORTED',`Unsupported adventure save schema: ${state.schemaVersion}`);
 if(state.owner!==undefined&&(typeof state.owner!=='string'||state.owner.trim().length<1||state.owner.length>128))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid adventure owner');
 safeCount(state.revision,'revision');for(const key of ['coins','gems','crystals','recruitmentTickets','pity','summons','wins'])safeCount(state[key],key);
 if(state.wallet!==undefined){if(!record(state.wallet))throw failure('STORAGE_SAVE_SCHEMA_INVALID','Invalid adventure wallet');for(const key of ['coins','crystals','recruitmentTickets'])safeCount(state.wallet[key],`wallet.${key}`);}
 if(state.catalogVersion!==undefined&&state.catalogVersion!==null)identifier(state.catalogVersion,'catalogVersion');
 if(version>=2)validateV2References(state);if(version===3&&state.progressionV3!==undefined)validateProgression(state.progressionV3);
 return state;
}
export function parseAdventureSave(text){try{return validateAdventureSave(JSON.parse(text));}catch(error){if(error instanceof SyntaxError)throw failure('STORAGE_SAVE_JSON_CORRUPT','Adventure save JSON is truncated or invalid');throw error;}}
