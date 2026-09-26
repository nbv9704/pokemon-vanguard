import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const SESSION_COOKIE='pv_session',FLOW_COOKIE='pv_supabase_flow',SESSION_AGE=60*60*24*7,FLOW_AGE=10*60;
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url').toString('utf8');
const clean=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,160);
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(part=>part.trim().split(/=(.*)/s)).filter(parts=>parts[0]).map(([key,value])=>[key,value||'']));
const cookie=(name,value,{maxAge,path='/',secure=false}={})=>`${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax${Number.isInteger(maxAge)?`; Max-Age=${maxAge}`:''}${secure?'; Secure':''}`;
const sign=(payload,secret)=>createHmac('sha256',secret).update(payload).digest('base64url');
const safeEqual=(left,right)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);};
const signed=(value,secret)=>{const payload=b64(JSON.stringify(value));return `${payload}.${sign(payload,secret)}`;};
const readSigned=(value,secret)=>{try{const [payload,signature]=String(value||'').split('.');if(!payload||!signature||!safeEqual(sign(payload,secret),signature))return null;return JSON.parse(unb64(payload));}catch{return null;}};
const sha256url=value=>createHash('sha256').update(value).digest('base64url');
const validUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||'');
const apiKeyHeaders=key=>({apikey:key,...(String(key).startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})});

export function createLocalAuth({env=process.env,fetchImpl=fetch}={}){
 const secret=env.AUTH_SESSION_SECRET||'pokemon-vanguard-local-beta-session-secret';
 const supabaseUrl=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const publishableKey=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'';
 const serviceKey=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'';
 const supabaseConfigured=!!(supabaseUrl&&publishableKey);
 const cloudSaveConfigured=!!(supabaseConfigured&&serviceKey);
 const devLogin=env.AUTH_ALLOW_LOCAL_BETA==='true';
 const adminIds=new Set(String(env.ADMIN_ACCOUNT_IDS||'').split(',').map(value=>value.trim()).filter(Boolean));
 const allowLocalAdmin=env.ADMIN_ALLOW_LOCAL_BETA==='true';
 const isAdmin=session=>!!session&&(adminIds.has(session.accountId)||(allowLocalAdmin&&session.provider==='local'));
 const issueSession=profile=>signed({...profile,exp:Math.floor(Date.now()/1000)+SESSION_AGE},secret);
 const readSession=req=>{const session=readSigned(cookies(req)[SESSION_COOKIE],secret);if(!session||!Number.isInteger(session.exp)||session.exp<=Date.now()/1000||!session.accountId||!session.playerId||!session.roomId)return null;return session;};
 const json=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));};
 const redirect=(res,location,setCookie)=>{res.writeHead(303,{Location:location,'Cache-Control':'no-store',...(setCookie?{'Set-Cookie':setCookie}:{})});res.end();};
 const secure=url=>url.protocol==='https:';
 async function syncProfile(user,profile){
  if(!serviceKey)return;
  const response=await fetchImpl(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`,{method:'POST',headers:{...apiKeyHeaders(serviceKey),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,display_name:profile.name,avatar_url:profile.avatar,updated_at:new Date().toISOString()})});
  if(!response.ok){const error=new Error('profile sync failed');error.authCode=response.status===404?'storage_not_ready':'profile_sync_failed';throw error;}
 }
 async function handle(req,res,url){
  if(url.pathname==='/api/auth/session'){
   const session=readSession(req);json(res,200,{authenticated:!!session,user:session?{accountId:session.accountId,playerId:session.playerId,roomId:session.roomId,name:session.name,avatar:session.avatar,provider:session.provider,admin:isAdmin(session)}:null,providers:{google:cloudSaveConfigured,discord:cloudSaveConfigured},devLogin,supabaseConfigured,cloudSaveConfigured});return true;
  }
  if(url.pathname==='/api/auth/logout'&&req.method==='POST'){redirect(res,'/',cookie(SESSION_COOKIE,'',{maxAge:0,secure:secure(url)}));return true;}
  if(url.pathname==='/api/auth/dev'&&req.method==='POST'&&devLogin){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)break;}const legacy=new URLSearchParams(body).get('legacyPlayerId'),valid=/^[A-Za-z0-9_-]{1,128}$/.test(legacy||'');
   const playerId=valid?legacy:`local-${randomBytes(12).toString('hex')}`,roomId=valid?`aether-${legacy}`:`aether-${playerId}`,session={accountId:`dev:${playerId}`,playerId,roomId,name:'Local Beta Tester',avatar:null,provider:'local'};
   redirect(res,'/',cookie(SESSION_COOKIE,issueSession(session),{maxAge:SESSION_AGE,secure:secure(url)}));return true;
  }
  const start=/^\/api\/auth\/(google|discord)\/start$/.exec(url.pathname);
  if(start){
   if(!cloudSaveConfigured){json(res,503,{error:'Supabase account storage is not configured'});return true;}
   const provider=start[1],verifier=randomBytes(48).toString('base64url'),callback=`${url.origin}/auth/callback`,target=new URL(`${supabaseUrl}/auth/v1/authorize`);
   target.search=new URLSearchParams({provider,redirect_to:callback,code_challenge:sha256url(verifier),code_challenge_method:'s256'}).toString();
   const flow=signed({provider,verifier,exp:Math.floor(Date.now()/1000)+FLOW_AGE},secret);
   redirect(res,target.toString(),cookie(FLOW_COOKIE,flow,{maxAge:FLOW_AGE,path:'/auth/callback',secure:secure(url)}));return true;
  }
  if(url.pathname==='/auth/callback'){
   const flow=readSigned(cookies(req)[FLOW_COOKIE],secret),code=url.searchParams.get('code');
   if(!flow||!['google','discord'].includes(flow.provider)||!flow.verifier||flow.exp<=Date.now()/1000||!code){redirect(res,'/?auth_error=invalid_oauth_response',cookie(FLOW_COOKIE,'',{maxAge:0,path:'/auth/callback',secure:secure(url)}));return true;}
   try{
    const tokenResponse=await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=pkce`,{method:'POST',headers:{...apiKeyHeaders(publishableKey),'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:flow.verifier})});
    if(!tokenResponse.ok)throw new Error('Supabase code exchange failed');
    const token=await tokenResponse.json(),user=token.user;if(!validUuid(user?.id))throw new Error('Invalid Supabase user');
    const meta=user.user_metadata||{},identity=user.identities?.find(item=>item.provider===flow.provider),identityData=identity?.identity_data||{};
    const name=clean(meta.full_name||meta.name||meta.user_name||identityData.full_name||identityData.name||identityData.user_name||user.email?.split('@')[0]||'Vanguard Trainer');
    const avatar=clean(meta.avatar_url||meta.picture||identityData.avatar_url||identityData.picture)||null;
    const session={accountId:user.id,playerId:user.id,roomId:user.id,name,avatar,provider:flow.provider};
    await syncProfile(user,session);
    res.writeHead(303,{Location:'/', 'Cache-Control':'no-store','Set-Cookie':[cookie(SESSION_COOKIE,issueSession(session),{maxAge:SESSION_AGE,secure:secure(url)}),cookie(FLOW_COOKIE,'',{maxAge:0,path:'/auth/callback',secure:secure(url)})]});res.end();
   }catch(error){redirect(res,`/?auth_error=${encodeURIComponent(error.authCode||'oauth_failed')}`,cookie(FLOW_COOKIE,'',{maxAge:0,path:'/auth/callback',secure:secure(url)}));}
   return true;
  }
  return false;
 }
 return {handle,readSession,isAdmin};
}
