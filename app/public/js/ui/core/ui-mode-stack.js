export class UiModeStack{
 constructor(initial='HOME',{onChange=()=>{}}={}){this.stack=[initial];this.onChange=onChange;}
 get current(){return this.stack.at(-1);}
 get depth(){return this.stack.length;}
 snapshot(){return [...this.stack];}
 push(mode){if(!mode)throw new Error('UI mode is required');this.stack.push(mode);this.onChange(this.snapshot());return mode;}
 pop(){if(this.stack.length<=1)return this.current;this.stack.pop();this.onChange(this.snapshot());return this.current;}
 replace(mode){if(!mode)throw new Error('UI mode is required');this.stack[this.stack.length-1]=mode;this.onChange(this.snapshot());return mode;}
 reset(mode='HOME'){if(!mode)throw new Error('UI mode is required');this.stack=[mode];this.onChange(this.snapshot());return mode;}
 includes(mode){return this.stack.includes(mode);}
}
