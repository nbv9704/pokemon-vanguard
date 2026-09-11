import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEconomyConfig, validateV2Catalog } from './validate-v2-catalog.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semver = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/;

const expected = {
  types: ['Flame','Tide','Bloom','Volt','Frost','Stone','Gale','Shadow','Light','Venom','Steel','Astral'],
  stats: ['hp','atk','def','spa','spd','spe'],
  moveCategories: ['physical','special','status'],
  targetModes: ['self','ally','foe','allFoes','ownSide','field'],
  effectKinds: ['applyStatus','changeStage','heal','guard','setWeather','setTerrain','setSideCondition','redirect'],
  effectTimings: ['onUse','afterDamage'],
  effectTargets: ['self','hitTarget','ally','ownSide','field'],
  statuses: ['burn','poison','slow','sleep'],
  weather: ['sun','rain','snow','sand'],
  terrain: ['meadow','storm'],
  sideConditions: ['tailwind','barrier']
};

function unique(values) {
  return Array.isArray(values) && new Set(values).size === values.length;
}

function exactMembers(actual, wanted) {
  return unique(actual) && actual.length === wanted.length && wanted.every(value => actual.includes(value));
}

export function validateContent(contract, species) {
  const problems = [];
  const fail = message => problems.push(message);

  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) fail('catalog-contract.json must contain an object');
  if (!Number.isInteger(contract?.schemaVersion) || contract.schemaVersion < 1) fail('schemaVersion must be an integer >= 1');
  if (typeof contract?.catalogVersion !== 'string' || !semver.test(contract.catalogVersion)) fail('catalogVersion must use semantic version syntax');
  for (const [key, values] of Object.entries(expected)) {
    if (!exactMembers(contract?.[key], values)) fail(`${key} must contain each supported value exactly once`);
  }

  if (!Array.isArray(species) || species.length !== 36) {
    fail('species-identities.json must contain exactly 36 species');
    return problems;
  }

  const ids = new Set(), legacyIds = new Set(), artIds = new Set();
  let singleTypes = 0;
  for (const [index, mon] of species.entries()) {
    const where = `species[${index}]`;
    if (!mon || typeof mon !== 'object' || Array.isArray(mon)) { fail(`${where} must be an object`); continue; }
    const keys = Object.keys(mon).sort();
    const allowed = ['artId','coverageType','id','legacyId','name','types'].sort();
    if (keys.join('|') !== allowed.join('|')) fail(`${where} must contain only the identity contract fields`);
    if (typeof mon.id !== 'string' || !slug.test(mon.id)) fail(`${where}.id must be a stable lowercase slug`);
    else if (ids.has(mon.id)) fail(`duplicate species id: ${mon.id}`); else ids.add(mon.id);
    if (!Number.isInteger(mon.legacyId) || mon.legacyId < 0 || mon.legacyId > 35) fail(`${where}.legacyId must be 0..35`);
    else if (legacyIds.has(mon.legacyId)) fail(`duplicate legacyId: ${mon.legacyId}`); else legacyIds.add(mon.legacyId);
    if (!Number.isInteger(mon.artId) || mon.artId < 0 || mon.artId > 35) fail(`${where}.artId must be 0..35`);
    else if (artIds.has(mon.artId)) fail(`duplicate artId: ${mon.artId}`); else artIds.add(mon.artId);
    if (typeof mon.name !== 'string' || !mon.name.trim() || mon.name.length > 40) fail(`${where}.name must contain 1..40 characters`);
    if (!Array.isArray(mon.types) || mon.types.length < 1 || mon.types.length > 2 || !unique(mon.types)) {
      fail(`${where}.types must contain one or two different types`);
    } else {
      if (mon.types.length === 1) singleTypes++;
      for (const type of mon.types) if (!expected.types.includes(type)) fail(`${where}.types contains unsupported type: ${type}`);
    }
    if (!expected.types.includes(mon.coverageType)) fail(`${where}.coverageType is unsupported`);
  }
  if (singleTypes !== 12) fail(`expected 12 single-type species, found ${singleTypes}`);
  for (let id=0; id<36; id++) {
    if (!legacyIds.has(id)) fail(`missing legacyId: ${id}`);
    if (!artIds.has(id)) fail(`missing artId: ${id}`);
  }
  return problems;
}

export function validateTacticalContent(regulations,aiTeams,species){
 const problems=[],ids=new Set(species.map(mon=>mon.id)),required=['sandbox-v2','alpha-single','alpha-double'];
 if(!Array.isArray(regulations)||regulations.length!==3||required.some(id=>!regulations.some(rule=>rule.id===id)))problems.push('regulations.json must define sandbox-v2, alpha-single and alpha-double exactly once');
 for(const rule of regulations||[])if(!rule.name||typeof rule.speciesClause!=='boolean'||typeof rule.itemClause!=='boolean'||!rule.roster||!rule.pick||!rule.lead)problems.push(`invalid regulation: ${rule?.id||'unknown'}`);
 if(aiTeams?.schemaVersion!==1||!Array.isArray(aiTeams?.exhibition)||aiTeams.exhibition.length!==12)problems.push('ai-teams.json must define 12 exhibition teams');
 for(const format of ['single','double'])if(!Array.isArray(aiTeams?.gyms?.[format])||aiTeams.gyms[format].length!==6)problems.push(`ai-teams.json must define six ${format} gym teams`);
 const teams=[...(aiTeams?.exhibition||[]),...(aiTeams?.gyms?.single||[]),...(aiTeams?.gyms?.double||[])];
 for(const team of teams)if(!team.id||!['easy','normal','hard'].includes(team.difficulty)||!Array.isArray(team.speciesIds)||team.speciesIds.length!==6||new Set(team.speciesIds).size!==6||team.speciesIds.some(id=>!ids.has(id)))problems.push(`invalid AI team: ${team?.id||'unknown'}`);
 return problems;
}

async function loadJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error(`${path.basename(file)} is not valid JSON: ${error.message}`); }
}

export async function checkContent(root = appRoot) {
  const contentDir = path.join(root, 'content');
  const contract = await loadJson(path.join(contentDir, 'catalog-contract.json'));
  const species = await loadJson(path.join(contentDir, 'species-identities.json'));
  const authoredSpecies = await loadJson(path.join(contentDir, 'species.json'));
  const moves = await loadJson(path.join(contentDir, 'moves.json'));
  const abilities = await loadJson(path.join(contentDir, 'abilities.json'));
  const items = await loadJson(path.join(contentDir, 'items.json'));
  const regulations=await loadJson(path.join(contentDir,'regulations.json'));
  const aiTeams=await loadJson(path.join(contentDir,'ai-teams.json'));
  const economy=await loadJson(path.join(contentDir,'economy.json'));
  await loadJson(path.join(contentDir, 'schemas', 'catalog.schema.json'));
  await loadJson(path.join(contentDir, 'schemas', 'species-identity.schema.json'));
  const problems = validateContent(contract, species);
  problems.push(...validateV2Catalog({contract,identities:species,species:authoredSpecies,moves,abilities,items}));
  problems.push(...validateTacticalContent(regulations,aiTeams,species));
  problems.push(...validateEconomyConfig(economy,authoredSpecies));
  for (const mon of species) {
    try { await access(path.join(root, 'public', 'monsters', `${mon.artId}.svg`)); }
    catch { problems.push(`missing monster art for ${mon.id}: public/monsters/${mon.artId}.svg`); }
  }
  if (problems.length) throw new Error(`Content validation failed:\n${problems.map(p => `  • ${p}`).join('\n')}`);
  return { species: species.length, singleType: species.filter(mon => mon.types.length === 1).length, types: contract.types.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkContent();
    console.log(`content OK — ${result.species} species (${result.singleType} single-type), ${result.types} types`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
