const SCRIPT_PATTERN=/<script[^>]*>([\s\S]*?)<\/script>/gi;
const PUSH_PATTERN=/^\s*self\.__next_f\.push\(([\s\S]*)\)\s*$/;
const ROW_PATTERN=/(?:^|\n)([0-9a-f]+):(?=[[{])/gi;

function readJsonValue(text,start){
 const opener=text[start],closer=opener==='['?']':'}';
 let depth=0,inString=false,escaped=false;
 for(let index=start;index<text.length;index++){
  const char=text[index];
  if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue;}
  if(char==='"'){inString=true;continue;}
  if(char===opener)depth++;
  if(char===closer&&--depth===0)return JSON.parse(text.slice(start,index+1));
 }
 throw new Error(`unterminated RSC JSON value at offset ${start}`);
}

export function parseRscRows(html){
 const rows=new Map();
 for(const script of html.matchAll(SCRIPT_PATTERN)){
  const match=PUSH_PATTERN.exec(script[1]);
  if(!match)continue;
  const push=JSON.parse(match[1]);
  if(push[0]!==1||typeof push[1]!=='string')continue;
  const payload=push[1];
  for(const rowMatch of payload.matchAll(ROW_PATTERN)){
   const start=rowMatch.index+rowMatch[0].length;
   rows.set(rowMatch[1],readJsonValue(payload,start));
  }
 }
 if(!rows.size)throw new Error('no JSON RSC rows found');
 return rows;
}

export function componentProps(row){
 return Array.isArray(row)&&row.length>=4&&row[3]&&typeof row[3]==='object'?row[3]:null;
}

export function resolveRscReference(value,rows){
 if(typeof value!=='string'||!/^\$[0-9a-f]+:/i.test(value))return value;
 const [rowId,...segments]=value.slice(1).split(':');
 let current=rows.get(rowId);
 if(current===undefined)return undefined;
 for(const segment of segments){
  if(segment==='props'&&Array.isArray(current))current=current[3];
  else if(Array.isArray(current)&&/^\d+$/.test(segment))current=current[Number(segment)];
  else if(current&&typeof current==='object')current=current[segment];
  else return undefined;
  if(current===undefined)return undefined;
 }
 return current;
}

export function findProps(rows,predicate){
 for(const row of rows.values()){
  const props=componentProps(row);
  if(props&&predicate(props))return props;
 }
 throw new Error('expected RSC component props were not found');
}

export function extractDocs(html){
 const rows=parseRscRows(html);
 const props=findProps(rows,value=>Array.isArray(value.data?.docs));
 return {docs:props.data.docs,meta:props.data,props,rows};
}

export function extractRosterRanch(html){
 const rows=parseRscRows(html);
 const props=findProps(rows,value=>Array.isArray(value.rosterSummaries));
 return {rosters:props.rosterSummaries,defaultRosterId:props.defaultRosterId,rows};
}
