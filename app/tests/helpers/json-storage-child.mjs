import {JsonAdventureStorage} from '../../server/storage-json.mjs';

const [mode,directory,left,right,operation]=process.argv.slice(2);
const state=(owner,coins)=>({schemaVersion:3,owner,revision:1,wallet:{coins,crystals:0,recruitmentTickets:0}});
class CrashAfterFirstWrite extends JsonAdventureStorage{
 constructor(dir,options){super(dir,options);this.writes=0;}
 async writeState(room,text){this.writes++;if(this.writes===2)process.exit(91);return super.writeState(room,text);}
}
const Storage=mode==='crash'?CrashAfterFirstWrite:JsonAdventureStorage,storage=new Storage(directory,{staleLockMs:150,lockTimeoutMs:5000});
await storage.savePair([{userId:left,state:state(left,110)},{userId:right,state:state(right,90)}],operation);
