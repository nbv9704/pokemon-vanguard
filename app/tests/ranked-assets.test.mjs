import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RANKED_TIERS,rankedTierView} from '../server/ranked-tiers.mjs';

test('all five Ranked tier assets are checked in and projected from authoritative tier metadata',async()=>{
 assert.deepEqual(RANKED_TIERS.map(tier=>tier.id),['pokeball','greatball','ultraball','masterball','challenger']);
 assert.deepEqual(RANKED_TIERS.map(tier=>tier.minRating),[0,1200,1600,2000,2400]);
 for(const tier of RANKED_TIERS){
  const bytes=await readFile(new URL(`../public${tier.asset}`,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',tier.id);
  assert.equal(rankedTierView(tier.minRating).tierAsset,tier.asset);
 }
});
