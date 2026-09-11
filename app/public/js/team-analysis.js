export function analyzeTeam(buildIds,state,catalog){
 const view=state.trainingV2,builds=buildIds.map(id=>view.builds.find(build=>build.buildId===id)).filter(Boolean),mons=builds.map(build=>view.mons.find(mon=>mon.monId===build.monId)),species=mons.map(mon=>catalog.species.find(entry=>entry.id===mon.speciesId));
 const issues=[],suggestions=[];if(buildIds.length!==6)issues.push(`Regulation yêu cầu 6 Mon; hiện có ${buildIds.length}.`);
 if(new Set(species.map(entry=>entry.id)).size!==species.length)issues.push('Species Clause: một loài chỉ được xuất hiện một lần.');
 const items=builds.map(build=>build.itemId).filter(id=>id!=='none');if(new Set(items).size!==items.length)issues.push('Item Clause: held item không được trùng trong đội hoàn chỉnh.');
 const weaknesses={},resists={};for(const entry of species){for(let defending=0;defending<state.types.length;defending++){const attack=state.types[defending],mult=entry.types.reduce((value,type)=>value*(state.typeChart[defending]?.[state.types.indexOf(type)]??1),1);if(mult>1)weaknesses[attack]=(weaknesses[attack]||0)+1;if(mult<1)resists[attack]=(resists[attack]||0)+1;}}
 for(const [type,count] of Object.entries(weaknesses))if(count>3)suggestions.push(`${count} Mon yếu trước ${type}; thêm kháng hệ hoặc miễn nhiễm.`);
 if(!species.some(entry=>entry.role.includes('support')))suggestions.push('Đội chưa có vai trò support rõ ràng.');
 const moves=builds.flatMap(build=>build.moveIds.map(id=>catalog.moves.find(move=>move.id===id))).filter(Boolean),moveText=JSON.stringify(moves);
 if(!/tailwind|slow|"spe"/i.test(moveText))suggestions.push('Đội thiếu speed control như Tailwind, Slow hoặc hạ Speed.');
 const damage=new Set(moves.filter(move=>move.power>0).map(move=>move.category));if(damage.size<2)suggestions.push('Nguồn sát thương đang lệch một category; nên có cả physical và special.');
 return {issues,suggestions,roles:Object.fromEntries(species.map(entry=>[entry.role,(species.filter(other=>other.role===entry.role).length)])),weaknesses,resists,coverage:[...new Set(moves.filter(move=>move.power>0).map(move=>move.type))]};
}
