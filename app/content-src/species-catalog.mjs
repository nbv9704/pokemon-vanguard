const ROLE_STATS = {
  'physical-fast':{hp:70,atk:105,def:65,spa:55,spd:70,spe:115},
  'special-fast':{hp:70,atk:55,def:65,spa:105,spd:70,spe:115},
  'physical-tank':{hp:100,atk:100,def:105,spa:45,spd:80,spe:50},
  'special-tank':{hp:100,atk:45,def:80,spa:100,spd:105,spe:50},
  support:{hp:95,atk:45,def:90,spa:70,spd:100,spe:80},
  disruptor:{hp:80,atk:70,def:80,spa:80,spd:80,spe:90}
};
const rows = [
 ['physical-fast','quick-start','rally'],['special-fast','keen-focus','tailwind-call'],['physical-tank','sturdy-heart','rally'],
 ['special-fast','rain-swimmer','tailwind-call'],['disruptor','clean-entry','barrier'],['special-tank','water-shell','redirect'],
 ['support','sun-runner','barrier'],['physical-tank','thorn-coat','rally'],['support','healer','tailwind-call'],
 ['physical-fast','quick-start','rally'],['special-fast','keen-focus','tailwind-call'],['physical-tank','sturdy-heart','redirect'],
 ['special-fast','keen-focus','tailwind-call'],['special-tank','calm-mind','barrier'],['support','healer','redirect'],
 ['physical-tank','sturdy-heart','barrier'],['physical-tank','intimidator','redirect'],['disruptor','clean-entry','rally'],
 ['physical-fast','quick-start','rally'],['support','healer','barrier'],['disruptor','intimidator','redirect'],
 ['disruptor','keen-focus','barrier'],['physical-fast','quick-start','tailwind-call'],['physical-tank','intimidator','rally'],
 ['physical-tank','sun-runner','rally'],['special-tank','calm-mind','barrier'],['support','water-shell','redirect'],
 ['support','clean-entry','barrier'],['physical-fast','thorn-coat','rally'],['special-tank','healer','redirect'],
 ['physical-tank','sturdy-heart','redirect'],['physical-fast','quick-start','rally'],['disruptor','thorn-coat','tailwind-call'],
 ['special-fast','keen-focus','barrier'],['special-tank','calm-mind','redirect'],['support','healer','tailwind-call']
];
const primaryAbility = {Flame:'dawnbringer',Tide:'raincaller',Bloom:'wild-growth',Volt:'static-field',Frost:'snowglobe',Stone:'sandstream',Gale:'tailwind',Shadow:'night-hunter',Light:'radiance',Venom:'venom-touch',Steel:'ironhide',Astral:'mind-link'};
const primaryUtility = {Flame:'sun-call',Tide:'rain-call',Bloom:'meadow-call',Volt:'storm-call',Frost:'snow-call',Stone:'sand-call',Gale:'tailwind-call',Shadow:'rally',Light:'barrier',Venom:'redirect',Steel:'barrier',Astral:'rally'};

export function createSpecies(identities) {
  return identities.map((identity,index)=>{
    const [role,secondAbility,extraUtility]=rows[index],primary=identity.types[0],coverage=identity.coverageType;
    const attacks=[`${primary.toLowerCase()}-strike`,`${primary.toLowerCase()}-lance`,`${primary.toLowerCase()}-tempest`,`${coverage.toLowerCase()}-strike`,`${coverage.toLowerCase()}-lance`,`${coverage.toLowerCase()}-tempest`];
    const moveIds=[...new Set([...attacks,'guard','mend',primaryUtility[primary],extraUtility])];
    return {...identity,nameKey:`species.${identity.id}.name`,baseStats:{...ROLE_STATS[role]},abilityIds:[primaryAbility[primary],secondAbility],moveIds,role,rarity:index>=32?'legendary':index%3===2?'epic':index%3===1?'rare':'common',defaultBuild:{name:'Build mặc định',points:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0},alignment:{up:null,down:null},abilityId:primaryAbility[primary],moveIds:[`${primary.toLowerCase()}-strike`,`${coverage.toLowerCase()}-lance`,'guard',primaryUtility[primary]],itemId:'none'}};
  });
}
