// Enforce the active storage facade at bootstrap instead of assuming every
// adapter has the same methods. Pure assertion: preserves provider identity,
// revisions and operation ordering (no proxy, clone, or alternate serialization).
const REQUIRED_METHODS=Object.freeze([
 'load','save','savePair','profile','listAccounts','getCampaign','registerCampaign','backup','restore'
]);
/**
 * @template {import('../types/runtime-contracts.d.ts').StoragePort} T
 * @param {T} adapter
 * @returns {T}
 */
export function assertStoragePort(adapter){
 if(!adapter||typeof adapter!=='object')throw new TypeError('STORAGE_PORT_INVALID');
 for(const method of REQUIRED_METHODS){
  if(typeof /** @type {Record<string,unknown>} */(adapter)[method]!=='function')throw new TypeError(`STORAGE_PORT_MISSING_METHOD:${method}`);
 }
 return adapter;
}
export {REQUIRED_METHODS};
