const DEFAULT_WIDTH=1280;
const DEFAULT_HEIGHT=720;

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export class GameViewportScaler{
  constructor({windowLike=window,documentLike=document,width=DEFAULT_WIDTH,height=DEFAULT_HEIGHT,minScale=.25,maxScale=4}={}){
    this.window=windowLike;
    this.document=documentLike;
    this.width=width;
    this.height=height;
    this.minScale=minScale;
    this.maxScale=maxScale;
    this.bound=()=>this.update();
    this.visualViewportHandler=()=>this.update();
  }
  viewportSize(){
    const vv=this.window.visualViewport;
    return {
      width:Math.max(1,Number(vv?.width||this.window.innerWidth||this.width)),
      height:Math.max(1,Number(vv?.height||this.window.innerHeight||this.height)),
    };
  }
  metrics(){
    const viewport=this.viewportSize();
    const scale=clamp(Math.min(viewport.width/this.width,viewport.height/this.height),this.minScale,this.maxScale);
    const renderedWidth=this.width*scale,renderedHeight=this.height*scale;
    return {
      logicalWidth:this.width,
      logicalHeight:this.height,
      scale,
      renderedWidth,
      renderedHeight,
      gutterX:Math.max(0,(viewport.width-renderedWidth)/2),
      gutterY:Math.max(0,(viewport.height-renderedHeight)/2),
      viewportWidth:viewport.width,
      viewportHeight:viewport.height,
    };
  }
  update(){
    const metrics=this.metrics(),style=this.document.documentElement.style;
    style.setProperty('--game-logical-width',`${metrics.logicalWidth}px`);
    style.setProperty('--game-logical-height',`${metrics.logicalHeight}px`);
    style.setProperty('--game-fit-scale',String(metrics.scale));
    style.setProperty('--game-rendered-width',`${metrics.renderedWidth}px`);
    style.setProperty('--game-rendered-height',`${metrics.renderedHeight}px`);
    style.setProperty('--game-gutter-x',`${metrics.gutterX}px`);
    style.setProperty('--game-gutter-y',`${metrics.gutterY}px`);
    this.document.body?.classList.add('resolution-locked');
    return metrics;
  }
  attach(){
    this.update();
    this.window.addEventListener?.('resize',this.bound,{passive:true});
    this.window.visualViewport?.addEventListener?.('resize',this.visualViewportHandler,{passive:true});
    this.window.visualViewport?.addEventListener?.('scroll',this.visualViewportHandler,{passive:true});
    return this;
  }
  detach(){
    this.window.removeEventListener?.('resize',this.bound);
    this.window.visualViewport?.removeEventListener?.('resize',this.visualViewportHandler);
    this.window.visualViewport?.removeEventListener?.('scroll',this.visualViewportHandler);
  }
}

export function createGameViewportScaler(options){return new GameViewportScaler(options);}
