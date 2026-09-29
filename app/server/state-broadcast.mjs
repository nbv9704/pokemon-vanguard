// Tabs with the same audience share one immutable serialized frame.
/**
 * @template TSocket, TAudience
 * @param {Iterable<readonly [TSocket,TAudience]>} clients
 * @param {{project:(audience:TAudience)=>unknown,send:(socket:TSocket,frame:string)=>boolean|void}} options
 */
export function broadcastSharedFrames(clients,{project,send}){
 const encodedByAudience=new Map();let sockets=0,projections=0,deliveredSockets=0,deliveredBytes=0;
 for(const [socket,audience] of clients){
  let encoded=encodedByAudience.get(audience);
  if(encoded===undefined){
   encoded=JSON.stringify(project(audience));
   if(typeof encoded!=='string')throw new TypeError('Broadcast projection must be JSON-serializable');
   encodedByAudience.set(audience,encoded);projections++;
  }
  if(send(socket,encoded)!==false){deliveredSockets++;deliveredBytes+=Buffer.byteLength(encoded);}sockets++;
 }
 return {sockets,projections,serializations:projections,deliveredSockets,deliveredBytes};
}

/** @param {Record<string,unknown>} value @param {string} key */
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
/** @param {Record<string,unknown>} previous @param {Record<string,unknown>} next */
function viewDelta(previous,next){
 /** @type {Record<string,unknown>} */const patch={};/** @type {string[]} */const removed=[];
 for(const key of Object.keys(next))if(!own(previous,key)||JSON.stringify(previous[key])!==JSON.stringify(next[key]))patch[key]=next[key];
 for(const key of Object.keys(previous))if(!own(next,key))removed.push(key);
 return {patch,removed};
}

// Per-server-instance cursor state. A socket receives a full state on join/resync,
// then shallow domain deltas; every changed domain remains an allowlisted projector output.
export function createDeltaStateBroadcaster({maxDeltaRatio=.9}={}){
 /** @type {WeakMap<object,{cursor:number,frame:{view:Record<string,unknown>}}>} */
 const baselines=new WeakMap();
 /** @param {object} socket */
 const reset=socket=>baselines.delete(socket);
 /**
  * @template {object} TSocket, TAudience
  * @param {Iterable<readonly [TSocket,TAudience]>} clients
  * @param {{project:(audience:TAudience)=>unknown,send:(socket:TSocket,frame:string)=>boolean|void,supportsDelta?:(socket:TSocket)=>boolean}} options
  */
 function broadcast(clients,{project,send,supportsDelta=()=>true}){
  /** @type {Map<TAudience,{view:Record<string,unknown>,[key:string]:unknown}>} */const projectedByAudience=new Map();
  /** @type {Map<object,string>} */const encodedByProjection=new Map();
  /** @type {Map<object,{cursor:number,encoded:string,delta:boolean,unchanged:boolean}>} */const encodedByBaseline=new Map();let sockets=0,projections=0,serializations=0,deliveredSockets=0,deliveredBytes=0,fullFrames=0,deltaFrames=0,unchangedFrames=0;
  for(const [socket,audience] of clients){
   let projected=projectedByAudience.get(audience);if(projected===undefined){const candidate=project(audience);if(!candidate||typeof candidate!=='object'||!('view' in candidate)||!candidate.view||typeof candidate.view!=='object'||Array.isArray(candidate.view))throw new TypeError('Broadcast projection must contain a JSON-serializable view');projected=/** @type {{view:Record<string,unknown>,[key:string]:unknown}} */(candidate);projectedByAudience.set(audience,projected);projections++;}
   const previous=supportsDelta(socket)?baselines.get(socket):null,cursor=(previous?.cursor||0)+1;let encoded;
   if(!previous){
    let cached=encodedByProjection.get(projected);if(!cached){cached=JSON.stringify({...projected,cursor});encodedByProjection.set(projected,cached);serializations++;}encoded=cached;fullFrames++;
   }else{
    let cached=encodedByBaseline.get(previous.frame);if(!cached||cached.cursor!==cursor){const {patch,removed}=viewDelta(previous.frame.view,projected.view),changedKeys=[...Object.keys(patch),...removed];const deltaEncoded=JSON.stringify({type:'state-delta',baseCursor:previous.cursor,cursor,patch,removed,changedKeys}),fullEncoded=JSON.stringify({...projected,cursor});serializations+=2;const delta=Buffer.byteLength(deltaEncoded)<Buffer.byteLength(fullEncoded)*maxDeltaRatio;cached={cursor,encoded:delta?deltaEncoded:fullEncoded,delta,unchanged:delta&&changedKeys.length===0};encodedByBaseline.set(previous.frame,cached);}encoded=cached.encoded;
    if(cached.delta){deltaFrames++;if(cached.unchanged)unchangedFrames++;}else fullFrames++;
   }
   if(send(socket,encoded)!==false){if(supportsDelta(socket))baselines.set(socket,{cursor,frame:projected});else baselines.delete(socket);deliveredSockets++;deliveredBytes+=Buffer.byteLength(encoded);}sockets++;
  }
  return {sockets,projections,serializations,deliveredSockets,deliveredBytes,fullFrames,deltaFrames,unchangedFrames};
 }
 return {broadcast,reset};
}
