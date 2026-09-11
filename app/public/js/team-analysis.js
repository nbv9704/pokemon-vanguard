export function analyzeTeam(buildIds,state,catalog){
 const view=state.trainingV2,builds=buildIds.map(id=>view.builds.find(build=>build.buildId===id)).filter(Boolean),mons=builds.map(build=>view.mons.find(mon=>mon.monId===build.monId)),species=mons.map(mon=>catalog.species.find(entry=>entry.id===mon.speciesId));
 const issues=[],suggestions=[];if(buildIds.length!==6)issues.push(`The regulation requires 6 Pokémon; this team has ${buildIds.length}.`);
 const expiredTrials=mons.filter(mon=>mon?.ownership==='trial'&&mon.trialExpired);if(expiredTrials.length)issues.push(`Trial expired: ${expiredTrials.map(mon=>catalog.species.find(entry=>entry.id===mon.speciesId)?.name||mon.speciesId).join(', ')}. Recruit permanently to preserve its build and team slot.`);
 if(new Set(species.map(entry=>entry.id)).size!==species.length)issues.push('Species Clause: each species may appear only once.');
 const items=builds.map(build=>build.itemId).filter(id=>id!=='none');if(new Set(items).size!==items.length)issues.push('Item Clause: held items cannot be duplicated on a complete team.');
 const weaknesses={},resists={};for(const entry of species){for(let defending=0;defending<state.types.length;defending++){const attack=state.types[defending],mult=entry.types.reduce((value,type)=>value*(state.typeChart[defending]?.[state.types.indexOf(type)]??1),1);if(mult>1)weaknesses[attack]=(weaknesses[attack]||0)+1;if(mult<1)resists[attack]=(resists[attack]||0)+1;}}
 for(const [type,count] of Object.entries(weaknesses))if(count>3)suggestions.push(`${count} Pokémon are weak to ${type}; add a resistance or immunity.`);
 if(!species.some(entry=>entry.role.includes('support')))suggestions.push('The team has no clear support role.');
 const moves=builds.flatMap(build=>build.moveIds.map(id=>catalog.moves.find(move=>move.id===id))).filter(Boolean),moveText=JSON.stringify(moves);
 if(!/tailwind|slow|"spe"/i.test(moveText))suggestions.push('The team lacks speed control such as Tailwind, Slow, or a Speed reduction.');
 const damage=new Set(moves.filter(move=>move.power>0).map(move=>move.category));if(damage.size<2)suggestions.push('Damage is concentrated in one category; add both physical and special attacks.');
 return {issues,suggestions,roles:Object.fromEntries(species.map(entry=>[entry.role,(species.filter(other=>other.role===entry.role).length)])),weaknesses,resists,coverage:[...new Set(moves.filter(move=>move.power>0).map(move=>move.type))]};
}
