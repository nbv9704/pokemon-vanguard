import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('server wire contracts guard authenticated sockets on join, action and logout; cleanup timers',async()=>{
 const source=await readFile(new URL('../local-server.mjs',import.meta.url),'utf8'),controller=await readFile(new URL('../server/websocket-controller.mjs',import.meta.url),'utf8');
 assert.match(source,/createWebsocketController/);
 assert.match(controller,/auth\.sessionValid\(session\)/);
 assert.match(source,/ws\.authSessionId===session\.sid/);
 assert.match(controller,/room\.pendingSockets\.add\(ws\)/);
 assert.match(controller,/room\.pendingSockets\.delete\(ws\)/);
 assert.match(controller,/roomExisting\.clients\.size\+\(roomExisting\.pendingSockets\?\.size\|\|0\)/);assert.match(controller,/maxAccountSockets/);
 assert.match(controller,/clearTimeout\(expiryTimer\)/);
 assert.match(controller,/clearTimeout\(joinTimer\)/);
 assert.match(source,/pruneDetachedRooms\(rooms/);
});
