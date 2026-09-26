const handlersFor=(manifests,id)=>manifests?.[id]?.handlers||[];
const hasHandler=(manifests,id,handlerId)=>handlersFor(manifests,id).some(handler=>handler.id===handlerId);

// Current mainline Copycat policy. Keeping this explicit prevents a newly reviewed
// move from becoming Copycat-callable merely because it has a manifest.
const COPYCAT_BLOCKED=new Set([
 'assist','baneful-bunker','beak-blast','belch','bestow','celebrate','chatter','circle-throw',
 'copycat','counter','covet','crafty-shield','destiny-bond','detect','dragon-tail','dynamax-cannon',
 'endure','feint','focus-punch','follow-me','helping-hand','hold-hands','kings-shield','mat-block',
 'me-first','metronome','mimic','mirror-coat','mirror-move','nature-power','obstruct','protect',
 'rage-powder','roar','shell-trap','sketch','sleep-talk','snatch','spiky-shield','spotlight','struggle',
 'switcheroo','thief','transform','trick','whirlwind'
]);

export function calledMoveBlocked(manifests,moveId,{kind='copycat',callerMoveId=null}={}){
 const manifest=manifests?.[moveId];
 if(!manifest||manifest.unusable===true)return true;
 if(moveId===callerMoveId)return true;
 if(kind==='copycat'&&COPYCAT_BLOCKED.has(moveId))return true;
 if(['copycat','sleep-talk','instruct'].includes(moveId))return true;
 if(kind==='sleep-talk'){
  if(['uproar','focus-punch'].includes(moveId))return true;
  if(hasHandler(manifests,moveId,'prepare-two-turn-move')||hasHandler(manifests,moveId,'apply-recharge'))return true;
 }
 if(kind==='instruct'){
  if(hasHandler(manifests,moveId,'prepare-two-turn-move')||hasHandler(manifests,moveId,'apply-recharge')||hasHandler(manifests,moveId,'apply-rampage-lock'))return true;
 }
 return false;
}

export function callableKnownMoves(unit,manifests,{kind='sleep-talk',callerMoveId='sleep-talk'}={}){
 return (unit?.buildSnapshot?.moveIds||Object.keys(unit?.pp||{})).filter(moveId=>moveId!==callerMoveId&&!calledMoveBlocked(manifests,moveId,{kind,callerMoveId}));
}
