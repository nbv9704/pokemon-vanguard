const clone=value=>structuredClone(value);

// This is deliberately an allowlist. New save-root fields stay server-private
// until they are reviewed and intentionally added here.
export const LEGACY_PUBLIC_FIELDS=Object.freeze([
 'version','schemaVersion','revision','coins','gems','recruitmentTickets','pity',
 'summons','wins','badges','collection','team','mail','battle','reveal','notice',
 'migrationReceipt','tutorialV2','catalog','items','types','colors','typeChart'
]);

export function legacyAdventurePublicView(source){
 const result={};
 for(const key of LEGACY_PUBLIC_FIELDS)if(Object.hasOwn(source||{},key))result[key]=clone(source[key]);
 return result;
}
