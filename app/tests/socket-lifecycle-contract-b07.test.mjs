import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('server wire contracts guard authenticated sockets on join, action and logout; cleanup timers',async()=>{
 const source=await readFile(new URL('../local-server.mjs',import.meta.url),'utf8');
 assert.match(source,/auth\.sessionValid\(session\)/);
 assert.match(source,/ws\.authSessionId===session\.sid/);
 assert.match(source,/room\.pendingSockets\.add\(ws\)/);
 assert.match(source,/room\.pendingSockets\.delete\(ws\)/);
 assert.match(source,/roomExisting\.clients\.size\+\(roomExisting\.pendingSockets\?\.size\|\|0\)/);assert.match(source,/maxAccountSockets/);
 assert.match(source,/clearTimeout\(expiryTimer\)/);
 assert.match(source,/clearTimeout\(joinTimer\)/);
 assert.match(source,/pruneDetachedRooms\(rooms/);
});
