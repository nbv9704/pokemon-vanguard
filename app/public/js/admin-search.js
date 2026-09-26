export const normalizeAdminSearch=value=>String(value??'')
 .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export const adminItemSearchText=item=>normalizeAdminSearch([
 item?.name,item?.id,item?.category,item?.source,item?.sourceLabel,
 item?.owned?'ownership:owned':'ownership:not-owned',
 item?.inUse?'usage:equipped':'usage:not-equipped',
 item?.beginning?'source:beginning':'',
].filter(Boolean).join(' '));

export const adminPokemonSearchText=mon=>normalizeAdminSearch([
 mon?.name,mon?.id,...(mon?.types||[]),mon?.monId,mon?.buildId,
 mon?.inTeam?'usage:in-team':'',
 mon?.owned?'ownership:owned':`ownership:${mon?.ownership||'not-owned'}`,
].filter(Boolean).join(' '));

export function adminSearchMatch(searchText,query){
 const haystack=normalizeAdminSearch(searchText),needle=normalizeAdminSearch(query);
 if(!needle)return true;
 if(needle==='owned')return haystack.includes('ownership:owned');
 if(needle==='not owned'||needle==='unowned'||needle==='locked')return haystack.includes('ownership:not-owned');
 if(needle==='equipped'||needle==='in use')return haystack.includes('usage:equipped');
 if(needle==='not equipped')return haystack.includes('usage:not-equipped');
 if(needle==='in team')return haystack.includes('usage:in-team');
 return needle.split(/\s+/).every(token=>haystack.includes(token));
}
