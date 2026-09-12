const requiredChecks=['speciesFormsTypesStats','learnsetRelations','abilityRelations','itemAvailability','singleDoubleCoverage','speciesClause','itemClause'];

export function validateBetaReview(review,slice,fetchManifest){
 const problems=[];
 if(review?.schemaVersion!==1)problems.push('unsupported beta review schemaVersion');
 for(const [reviewKey,sliceKey] of [['sliceId','id'],['snapshotId','snapshotId'],['regulationSet','regulationSet']])if(review?.[reviewKey]!==slice?.[sliceKey])problems.push(`review ${reviewKey} does not match slice`);
 if(review?.status!=='approved-for-beta')problems.push('beta review is not approved');
 if(typeof review?.reviewer!=='string'||!review.reviewer.trim())problems.push('beta review requires a reviewer');
 if(!Number.isFinite(Date.parse(review?.reviewedAt)))problems.push('beta review requires a valid reviewedAt');
 const sourceByKey=new Map((fetchManifest?.sources||[]).map(source=>[source.key,source]));
 for(const key of ['pokemon','moves','abilities','items'])if(review?.sourceHashes?.[key]!==sourceByKey.get(key)?.sha256)problems.push(`review source hash mismatch for ${key}`);
 for(const key of requiredChecks)if(review?.checks?.[key]!=='pass')problems.push(`review check ${key} has not passed`);
 const expected=(slice?.team||[]).map(member=>`https://pokebase.app/pokemon-champions/pokemon/${member.speciesId}`).sort(),actual=[...(review?.speciesDetailUrls||[])].sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected))problems.push('review species detail URLs do not match the beta slice');
 return problems;
}
