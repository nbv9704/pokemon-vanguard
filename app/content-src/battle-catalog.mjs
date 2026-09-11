export const TYPES = ['Flame','Tide','Bloom','Volt','Frost','Stone','Gale','Shadow','Light','Venom','Steel','Astral'];

const attackNames = {
  Flame:['Nanh Lửa','Thương Hỏa','Bão Dung Nham'], Tide:['Xung Thủy','Thương Triều','Bão Hải Lưu'],
  Bloom:['Roi Mầm','Thương Gai','Bão Phấn Hoa'], Volt:['Tia Hồ Quang','Thương Sét','Bão Điện'],
  Frost:['Mảnh Băng','Thương Giá','Bão Tuyết'], Stone:['Búa Đá','Thương Nham','Bão Địa Chấn'],
  Gale:['Lưỡi Gió','Thương Không','Bão Cuồng Phong'], Shadow:['Trảm Đêm','Thương Bóng','Bão Hắc Ám'],
  Light:['Quang Kích','Thương Sáng','Bão Nhật Quang'], Venom:['Nọc Độc','Thương Độc','Bão Chướng Khí'],
  Steel:['Vuốt Thép','Thương Hợp Kim','Bão Kim Loại'], Astral:['Tâm Bạo','Thương Tinh Tú','Bão Thiên Hà']
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
    moves.push({id:`${slug}-strike`,name:attackNames[type][0],description:`Đòn ${type} ổn định; có thể tạo hiệu ứng phụ.`,type,category:categories[0],power:60,accuracy:100,maxPP:20,priority:0,targetMode:'foe',contact:categories[0]==='physical',effects:[effect(kind,params,chance,target,'afterDamage')],animationId:`${slug}-strike`,soundId:null});
    moves.push({id:`${slug}-lance`,name:attackNames[type][1],description:`Đòn ${type} uy lực cao lên một mục tiêu.`,type,category:categories[1],power:85,accuracy:95,maxPP:10,priority:0,targetMode:'foe',contact:false,effects:[],animationId:`${slug}-lance`,soundId:null});
    moves.push({id:`${slug}-tempest`,name:attackNames[type][2],description:`Đòn ${type} đánh toàn bộ đối thủ đang hoạt động.`,type,category:categories[2],power:65,accuracy:95,maxPP:10,priority:0,targetMode:'allFoes',contact:false,effects:[],animationId:`${slug}-tempest`,soundId:null});
  }
  return [...moves,
    {id:'sun-call',name:'Gọi Mặt Trời',description:'Đặt Sun trong 5 lượt.',type:'Flame',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'sun',remaining:5})],animationId:'sun-call',soundId:null},
    {id:'rain-call',name:'Gọi Mưa',description:'Đặt Rain trong 5 lượt.',type:'Tide',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'rain',remaining:5})],animationId:'rain-call',soundId:null},
    {id:'meadow-call',name:'Gọi Đồng Cỏ',description:'Đặt Meadow trong 5 lượt.',type:'Bloom',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setTerrain',{id:'meadow',remaining:5})],animationId:'meadow-call',soundId:null},
    {id:'storm-call',name:'Gọi Bão Điện',description:'Đặt Storm trong 5 lượt.',type:'Volt',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setTerrain',{id:'storm',remaining:5})],animationId:'storm-call',soundId:null},
    {id:'snow-call',name:'Gọi Tuyết',description:'Đặt Snow trong 5 lượt.',type:'Frost',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'snow',remaining:5})],animationId:'snow-call',soundId:null},
    {id:'sand-call',name:'Gọi Bão Cát',description:'Đặt Sand trong 5 lượt.',type:'Stone',category:'status',power:0,accuracy:100,maxPP:5,priority:0,targetMode:'field',contact:false,effects:[effect('setWeather',{id:'sand',remaining:5})],animationId:'sand-call',soundId:null},
    {id:'guard',name:'Phòng Thủ',description:'Chặn sát thương và trạng thái từ đối thủ trong lượt.',type:'Steel',category:'status',power:0,accuracy:100,maxPP:10,priority:4,targetMode:'self',contact:false,effects:[effect('guard',{},1,'self')],animationId:'guard',soundId:null},
    {id:'mend',name:'Hồi Phục',description:'Hồi 35% HP tối đa.',type:'Light',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'self',contact:false,effects:[effect('heal',{fraction:.35},1,'self')],animationId:'mend',soundId:null},
    {id:'rally',name:'Hiệu Triệu',description:'Tăng ATK và SPA một bậc.',type:'Astral',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'self',contact:false,effects:[effect('changeStage',{stat:'atk',amount:1},1,'self'),effect('changeStage',{stat:'spa',amount:1},1,'self')],animationId:'rally',soundId:null},
    {id:'tailwind-call',name:'Thuận Gió',description:'Tăng gấp đôi Speed cho phe mình trong 4 lượt.',type:'Gale',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'ownSide',contact:false,effects:[effect('setSideCondition',{id:'tailwind',remaining:4},1,'ownSide')],animationId:'tailwind-call',soundId:null},
    {id:'barrier',name:'Kết Giới',description:'Giảm 25% sát thương phe mình nhận trong 3 lượt.',type:'Light',category:'status',power:0,accuracy:100,maxPP:10,priority:0,targetMode:'ownSide',contact:false,effects:[effect('setSideCondition',{id:'barrier',remaining:3},1,'ownSide')],animationId:'barrier',soundId:null},
    {id:'redirect',name:'Dẫn Hướng',description:'Chuyển đòn đơn mục tiêu của đối thủ sang người dùng.',type:'Shadow',category:'status',power:0,accuracy:100,maxPP:10,priority:2,targetMode:'self',contact:false,effects:[effect('redirect',{},1,'self')],animationId:'redirect',soundId:null}
  ];
}

const abilityText = {
  dawnbringer:'Khi vào sân, đặt Sun 5 lượt.', raincaller:'Khi vào sân, đặt Rain 5 lượt.', 'wild-growth':'Khi vào sân, đặt Meadow 5 lượt.', 'static-field':'Khi vào sân, đặt Storm 5 lượt.', snowglobe:'Khi vào sân, đặt Snow 5 lượt.', sandstream:'Khi vào sân, đặt Sand 5 lượt.', tailwind:'Speed bản thân ×1,3.', 'night-hunter':'Gây sát thương ×1,25 khi mục tiêu dưới nửa HP.', radiance:'Cuối lượt hồi 5% HP tối đa.', 'venom-touch':'Sau khi gây sát thương, có 30% gây Poison.', ironhide:'Sát thương nhận ×0,8.', 'mind-link':'Đồng đội đang hoạt động gây sát thương ×1,15.', 'quick-start':'Speed ×1,2 khi đầy HP.', 'keen-focus':'Accuracy tăng 5 điểm phần trăm.', 'sturdy-heart':'Một lần mỗi trận, sống ở 1 HP từ đầy HP.', 'rain-swimmer':'Speed ×1,5 trong Rain.', 'clean-entry':'Khi vào sân, chữa major status của bản thân.', 'water-shell':'Sát thương Flame nhận ×0,5.', 'sun-runner':'Speed ×1,5 trong Sun.', 'thorn-coat':'Sau đòn contact, gây phản sát thương 1/16 HP tối đa.', healer:'Cuối lượt hồi 5% HP cho đồng đội yếu nhất.', 'calm-mind':'Special Defense ×1,2.', intimidator:'Khi vào sân, giảm ATK mọi đối thủ một bậc.', 'steady-body':'Chặn giảm chỉ số do đối thủ.'
};
export const abilities = Object.entries(abilityText).map(([id,description])=>({id,name:id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),description}));

const itemText = {none:'Không mang vật phẩm.','vital-seed':'Cuối lượt hồi 8% HP tối đa.','power-lens':'Sát thương gây ra ×1,2.','aegis-plate':'Sát thương nhận ×0,8.','swift-feather':'Speed ×1,25.','cure-berry':'Một lần, chữa major status đầu tiên nhận.','focus-crystal':'Một lần, sống ở 1 HP từ đầy HP.','healing-berry':'Một lần, dưới hoặc bằng 25% HP thì hồi 25%.','clear-charm':'Chặn giảm chỉ số do đối thủ.','weather-rock':'Weather do người mang tạo kéo dài 7 lượt.','terrain-root':'Terrain do người mang tạo kéo dài 7 lượt.','special-lens':'Special Attack ×1,15.','physical-band':'Attack ×1,15.'};
export const items = Object.entries(itemText).map(([id,description])=>({id,name:id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),description,consumable:['cure-berry','focus-crystal','healing-berry'].includes(id)}));
