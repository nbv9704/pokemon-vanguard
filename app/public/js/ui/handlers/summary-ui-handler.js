export const SummaryTab=Object.freeze({PROFILE:'PROFILE',STATS:'STATS',MOVES:'MOVES',LOADOUT:'LOADOUT'});
export const SUMMARY_TABS=Object.freeze([
 {id:SummaryTab.PROFILE,label:'Profile'},
 {id:SummaryTab.STATS,label:'Stats'},
 {id:SummaryTab.MOVES,label:'Moves'},
 {id:SummaryTab.LOADOUT,label:'Ability / Item'}
]);

export class SummaryUiHandler{
 constructor({initial=SummaryTab.PROFILE,onChange=()=>{}}={}){this.tab=initial;this.onChange=onChange;}
 select(tab){if(!SUMMARY_TABS.some(entry=>entry.id===tab)||this.tab===tab)return false;this.tab=tab;this.onChange();return true;}
 page(delta){const index=SUMMARY_TABS.findIndex(entry=>entry.id===this.tab),next=(index+delta+SUMMARY_TABS.length)%SUMMARY_TABS.length;return this.select(SUMMARY_TABS[next].id);}
 cancel(){if(this.tab===SummaryTab.PROFILE)return false;this.tab=SummaryTab.PROFILE;this.onChange();return true;}
 renderTabs(){return `<nav class="summary-tabs" aria-label="Pokémon summary pages">${SUMMARY_TABS.map((entry,index)=>`<button class="summary-tab ${entry.id===this.tab?'selected':''}" data-ui-focusable data-ui-focus-id="summary-tab-${entry.id}" data-ui-row="0" data-ui-col="${index+1}" data-v3-training="tab" data-tab="${entry.id}" aria-pressed="${entry.id===this.tab}"><b>${index+1}</b><span>${entry.label}</span></button>`).join('')}</nav>`;}
}
