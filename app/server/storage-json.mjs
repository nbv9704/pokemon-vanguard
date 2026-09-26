import {readFile,writeFile,mkdir,rename,copyFile,access,readdir} from 'node:fs/promises';
import path from 'node:path';

const ROOM=/^[A-Za-z0-9_-]{1,64}$/;
export class JsonAdventureStorage{
 constructor(saveDir){this.saveDir=path.resolve(saveDir);}
 pathFor(room){if(!ROOM.test(room))throw new Error('Invalid adventure room name');return path.join(this.saveDir,room+'.json');}
 async load(room){
  try{return JSON.parse(await readFile(this.pathFor(room),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
 }
 async save(room,state){
  const target=this.pathFor(room),temporary=target+'.tmp';
  const encoded=JSON.stringify(state);JSON.parse(encoded);
  await mkdir(this.saveDir,{recursive:true});
  await writeFile(temporary,encoded,'utf8');
  JSON.parse(await readFile(temporary,'utf8'));
  await rename(temporary,target);
 }

 async profile(room){const state=await this.load(room);return state?{userId:room,displayName:state.owner||room,avatarUrl:null,createdAt:null,updatedAt:null}:null;}
 async listAccounts({search='',limit=50,offset=0}={}){
  let names=[];try{names=(await readdir(this.saveDir)).filter(name=>name.endsWith('.json')&&!name.endsWith('.tmp')).map(name=>name.slice(0,-5));}catch(error){if(error.code!=='ENOENT')throw error;}
  const query=String(search||'').trim().toLowerCase();if(query)names=names.filter(name=>name.toLowerCase().includes(query));names.sort();
  const total=names.length,selected=names.slice(Math.max(0,offset),Math.max(0,offset)+Math.min(100,Math.max(1,limit))),accounts=[];
  for(const userId of selected){const state=await this.load(userId);accounts.push({userId,displayName:state?.owner||userId,avatarUrl:null,createdAt:null,updatedAt:null,schemaVersion:state?.schemaVersion||null,revision:state?.revision||0,state});}
  return {total,accounts};
 }
 async backup(room,backupDir,label){
  const source=this.pathFor(room);JSON.parse(await readFile(source,'utf8'));
  const safeLabel=String(label).replace(/[^A-Za-z0-9_-]/g,'-');
  if(!safeLabel)throw new Error('Backup label is required');
  const destination=path.join(path.resolve(backupDir),room+'.'+safeLabel+'.json');
  await mkdir(path.dirname(destination),{recursive:true});await copyFile(source,destination);
  JSON.parse(await readFile(destination,'utf8'));return destination;
 }
 async restore(room,backupFile){
  const source=path.resolve(backupFile),target=this.pathFor(room);
  if(source===target)throw new Error('Restore source must be a separate backup file');
  const state=JSON.parse(await readFile(source,'utf8'));
  await access(source);await this.save(room,state);return state;
 }
}

