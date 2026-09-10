const ITEM_IDS=['none','vital-seed','power-lens','aegis-plate','swift-feather','cure-berry','focus-crystal'];
const ABILITY_BY_TYPE={Flame:'dawnbringer',Tide:'raincaller',Bloom:'wild-growth',Volt:'static-field',Frost:'snowglobe',Stone:'sandstream',Gale:'tailwind',Shadow:'night-hunter',Light:'radiance',Venom:'venom-touch',Steel:'ironhide',Astral:'mind-link'};
const UTILITY_BY_TYPE={Flame:'sun-call',Tide:'rain-call',Bloom:'meadow-call',Volt:'storm-call',Frost:'snow-call',Stone:'sand-call',Gale:'tailwind-call',Shadow:'rally',Light:'barrier',Venom:'redirect',Steel:'barrier',Astral:'rally'};
const clone=value=>JSON.parse(JSON.stringify(value));

export function saveSchemaVersion(state){
 if(Number.isInteger(state?.schemaVersion))return state.schemaVersion;
 return 1;
}

export function migrateV1ToV2(state,identities){
 const source=clone(state),version=saveSchemaVersion(source);
 if(version>2)throw new Error(`Save schema ${version} is newer than this application supports`);
 if(version===2)return {status:'current',state:source,report:{from:2,to:2,changed:false}};
 if(source?.battle&&!source.battle.result)return {status:'deferred-active-battle',state:source,report:{from:1,to:2,changed:false,reason:'Finish or surrender the active v1 battle first'}};
 if(!source||typeof source!=='object'||Array.isArray(source)||typeof source.owner!=='string'||!Array.isArray(source.collection))throw new Error('Invalid v1 adventure save');
 const byLegacy=new Map(identities.map(mon=>[mon.legacyId,mon]));
 const mons=[],builds=[];
 for(const owned of source.collection){
  const identity=byLegacy.get(owned.id);if(!identity)throw new Error(`Unknown legacy species id: ${owned.id}`);
  const monId=`mon-${identity.id}`,buildId=`build-${identity.id}-1`,primary=identity.types[0].toLowerCase(),coverage=identity.coverageType.toLowerCase();
  mons.push({monId,speciesId:identity.id,ownership:'permanent',trialExpiresAt:null,legacyLevel:Number.isInteger(owned.level)?owned.level:5,acquiredBy:'v1-migration'});
  builds.push({buildId,monId,name:'Build mặc định',points:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0},alignment:{up:null,down:null},abilityId:ABILITY_BY_TYPE[identity.types[0]],moveIds:[`${primary}-strike`,`${coverage}-lance`,'guard',UTILITY_BY_TYPE[identity.types[0]]],itemId:ITEM_IDS[owned.item]||'none',revision:1});
 }
 const ownedByLegacy=new Map(source.collection.map(mon=>[mon.id,byLegacy.get(mon.id)]));
 const selected=(Array.isArray(source.team)?source.team:[]).map(id=>ownedByLegacy.get(id)).filter(Boolean).map(identity=>`build-${identity.id}-1`);
 for(const identity of identities){if(selected.length>=6)break;const buildId=`build-${identity.id}-1`;if(builds.some(build=>build.buildId===buildId)&&!selected.includes(buildId))selected.push(buildId);}
 const migrated={
  schemaVersion:2,owner:source.owner,revision:1,rulesVersion:'1.0.0-legacy',catalogVersion:'2.0.0-alpha.1',
  wallet:{coins:Math.max(0,Math.trunc(source.coins||0)),crystals:Math.max(0,Math.trunc(source.gems||0))},
  rngState:{economy:(source.seed>>>0)||1},pity:Math.max(0,Math.trunc(source.pity||0)),summons:Math.max(0,Math.trunc(source.summons||0)),wins:Math.max(0,Math.trunc(source.wins||0)),
  mons,builds,teams:[{teamId:'team-migrated-1',name:'Đội chuyển từ bản cũ',buildIds:selected,revision:1}],activeTeamId:'team-migrated-1',
  gymProgress:{badges:[...(source.badges||[])]},mailClaims:[...(source.mail||[])],rewardReceipts:[],battle:null,
  migrationReceipt:{from:1,to:2,id:'v1-to-v2',legacyBattleResult:source.battle?.result||null}
 };
 return {status:'migrated',state:migrated,report:{from:1,to:2,changed:true,mons:mons.length,builds:builds.length,teamSize:selected.length}};
}

