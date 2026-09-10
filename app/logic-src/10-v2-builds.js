const V2_STAT_KEYS=['hp','atk','def','spa','spd','spe'];
function V2_validateBuild(build,species,catalog){
 const errors=[];
 if(!build||typeof build!=='object')return ['build must be an object'];
 const points=build.points||{};let total=0;
 for(const key of V2_STAT_KEYS){const value=points[key];if(!Number.isInteger(value)||value<0||value>16)errors.push(`${key} points must be an integer from 0 to 16`);else total+=value;}
 if(total>32)errors.push('stat points total cannot exceed 32');
 const up=build.alignment?.up??null,down=build.alignment?.down??null,aligned=V2_STAT_KEYS.filter(key=>key!=='hp');
 if((up===null)!==(down===null)||up===down&&up!==null||up!==null&&!aligned.includes(up)||down!==null&&!aligned.includes(down))errors.push('alignment must be neutral or use two different non-HP stats');
 if(!Array.isArray(build.moveIds)||build.moveIds.length!==4||new Set(build.moveIds).size!==4)errors.push('build must contain four different moves');
 else if(build.moveIds.some(id=>!species.moveIds.includes(id)||!catalog.moveIds.includes(id)))errors.push('build contains a move outside the species movepool');
 if(!species.abilityIds.includes(build.abilityId)||!catalog.abilityIds.includes(build.abilityId))errors.push('build contains an unsupported ability');
 if(!catalog.itemIds.includes(build.itemId))errors.push('build contains an unsupported item');
 return errors;
}
function V2_calculateStats(baseStats,points,alignment={up:null,down:null}){
 const result={hp:100+baseStats.hp+2*points.hp};
 for(const key of V2_STAT_KEYS.slice(1)){const multiplier=alignment.up===key?1.1:alignment.down===key?.9:1;result[key]=Math.floor((baseStats[key]+20+2*points[key])*multiplier);}
 return result;
}
function V2_createBattleMon({battleMonId,ownerSide,build,species,moves,catalog}){
 const errors=V2_validateBuild(build,species,catalog);if(errors.length)throw new Error(errors.join('; '));
 const stats=V2_calculateStats(species.baseStats,build.points,build.alignment);
 return {battleMonId,ownerSide,speciesId:species.id,types:[...species.types],buildSnapshot:JSON.parse(JSON.stringify(build)),stats,hp:stats.hp,pp:Object.fromEntries(build.moveIds.map(id=>[id,moves[id].maxPP])),status:null,stages:{atk:0,def:0,spa:0,spd:0,spe:0},volatiles:{},itemState:{used:false},formId:null};
}

