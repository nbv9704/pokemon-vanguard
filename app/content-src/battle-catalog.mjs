export const TYPES = ['Flame','Tide','Bloom','Volt','Frost','Stone','Gale','Shadow','Light','Venom','Steel','Astral'];

const attackNames = {
  Flame:['Fire Fang','Flame Lance','Magma Tempest'], Tide:['Water Pulse','Tide Lance','Ocean Tempest'],
  Bloom:['Vine Lash','Thorn Lance','Pollen Tempest'], Volt:['Arc Bolt','Lightning Lance','Thunder Tempest'],
  Frost:['Ice Shard','Frost Lance','Blizzard Tempest'], Stone:['Stone Hammer','Rock Lance','Quake Tempest'],
  Gale:['Wind Blade','Sky Lance','Gale Tempest'], Shadow:['Night Slash','Shadow Lance','Dark Tempest'],
  Light:['Radiant Strike','Light Lance','Solar Tempest'], Venom:['Venom Fang','Toxic Lance','Miasma Tempest'],
  Steel:['Steel Claw','Alloy Lance','Metal Tempest'], Astral:['Mind Burst','Astral Lance','Galaxy Tempest']
};
const strikeCategory = {Flame:'physical',Tide:'special',Bloom:'physical',Volt:'special',Frost:'special',Stone:'physical',Gale:'physical',Shadow:'physical',Light:'special',Venom:'physical',Steel:'physical',Astral:'special'};
const secondary = {
  Flame:['applyStatus',{status:'burn'},.2,'hitTarget'], Tide:['changeStage',{stat:'spe',amount:-1},.2,'hitTarget'],
  Bloom:['changeStage',{stat:'def',amount:-1},.2,'hitTarget'], Volt:['applyStatus',{status:'slow'},.2,'hitTarget'],
  Frost:['applyStatus',{status:'slow'},.2,'hitTarget'], Stone:['changeStage',{stat:'def',amount:-1},.2,'hitTarget'],
  Gale:['changeStage',{stat:'atk',amount:-1},.2,'hitTarget'], Shadow:['changeStage',{stat:'spd',amount:-1},.2,'hitTarget'],
  Light:['changeStage',{stat:'spa',amount:-1},.2,'hitTarget'], Venom:['applyStatus',{status:'poison'},.3,'hitTarget'],
  Steel:['changeStage',{stat:'def',amount:1},.2,'self'], Astral:['applyStatus',{status:'sleep'},.1,'hitTarget']
};

const effect = (kind, params, chance=1, target='field', timing='onUse') => ({kind,timing,target,chance,params});
export function createMoves() {
  const moves=[];
  for (const type of TYPES) {
    const slug=type.toLowerCase(), categories=[strikeCategory[type],strikeCategory[type]==='physical'?'special':'physical','special'];
    const [kind,params,chance,target]=secondary[type];
    moves.push({id:`${slug}-strike`,name:attackNames[type][0],description:`A reliable ${type} attack with a possible secondary effect.`,type,category:categories[0],power:60,accuracy:100,maxPP:20,priority:0,targetMode:'foe',contact:categories[0]==='physical',effects:[effect(kind,params,chance,target,'afterDamage')],animationId:`${slug}-strike`,soundId:null});
    moves.push({id:`${slug}-lance`,name:attackNames[type][1],description:`A powerful single-target ${type} attack.`,type,category:categories[1],power:85,accuracy:95,maxPP:10,priority:0,targetMode:'foe',contact:false,effects:[],animationId:`${slug}-lance`,soundId:null});
    moves.push({id:`${slug}-tempest`,name:attackNames[type][2],description:`A ${type} attack that hits all active opponents.`,type,category:categories[2],power:65,accuracy:95,maxPP:10,priority:0,targetMode:'allFoes',contact:false,effects:[],animationId:`${slug}-tempest`,soundId:null});
  }
  return [...moves,
    {id:'sun-call',name:'Call Sun',description:'Sets Sun for 5 turns.',type:'Flame',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'sun',remaining:5})],animationId:'sun-call',soundId:null},
    {id:'rain-call',name:'Call Rain',description:'Sets Rain for 5 turns.',type:'Tide',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'rain',remaining:5})],animationId:'rain-call',soundId:null},
    {id:'meadow-call',name:'Call Meadow',description:'Sets Meadow terrain for 5 turns.',type:'Bloom',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setTerrain',{id:'meadow',remaining:5})],animationId:'meadow-call',soundId:null},
    {id:'storm-call',name:'Call Storm',description:'Sets Storm terrain for 5 turns.',type:'Volt',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setTerrain',{id:'storm',remaining:5})],animationId:'storm-call',soundId:null},
    {id:'snow-call',name:'Call Snow',description:'Sets Snow for 5 turns.',type:'Frost',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'snow',remaining:5})],animationId:'snow-call',soundId:null},
    {id:'sand-call',name:'Call Sand',description:'Sets Sand for 5 turns.',type:'Stone',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'sand',remaining:5})],animationId:'sand-call',soundId:null},
    {id:'guard',name:'Guard',description:'Blocks opponent damage and status effects this turn.',type:'Steel',category:'status',power:0,accuracy:100,maxPP:10,priority:4,targetMode:'self',contact:false,effects:[effect('guard',{},1,'self')],animationId:'guard',soundId:null},
    {id:'mend',name:'Mend',description:'Restores 35% of maximum HP.',type:'Light',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'self',contact:false,effects:[effect('heal',{fraction:.35},1,'self')],animationId:'mend',soundId:null},
    {id:'rally',name:'Rally',description:'Raises Attack and Special Attack by one stage.',type:'Astral',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'self',contact:false,effects:[effect('changeStage',{stat:'atk',amount:1},1,'self'),effect('changeStage',{stat:'spa',amount:1},1,'self')],animationId:'rally',soundId:null},
    {id:'tailwind-call',name:'Tailwind',description:'Doubles the allied side’s Speed for 4 turns.',type:'Gale',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'ownSide',contact:false,effects:[effect('setSideCondition',{id:'tailwind',remaining:4},1,'ownSide')],animationId:'tailwind-call',soundId:null},
    {id:'barrier',name:'Barrier',description:'Reduces damage received by the allied side by 25% for 3 turns.',type:'Light',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'ownSide',contact:false,effects:[effect('setSideCondition',{id:'barrier',remaining:3},1,'ownSide')],animationId:'barrier',soundId:null},
    {id:'redirect',name:'Redirect',description:'Redirects an opponent’s single-target move to the user.',type:'Shadow',category:'status',power:0,accuracy:100,maxPP:10,priority:2,targetMode:'self',contact:false,effects:[effect('redirect',{},1,'self')],animationId:'redirect',soundId:null}
  ];
}

const abilityText = {
  dawnbringer:'Sets Sun for 5 turns on entry.', raincaller:'Sets Rain for 5 turns on entry.', 'wild-growth':'Sets Meadow terrain for 5 turns on entry.', 'static-field':'Sets Storm terrain for 5 turns on entry.', snowglobe:'Sets Snow for 5 turns on entry.', sandstream:'Sets Sand for 5 turns on entry.', tailwind:'Multiplies the user’s Speed by 1.3.', 'night-hunter':'Deals 1.25× damage to targets below half HP.', radiance:'Restores 5% maximum HP at the end of each turn.', 'venom-touch':'Has a 30% chance to poison after dealing damage.', ironhide:'Reduces damage received to 0.8×.', 'mind-link':'Active allies deal 1.15× damage.', 'quick-start':'Multiplies Speed by 1.2 while at full HP.', 'keen-focus':'Adds 5 percentage points to accuracy.', 'sturdy-heart':'Once per battle, survives at 1 HP when struck from full HP.', 'rain-swimmer':'Multiplies Speed by 1.5 during Rain.', 'clean-entry':'Cures the user’s major status condition on entry.', 'water-shell':'Reduces incoming Flame damage to 0.5×.', 'sun-runner':'Multiplies Speed by 1.5 during Sun.', 'thorn-coat':'After a contact move, damages the attacker for 1/16 maximum HP.', healer:'Restores 5% HP to the weakest ally at the end of each turn.', 'calm-mind':'Multiplies Special Defense by 1.2.', intimidator:'Lowers every opponent’s Attack by one stage on entry.', 'steady-body':'Prevents stat reductions caused by opponents.'
};
export const abilities = Object.entries(abilityText).map(([id,description])=>({id,name:id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),description}));

const itemText = {none:'No held item.','vital-seed':'Restores 8% maximum HP at the end of each turn.','power-lens':'Multiplies damage dealt by 1.2.','aegis-plate':'Reduces damage received to 0.8×.','swift-feather':'Multiplies Speed by 1.25.','cure-berry':'Once, cures the first major status condition received.','focus-crystal':'Once, survives at 1 HP when struck from full HP.','healing-berry':'Once at or below 25% HP, restores 25% maximum HP.','clear-charm':'Prevents stat reductions caused by opponents.','weather-rock':'Weather created by the holder lasts 7 turns.','terrain-root':'Terrain created by the holder lasts 7 turns.','special-lens':'Multiplies Special Attack by 1.15.','physical-band':'Multiplies Attack by 1.15.'};
export const items = Object.entries(itemText).map(([id,description])=>({id,name:id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),description,consumable:['cure-berry','focus-crystal','healing-berry'].includes(id)}));
