import test from 'node:test';
import assert from 'node:assert/strict';
import {findAppendOnlyBy} from '../server/append-only-index.mjs';

test('append-only index preserves first-match semantics and sees appended receipts',()=>{
 const first={actionId:'same',value:1},list=[first,{actionId:'other',value:2},{actionId:'same',value:3}];
 assert.equal(findAppendOnlyBy(list,'actionId','same'),first);
 assert.equal(findAppendOnlyBy(list,'actionId','missing'),null);
 const appended={actionId:'new',value:4};list.push(appended);
 assert.equal(findAppendOnlyBy(list,'actionId','new'),appended);
 assert.equal(findAppendOnlyBy(list,'actionId','same'),first);
});

test('append-only index rebuilds after array replacement, truncation or tail replacement',()=>{
 let list=[{receiptId:'a'},{receiptId:'b'}];
 assert.equal(findAppendOnlyBy(list,'receiptId','b'),list[1]);
 list=list.map(entry=>({...entry}));
 assert.equal(findAppendOnlyBy(list,'receiptId','b'),list[1]);
 list.pop();
 assert.equal(findAppendOnlyBy(list,'receiptId','b'),null);
 list[0]={receiptId:'c'};
 assert.equal(findAppendOnlyBy(list,'receiptId','a'),null);
 assert.equal(findAppendOnlyBy(list,'receiptId','c'),list[0]);
});

test('append-only index handles absent and empty receipt arrays',()=>{
 assert.equal(findAppendOnlyBy(undefined,'actionId','a'),null);
 assert.equal(findAppendOnlyBy([],'actionId','a'),null);
});

test('large append-only receipt arrays keep indexed lookups current',()=>{
 const list=Array.from({length:300},(_,index)=>({actionId:`id:${index}`}));
 assert.equal(findAppendOnlyBy(list,'actionId','id:299'),list[299]);
 list.push({actionId:'id:300'});
 assert.equal(findAppendOnlyBy(list,'actionId','id:300'),list[300]);
});
