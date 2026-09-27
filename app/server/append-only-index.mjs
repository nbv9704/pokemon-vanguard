// Derived indexes for persisted append-only arrays. The WeakMap is process-local
// and is never serialized. Receipt keys are immutable; appends update the index
// incrementally, while replacement/truncation rebuilds from authoritative data.
const indexes=new WeakMap();
export const APPEND_ONLY_INDEX_MIN=256;

function cacheFor(list,key){
 let keyed=indexes.get(list);if(!keyed){keyed=new Map();indexes.set(list,keyed);}
 let cache=keyed.get(key);
 const canExtend=cache&&list.length>=cache.length&&(!cache.length||(list[0]===cache.first&&list[cache.length-1]===cache.last));
 if(!canExtend){cache={length:0,first:list[0],last:undefined,values:new Map()};keyed.set(key,cache);}
 for(let index=cache.length;index<list.length;index++){const entry=list[index],value=entry?.[key];if(value!==undefined&&!cache.values.has(value))cache.values.set(value,entry);}
 cache.length=list.length;cache.first=list[0];cache.last=list.at(-1);
 return cache;
}

export function findAppendOnlyBy(list,key,value){
 if(!Array.isArray(list)||!list.length)return null;
 if(list.length<APPEND_ONLY_INDEX_MIN)return list.find(entry=>entry?.[key]===value)||null;
 return cacheFor(list,key).values.get(value)||null;
}
