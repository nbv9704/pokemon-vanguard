// A room may have several tabs for the same player. Build and serialize one
// immutable frame per audience, then reuse that string for every matching tab.
// The audience key must include every identity/role distinction used by project().
export function broadcastSharedFrames(clients,{project,send}){
 const encodedByAudience=new Map();let sockets=0,projections=0,deliveredSockets=0,deliveredBytes=0;
 for(const [socket,audience] of clients){
  let encoded=encodedByAudience.get(audience);
  if(encoded===undefined){encoded=JSON.stringify(project(audience));encodedByAudience.set(audience,encoded);projections++;}
  if(send(socket,encoded)!==false){deliveredSockets++;deliveredBytes+=Buffer.byteLength(encoded);}sockets++;
 }
 return {sockets,projections,serializations:projections,deliveredSockets,deliveredBytes};
}
