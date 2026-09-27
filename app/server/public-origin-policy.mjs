import {isIP} from 'node:net';

const normalizeIp=value=>String(value||'').trim().replace(/^::ffff:/i,'');

function configuredOrigin(value){
 if(!value)return null;
 let url;
 try{url=new URL(value);}catch{throw new Error('PUBLIC_ORIGIN must be a valid absolute URL');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('PUBLIC_ORIGIN must contain only an http(s) origin (scheme, host, and optional port)');
 return url.origin;
}

function trustedProxyIps(value){
 const entries=String(value||'').split(',').map(normalizeIp).filter(Boolean);
 for(const entry of entries)if(!isIP(entry))throw new Error(`PV_TRUSTED_PROXY_IPS contains an invalid IP address: ${entry}`);
 return new Set(entries);
}

export function createPublicOriginPolicy({env=process.env}={}){
 const publicOrigin=configuredOrigin(String(env.PUBLIC_ORIGIN||'').trim());
 const trustedProxies=trustedProxyIps(env.PV_TRUSTED_PROXY_IPS);
 const transportIp=req=>normalizeIp(req.socket?.remoteAddress)||'unknown';
 const trusts=req=>trustedProxies.has(transportIp(req));
 const requestUrl=req=>{
  const base=publicOrigin||`http://${req.headers.host||'localhost'}`;
  const incoming=new URL(req.url,'http://request.invalid');
  return new URL(`${incoming.pathname}${incoming.search}`,base);
 };
 const expectedOrigin=(req,url=requestUrl(req))=>publicOrigin||url.origin;
 const originAllowed=(req,url=requestUrl(req),{allowMissing=true}={})=>{
  const raw=req.headers.origin;
  if(!raw)return allowMissing;
  try{const parsed=new URL(raw);return parsed.href===`${parsed.origin}/`&&parsed.origin===expectedOrigin(req,url);}catch{return false;}
 };
 const browserMutationAllowed=(req,url=requestUrl(req))=>{
  const site=String(req.headers['sec-fetch-site']||'').toLowerCase();
  if(site==='cross-site')return false;
  return originAllowed(req,url,{allowMissing:true});
 };
 const clientIp=req=>{
  if(!trusts(req))return transportIp(req);
  const first=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return isIP(normalizeIp(first))?normalizeIp(first):transportIp(req);
 };
 return {publicOrigin,requestUrl,expectedOrigin,originAllowed,browserMutationAllowed,clientIp,isTrustedProxy:trusts};
}
