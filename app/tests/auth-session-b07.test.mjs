import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createLocalAuth} from '../server/local-auth.mjs';

const secret='b07-fake-session-secret-with-strong-length-0123456789';
const reqFor=value=>({headers:{cookie:`pv_session=${value}`}});
const sign=payload=>{const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${encoded}.${createHmac('sha256',secret).update(encoded).digest('base64url')}`;};
const response=()=>({status:null,headers:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(){}});
const local=id=>({accountId:`dev:${id}`,playerId:id,roomId:`aether-${id}`,name:'Tester',provider:'local'});

test('active socket credentials expire against the clock even without a new HTTP handshake',async()=>{
 let timestamp=2_000_000_000_000;const auth=createLocalAuth({env:{AUTH_SESSION_SECRET:secret,AUTH_ALLOW_LOCAL_BETA:'true'},now:()=>timestamp});
 const req={method:'POST',headers:{cookie:''},[Symbol.asyncIterator]:async function*(){yield Buffer.from('legacyPlayerId=simple');}},res=response();
 assert.equal(await auth.handle(req,res,new URL('http://localhost/api/auth/dev')),true);
 const raw=/pv_session=([^;]+)/.exec(res.headers['Set-Cookie'])[1],session=auth.readSession(reqFor(raw));
 assert.equal(session.playerId,'simple');assert.equal(auth.sessionValid(session),true);
 timestamp=session.exp*1000;assert.equal(auth.sessionValid(session),false);assert.equal(auth.readSession(reqFor(raw)),null);
});

test('logout revokes only the selected tab session and preserves the other session',async()=>{
 let timestamp=2_000_000_000_000;const revoked=[],auth=createLocalAuth({env:{AUTH_SESSION_SECRET:secret,AUTH_ALLOW_LOCAL_BETA:'true'},now:()=>timestamp,onLogout:session=>revoked.push(session.sid)});
 const make=async()=>{const req={method:'POST',headers:{cookie:''},[Symbol.asyncIterator]:async function*(){yield Buffer.from('legacyPlayerId=alpha');}},res=response();await auth.handle(req,res,new URL('http://localhost/api/auth/dev'));return /pv_session=([^;]+)/.exec(res.headers['Set-Cookie'])[1];};
 const first=await make(),second=await make(),a=auth.readSession(reqFor(first)),b=auth.readSession(reqFor(second));assert.notEqual(a.sid,b.sid);
 const logout=response();await auth.handle({...reqFor(first),method:'POST'},logout,new URL('http://localhost/api/auth/logout'));
 assert.equal(auth.sessionValid(a),false);assert.equal(auth.sessionValid(b),true);assert.deepEqual(revoked,[a.sid]);assert.equal(logout.status,303);
});

test('signed payload rejects wrong providers, cross-account room mappings, and accepts older valid cookie IDs',async()=>{
 const timestamp=2_000_000_000_000,auth=createLocalAuth({env:{AUTH_SESSION_SECRET:secret},now:()=>timestamp}),exp=Math.floor(timestamp/1000)+3600;
 assert.equal(auth.readSession(reqFor(sign({...local('p'),provider:'evil',exp}))),null);
 assert.equal(auth.readSession(reqFor(sign({...local('p'),roomId:'aether-other',exp}))),null);
 assert.equal(auth.readSession(reqFor(sign({...local('p'),accountId:'dev:other',exp}))),null);
 assert.equal(auth.readSession(reqFor(sign({accountId:'invalid',playerId:'invalid',roomId:'invalid',provider:'google',exp}))),null);
 const older=sign({...local('a'.repeat(128)),exp}),valid=auth.readSession(reqFor(older));assert.ok(valid);assert.equal(valid.roomId.length,135);assert.equal(valid.sid,createHash('sha256').update(older).digest('base64url'));
 assert.equal(await auth.revokeSession(valid),true);assert.equal(auth.readSession(reqFor(older)),null);
});
