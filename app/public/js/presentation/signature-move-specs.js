export const SIGNATURE_MOVE_SPECS={
 'thunderbolt':{family:'projectile',castPrimitive:'electric-bolt',impactPrimitive:'electric-bolt',chargePrimitive:'electric-bolt',flash:true,camera:'heavy'},
 'flamethrower':{family:'stream',castPrimitive:'flame-stream',impactPrimitive:'flame-stream',trailPrimitive:'trail',flash:true,camera:'heavy'},
 'surf':{family:'field-wave',castPrimitive:'water-wave',impactPrimitive:'water-wave',flash:true,camera:'heavy'},
 'solar-beam':{family:'beam',castPrimitive:'beam',impactPrimitive:'solar-flare',chargePrimitive:'solar-flare',flash:true,camera:'heavy'},
 'hyper-beam':{family:'beam',castPrimitive:'hyper-beam-core',impactPrimitive:'hyper-beam-core',chargePrimitive:'solar-flare',chargeVariant:'white',flash:true,camera:'heavy'},
 'protect':{family:'barrier',castPrimitive:'shield',impactPrimitive:'shield',camera:'none'},
 'earthquake':{family:'quake',castPrimitive:'quake-ring',impactPrimitive:'quake-ring',flash:true,camera:'quake'},
 'shadow-ball':{family:'projectile',castPrimitive:'shadow-orb',impactPrimitive:'shadow-orb',chargePrimitive:'shadow-orb',camera:'light'},
 'close-combat':{family:'combo',castPrimitive:'combat-hit',impactPrimitive:'combat-hit',userMotion:'actor-lunge',camera:'heavy'},
 'dragon-pulse':{family:'projectile',castPrimitive:'dragon-wave',impactPrimitive:'dragon-wave',chargePrimitive:'dragon-wave',flash:true,camera:'light'},

 'ice-beam':{family:'beam',castPrimitive:'ice-beam',impactPrimitive:'ice-burst',chargePrimitive:'ice-crystal',flash:true,camera:'light'},
 'psychic':{family:'pulse',castPrimitive:'psychic-wave',impactPrimitive:'psychic-wave',flash:true,camera:'light'},
 'moonblast':{family:'projectile',castPrimitive:'moon-orb',impactPrimitive:'moon-burst',chargePrimitive:'moon-orb',flash:true,camera:'light'},
 'sludge-bomb':{family:'projectile',castPrimitive:'sludge-orb',impactPrimitive:'sludge-splash',chargePrimitive:'sludge-orb',camera:'light'},
 'flash-cannon':{family:'beam',castPrimitive:'flash-cannon',impactPrimitive:'steel-burst',chargePrimitive:'steel-charge',flash:true,camera:'heavy'},
 'air-slash':{family:'slash',castPrimitive:'air-blade',impactPrimitive:'air-blade',camera:'light'},
 'stone-edge':{family:'target-rise',castPrimitive:'stone-spike',impactPrimitive:'stone-spike',camera:'heavy'},
 'bug-buzz':{family:'pulse',castPrimitive:'sonic-ring',impactPrimitive:'sonic-ring',camera:'light'},
 'dark-pulse':{family:'pulse',castPrimitive:'dark-ring',impactPrimitive:'dark-ring',camera:'light'},
 'aura-sphere':{family:'projectile',castPrimitive:'aura-sphere',impactPrimitive:'aura-burst',chargePrimitive:'aura-sphere',camera:'light'},
 'hydro-pump':{family:'beam',castPrimitive:'hydro-jet',impactPrimitive:'water-burst',chargePrimitive:'water-charge',flash:true,camera:'heavy'},
 'fire-blast':{family:'projectile',castPrimitive:'fire-star',impactPrimitive:'fire-star',chargePrimitive:'fire-star',flash:true,camera:'heavy'},
 'thunder':{family:'target-strike',castPrimitive:'thunder-strike',impactPrimitive:'thunder-strike',flash:true,camera:'heavy'},
 'leaf-blade':{family:'slash',castPrimitive:'leaf-slash',impactPrimitive:'leaf-slash',camera:'light'},
 'iron-head':{family:'rush',castPrimitive:'iron-impact',impactPrimitive:'steel-burst',userMotion:'actor-lunge',camera:'heavy'},
 'extreme-speed':{family:'rush',castPrimitive:'speed-streak',impactPrimitive:'speed-streak',userMotion:'actor-lunge',camera:'heavy'},
 'blizzard':{family:'field-storm',castPrimitive:'blizzard-flurry',impactPrimitive:'ice-burst',flash:true,camera:'heavy'},
 'focus-blast':{family:'projectile',castPrimitive:'focus-orb',impactPrimitive:'focus-burst',chargePrimitive:'focus-orb',camera:'heavy'},
 'power-gem':{family:'barrage',castPrimitive:'gem-burst',impactPrimitive:'gem-burst',camera:'light'},
 'will-o-wisp':{family:'projectile',castPrimitive:'ghost-flame',impactPrimitive:'ghost-flame',chargePrimitive:'ghost-flame',camera:'none',targetReaction:false}
};

export const SIGNATURE_MOVE_IDS=Object.freeze(Object.keys(SIGNATURE_MOVE_SPECS));
export const signatureMoveSpec=id=>SIGNATURE_MOVE_SPECS[id]||null;
