import {rollRecruitmentLineup} from './v2-recruitment-state.mjs';

export function simulateRecruitmentEconomy({cycles=100000,seed=424242,catalog}){
 if(!Number.isInteger(cycles)||cycles<1)throw new Error('cycles must be a positive integer');
 const progression={mons:[]},state={seed,rngState:{recruitment:(seed>>>0)||1},wallet:{coins:0,crystals:0,recruitmentTickets:0}},counts=Object.fromEntries(catalog.species.map(species=>[species.id,0]));let invalidLineups=0;
 for(let cycle=0;cycle<cycles;cycle++){const lineup=rollRecruitmentLineup(state,progression,catalog);if(lineup.length!==catalog.economy.recruitment.lineupSize||new Set(lineup).size!==lineup.length)invalidLineups++;for(const id of lineup)counts[id]++;}
 const appearances=Object.entries(counts).map(([speciesId,count])=>({speciesId,count,offerShare:Number((count/(cycles*catalog.economy.recruitment.lineupSize)*100).toFixed(4))})).sort((a,b)=>b.count-a.count),battle=catalog.economy.battle.exhibition,cost=catalog.economy.recruitment.permanentCostCoins;
 return {schemaVersion:2,seed,cycles,lineupSize:catalog.economy.recruitment.lineupSize,invalidLineups,expectedOfferShare:Number((100/catalog.species.length).toFixed(4)),minAppearances:Math.min(...appearances.map(row=>row.count)),maxAppearances:Math.max(...appearances.map(row=>row.count)),appearances,matchesToAfford:{costCoins:cost,winsOnly:Math.ceil(cost/battle.win.coins),lossesOnly:Math.ceil(cost/battle.loss.coins),at50PercentWinRate:Math.ceil(cost/((battle.win.coins+battle.loss.coins)/2))}};
}
