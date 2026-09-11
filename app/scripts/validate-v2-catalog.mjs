const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const statKeys=['hp','atk','def','spa','spd','spe'];

function uniqueIds(entries,label,problems){
 const seen=new Set();
 for(const entry of entries||[]){if(!slug.test(entry?.id||''))problems.push(`${label} has invalid id: ${entry?.id}`);else if(seen.has(entry.id))problems.push(`${label} duplicate id: ${entry.id}`);else seen.add(entry.id);}
 return seen;
}

export function validateV2Catalog({contract,identities,species,moves,abilities,items}){
 const problems=[];
 if(species?.length!==36)problems.push(`expected 36 authored species, found ${species?.length}`);
 if(moves?.length!==48)problems.push(`expected 48 moves, found ${moves?.length}`);
 if(abilities?.length!==24)problems.push(`expected 24 abilities, found ${abilities?.length}`);
 if(items?.length!==13)problems.push(`expected none plus 12 items, found ${items?.length}`);
 const speciesIds=uniqueIds(species,'species',problems),moveIds=uniqueIds(moves,'moves',problems),abilityIds=uniqueIds(abilities,'abilities',problems),itemIds=uniqueIds(items,'items',problems);
 const identitiesById=new Map(identities.map(entry=>[entry.id,entry]));
 for(const move of moves||[]){
  if(!contract.types.includes(move.type))problems.push(`${move.id} has invalid type`);
  if(!contract.moveCategories.includes(move.category))problems.push(`${move.id} has invalid category`);
  if(!contract.targetModes.includes(move.targetMode))problems.push(`${move.id} has invalid targetMode`);
  if(!Number.isInteger(move.power)||move.power<0||move.power>200)problems.push(`${move.id} has invalid power`);
  if(!Number.isInteger(move.accuracy)||move.accuracy<1||move.accuracy>100)problems.push(`${move.id} has invalid accuracy`);
  if(!Number.isInteger(move.maxPP)||move.maxPP<1||move.maxPP>40)problems.push(`${move.id} has invalid maxPP`);
  if(!Array.isArray(move.effects))problems.push(`${move.id} effects must be an array`);
  for(const effect of move.effects||[]){
   if(!contract.effectKinds.includes(effect.kind)||!contract.effectTimings.includes(effect.timing)||!contract.effectTargets.includes(effect.target))problems.push(`${move.id} has unsupported effect`);
   if(typeof effect.chance!=='number'||effect.chance<0||effect.chance>1)problems.push(`${move.id} effect chance is invalid`);
  }
  if(typeof move.name!=='string'||!move.name.trim()||typeof move.description!=='string'||!move.description.trim())problems.push(`${move.id} needs name and description`);
 }
 for(const entry of [...(abilities||[]),...(items||[])])if(typeof entry.name!=='string'||!entry.name.trim()||typeof entry.description!=='string'||!entry.description.trim())problems.push(`${entry.id} needs name and description`);
 if(!itemIds.has('none'))problems.push('items must include none');
 for(const mon of species||[]){
  const identity=identitiesById.get(mon.id);
  if(!identity||identity.legacyId!==mon.legacyId||identity.artId!==mon.artId||JSON.stringify(identity.types)!==JSON.stringify(mon.types)||identity.coverageType!==mon.coverageType)problems.push(`${mon.id} does not match stable identity`);
  if(!['physical-fast','special-fast','physical-tank','special-tank','support','disruptor'].includes(mon.role))problems.push(`${mon.id} has invalid role`);
  if(statKeys.some(key=>!Number.isInteger(mon.baseStats?.[key])||mon.baseStats[key]<1)||Object.values(mon.baseStats||{}).reduce((a,b)=>a+b,0)!==480)problems.push(`${mon.id} base stats must contain six integers totaling 480`);
  if(!Array.isArray(mon.moveIds)||mon.moveIds.length<8||new Set(mon.moveIds).size!==mon.moveIds.length||mon.moveIds.some(id=>!moveIds.has(id)))problems.push(`${mon.id} needs at least 8 unique legal moves`);
  if(!Array.isArray(mon.abilityIds)||mon.abilityIds.length<2||new Set(mon.abilityIds).size!==mon.abilityIds.length||mon.abilityIds.some(id=>!abilityIds.has(id)))problems.push(`${mon.id} needs at least 2 unique legal abilities`);
  const build=mon.defaultBuild;
  if(!build||build.moveIds?.length!==4||new Set(build.moveIds||[]).size!==4||build.moveIds.some(id=>!mon.moveIds.includes(id))||!mon.abilityIds.includes(build.abilityId)||!itemIds.has(build.itemId))problems.push(`${mon.id} has invalid default build`);
 }
 if(speciesIds.size!==36)problems.push('authored species IDs are incomplete');
 return problems;
}

export function validateEconomyConfig(economy,species){
 const problems=[],nonNegativeInt=(value,label)=>{if(!Number.isInteger(value)||value<0)problems.push(`${label} must be a non-negative integer`);};
 if(!economy||economy.schemaVersion!==2)return ['economy.json must use schemaVersion 2'];
 nonNegativeInt(economy.starterWallet?.coins,'starterWallet.coins');nonNegativeInt(economy.starterWallet?.crystals,'starterWallet.crystals');nonNegativeInt(economy.starterWallet?.recruitmentTickets,'starterWallet.recruitmentTickets');
 for(const [label,reward] of Object.entries({
  'battle.exhibition.win':economy.battle?.exhibition?.win,'battle.exhibition.loss':economy.battle?.exhibition?.loss,'battle.exhibition.draw':economy.battle?.exhibition?.draw,
  'battle.gymFirstClear':economy.battle?.gymFirstClear,'battle.surrender':economy.battle?.surrender,'battle.sandbox':economy.battle?.sandbox
 })){nonNegativeInt(reward?.coins,`${label}.coins`);nonNegativeInt(reward?.crystals,`${label}.crystals`);}
 nonNegativeInt(economy.build?.saveCostCoins,'build.saveCostCoins');
 nonNegativeInt(economy.recruitment?.permanentCostCoins,'recruitment.permanentCostCoins');nonNegativeInt(economy.recruitment?.permanentCostTickets,'recruitment.permanentCostTickets');
 nonNegativeInt(economy.recruitment?.trialCostCoins,'recruitment.trialCostCoins');nonNegativeInt(economy.recruitment?.refreshCostCoins,'recruitment.refreshCostCoins');nonNegativeInt(economy.recruitment?.paidRefreshLimitPerCycle,'recruitment.paidRefreshLimitPerCycle');nonNegativeInt(economy.recruitment?.lineupSize,'recruitment.lineupSize');nonNegativeInt(economy.recruitment?.cycleDurationMs,'recruitment.cycleDurationMs');nonNegativeInt(economy.recruitment?.trialDurationMs,'recruitment.trialDurationMs');
 if(economy.recruitment?.lineupSize!==8)problems.push('recruitment.lineupSize must be 8');if(!economy.recruitment?.cycleDurationMs)problems.push('recruitment.cycleDurationMs must be positive');if(economy.recruitment?.trialDurationMs!==7*24*60*60*1000)problems.push('recruitment.trialDurationMs must be seven days');
 if('summon' in economy)problems.push('rarity summon configuration is no longer supported');
 nonNegativeInt(economy.mega?.stoneCostCoins,'mega.stoneCostCoins');
 if(!Array.isArray(economy.mail)||economy.mail.length!==3)problems.push('economy mail must preserve the three milestone rewards');
 const mailIds=new Set();for(const mail of economy.mail||[]){if(!Number.isInteger(mail.mailId)||mailIds.has(mail.mailId))problems.push(`invalid or duplicate mailId: ${mail.mailId}`);else mailIds.add(mail.mailId);if(typeof mail.key!=='string'||!mail.key)problems.push(`mail ${mail.mailId} needs a key`);nonNegativeInt(mail.reward?.coins,`mail ${mail.mailId} reward.coins`);nonNegativeInt(mail.reward?.crystals,`mail ${mail.mailId} reward.crystals`);if(!['always','winsAtLeast','badgesAtLeast'].includes(mail.eligibility?.kind))problems.push(`mail ${mail.mailId} has invalid eligibility`);}
 return problems;
}
