import test from 'node:test';
import assert from 'node:assert/strict';
import {adminGiftView} from '../server/admin-gifts.mjs';
import {systemMailboxView} from '../server/mailbox-v1.mjs';
import {missionView} from '../server/missions.mjs';
import {rankedProfileView} from '../server/ranked-v1.mjs';
import {SocialService} from '../server/social-v1.mjs';
import {ticketBagView} from '../server/ticket-bag.mjs';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

test('read projections do not normalize or mutate their input save',()=>{
 const state=freeze({schemaVersion:3,seed:7,owner:'projection-test',wallet:{coins:10,crystals:2,recruitmentTickets:1},progressionV3:{ownedItemIds:[]}}),now=Date.UTC(2026,8,26);
 assert.doesNotThrow(()=>rankedProfileView(state));assert.doesNotThrow(()=>missionView(state,now));assert.doesNotThrow(()=>ticketBagView(state,v3Catalog));assert.doesNotThrow(()=>adminGiftView(state,v3Catalog,{now}));assert.doesNotThrow(()=>systemMailboxView(state,v2Catalog,{now}));assert.doesNotThrow(()=>new SocialService().viewFor('11111111-1111-4111-8111-111111111111',state));
 assert.deepEqual(Object.keys(state).sort(),['owner','progressionV3','schemaVersion','seed','wallet']);
});
