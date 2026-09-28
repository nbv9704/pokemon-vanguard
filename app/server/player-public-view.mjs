/** @template T @param {T} value @returns {T} */
const clone=value=>structuredClone(value);

// This is deliberately an allowlist. New save-root fields stay server-private
// until they are reviewed and intentionally added here.
export const LEGACY_PUBLIC_FIELDS=Object.freeze([
 'version','schemaVersion','revision','coins','gems','recruitmentTickets','pity',
 'summons','wins','badges','collection','team','mail','battle','reveal','notice',
 'migrationReceipt','tutorialV2','catalog','items','types','colors','typeChart'
]);

/**
 * @param {Record<string,unknown>|null|undefined} source
 * @returns {Record<string,unknown>}
 */
export function legacyAdventurePublicView(source){
 /** @type {Record<string,unknown>} */
 const result={};
 for(const key of LEGACY_PUBLIC_FIELDS)if(source&&Object.hasOwn(source,key))result[key]=clone(source[key]);
 return result;
}
