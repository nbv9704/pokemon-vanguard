export function renderV3PlaybackControls({speed=1,playing=false}={}){
 return `<div class="v3-playback-controls" aria-label="Battle playback controls"><label>Animation speed <select data-v3-playback-speed aria-label="Battle animation speed" ${playing?'disabled':''}><option value="1" ${speed===2?'':'selected'}>1×</option><option value="2" ${speed===2?'selected':''}>2×</option></select></label>${playing?'<button class="small ghost" data-v3-battle="skip">Skip animation ⏭</button>':''}</div>`;
}
