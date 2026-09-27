// In-memory match command retry validation. Durable settlement identity is
// recorded separately in both account saves (ranked-settlement-receipts).
import {createHash} from 'node:crypto';
export const validRankedActionId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function rankedActionFingerprint(accountId,action){const {actionId:_id,...payload}=action;return createHash('sha256').update(JSON.stringify(canonical({accountId,payload}))).digest('hex');}
