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
