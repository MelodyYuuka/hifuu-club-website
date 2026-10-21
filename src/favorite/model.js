
import { characters, games, CATALOG_VERSION } from './characters.js';
import { FavoriteSorter, comparisonBound } from './sorter.js';
import { legacyWorksV3 } from './catalog-v3.js';
import { validPresetIds, selectedWorkPresetIds, applyWorkPresets } from './presets.js';

export const STORAGE_KEY = 'hifuu.favorite.v1';
export const characterById = new Map(characters.map(character => [character.id, character]));
const gameIds = new Set(games.map(game => game.id));
const preHouraiGameIds = new Set(games.filter(game => game.id !== 'hr01').map(game => game.id));
const coarseWorkIds = new Set([...games.filter(game => ['main','old'].includes(game.group)).map(game => game.id), 'A', 'B', 'D', 'E']);
const splitWorkIds = {
  A: games.filter(game => game.family === 'fighting').map(game => game.id),
  B: games.filter(game => game.family === 'stg').map(game => game.id),
};
const expandCoarseWorks = ids => [...new Set(ids.flatMap(id => splitWorkIds[id] || [id]))];
const sameSet = (left, right) => left.length === right.length && left.every(id => right.includes(id));
const version3GameIds = new Set([...games.filter(game => ['main','old'].includes(game.group)).map(game => game.id), ...Object.keys(legacyWorksV3)]);
const validChoices = new Set(['left', 'right', 'tie']);
export function defaultSettings() {
  return { games: games.filter(game => game.group !== 'old').map(game => game.id), excluded: [], included: [], limit: 10, showImages: true, presetIds: [] };
}
export function candidateIds(settings, includeExcluded = false) {
  const selected = new Set(settings.games);
  const excluded = new Set(includeExcluded ? [] : settings.excluded);
  const included = new Set(settings.included || []);
  return characters.filter(character => (included.has(character.id) || character.games.some(game => selected.has(game)))
    && !excluded.has(character.id)).map(character => character.id);
}
/** The character picker always searches the entire catalog, independent of works. */
export function matchingCharacters(query = '') {
  const normalized = query.trim().toLocaleLowerCase();
  return characters.filter(character => [character.name, character.title, ...(character.aliases || [])].join(' ').toLocaleLowerCase().includes(normalized));
}

/** Individual choices add out-of-range characters without selecting their whole work. */
export function setCharactersSelected(settings, ids, selected) {
  const known = ids.filter(id => characterById.has(id));
  if (!known.length) return settings;
  const works = new Set(settings.games);
  const included = new Set(settings.included || []);
  const excluded = new Set(settings.excluded);
  for (const id of known) {
    if (selected) {
      excluded.delete(id);
      if (!characterById.get(id).games.some(game => works.has(game))) included.add(id);
    } else {
      included.delete(id);
      excluded.add(id);
    }
  }
  return { ...settings, included:[...included], excluded:[...excluded], presetIds:[] };
}

export function rankingLimit(settings, count) {
  return settings.limit === 'all' ? count : Math.min(settings.limit, count);
}
function validList(value, known) {
  return Array.isArray(value) && value.length <= known.size && new Set(value).size === value.length && value.every(item => known.has(item));
}
export function validateSettings(settings, allowedGames = gameIds) {
  return !!settings && validList(settings.games, allowedGames) && validList(settings.excluded, characterById)
    && (settings.included === undefined || (validList(settings.included, characterById)
      && !settings.included.some(id => settings.excluded.includes(id))))
    && [1, 10, 'all'].includes(settings.limit) && typeof settings.showImages === 'boolean'
    && (settings.presetIds === undefined || validPresetIds(settings.presetIds));
}
// Retain the v1 image fields for compatibility, but always enable portraits.
export function serializeSession(settings, sorter, startedAt) {
  return JSON.stringify({ version: 1, catalogVersion: CATALOG_VERSION, settings:{ ...settings, showImages:true }, run: sorter ? {
    ids: sorter.ids, limit: sorter.limit, decisions: sorter.decisions, startedAt, showImages:true,
  } : null });
}
/** Expand the two game buckets without widening saved candidate selections. */
function upgradeCatalogSettings(settings, catalogVersion) {
  let selected = [...settings.games];
  let excluded = [...settings.excluded];
  const previousDefault = [...'abcdefghijklmn', 'A', 'B', 'D', 'E'];
  const previousAll = [...previousDefault, ...'FGHIJ'];
  if (catalogVersion < 2 && !excluded.length && (sameSet(selected, previousDefault) || sameSet(selected, previousAll))) selected.push('o');
  if (catalogVersion === 3) {
    const originalAllowed = new Set(characters.filter(character => !excluded.includes(character.id)
      && selected.some(id => legacyWorksV3[id] ? legacyWorksV3[id].ids.includes(character.id) : character.games.includes(id)))
      .map(character => character.id));
    // Individual games remain individual. Only the former book/CD detail IDs merge.
    selected = [...new Set(selected.map(id => gameIds.has(id) ? id : legacyWorksV3[id].group))];
    excluded = [...new Set([...excluded, ...candidateIds({ games:selected, excluded:[] })
      .filter(id => !originalAllowed.has(id))])];
  } else if (catalogVersion < 5) {
    selected = expandCoarseWorks(selected);
  }
  if (catalogVersion === 4 && settings.presetIds?.length && !settings.included?.length) {
    const expected = applyWorkPresets(settings, settings.presetIds);
    const oldWorks = [...new Set(expected.games.filter(id => id !== 'hr01').map(id => legacyWorksV3[id]?.group || id))];
    const allowed = new Set(candidateIds(expected));
    const oldExcluded = candidateIds({ games:expandCoarseWorks(oldWorks), excluded:[] }).filter(id => !allowed.has(id));
    // Check the old combination before rebuilding it, so manual edits never become presets.
    // Hifuu now selects the precise game containing Sumireko rather than every fighting game.
    if (sameSet(settings.games, oldWorks) && sameSet(settings.excluded, oldExcluded)) return expected;
  }
  // An explicit old 'all' preset expands for the next test; custom selections remain exact.
  if (catalogVersion === 5 && settings.presetIds?.length && !settings.included?.length) {
    const expected = applyWorkPresets(settings, settings.presetIds);
    const oldWorks = expected.games.filter(id => id !== 'hr01');
    const oldExcluded = expected.excluded.filter(id => !['206','207'].includes(id));
    if (sameSet(settings.games, oldWorks) && sameSet(settings.excluded, oldExcluded)) return expected;
  }
  const upgraded = { ...settings, games:selected, excluded, included:[...(settings.included || [])], presetIds:catalogVersion >= 6 ? settings.presetIds || [] : [] };
  upgraded.presetIds = selectedWorkPresetIds(upgraded);
  return upgraded;
}

export function matchingWorks(group, query = '') {
  const normalized = query.trim().toLocaleLowerCase().replace(/\s/g, '');
  return games.filter(game => (!group || game.group === group)
    && (game.name + game.code).toLocaleLowerCase().replace(/\s/g, '').includes(normalized));
}

/** Bulk selection changes only the listed works; character exclusions stay intact. */
export function setWorksSelected(settings, ids, selected) {
  const current = new Set(settings.games);
  for (const id of ids) {
    if (!gameIds.has(id)) continue;
    if (selected) current.add(id); else current.delete(id);
  }
  return { ...settings, games: [...current], presetIds: [] };
}
/** Treat localStorage as untrusted input. Replaying a valid log also verifies its length. */
export function restoreSession(raw) {
  if (!raw) return { settings: defaultSettings(), sorter: null, startedAt: null, showImages: true };
  if (typeof raw !== 'string' || raw.length > 100000) throw new Error('Invalid saved test.');
  const value = JSON.parse(raw);
  if (!value || value.version !== 1) throw new Error('Invalid saved settings.');
  const catalogVersion = value.catalogVersion === undefined ? 1 : value.catalogVersion;
  if (!Number.isInteger(catalogVersion) || catalogVersion < 1 || catalogVersion > CATALOG_VERSION) throw new Error('Invalid catalog version.');
  if (!validateSettings(value.settings, catalogVersion === 3 ? version3GameIds : catalogVersion < 5 ? coarseWorkIds : catalogVersion === 5 ? preHouraiGameIds : gameIds)) throw new Error('Invalid saved settings.');
  const result = { settings:{ ...upgradeCatalogSettings(value.settings, catalogVersion), showImages:true }, sorter: null, startedAt: null, showImages:true };
  if (value.run !== null) {
    const run = value.run;
    if (!run || !validList(run.ids, characterById) || run.ids.length < 2 || !Number.isInteger(run.limit)
      || run.limit < 1 || run.limit > run.ids.length || !Array.isArray(run.decisions)
      || run.decisions.length > comparisonBound(run.ids.length, run.limit)
      || !run.decisions.every(choice => validChoices.has(choice))
      || !Number.isSafeInteger(run.startedAt) || run.startedAt <= 0 || typeof run.showImages !== 'boolean') {
      throw new Error('Invalid saved comparison log.');
    }
    result.sorter = new FavoriteSorter(run.ids, run.limit, run.decisions);
    result.startedAt = run.startedAt;
  }
  return result;
}
export function flattenRankings(rankings) {
  return rankings.flatMap(group => group.ids.map(id => ({ rank: group.rank, character: characterById.get(id) })));
}
export function resultText(rankings, pageUrl) {
  return ['我的东方本命角色榜单', ...rankings.map(group => group.rank + '. ' + group.ids.map(id => characterById.get(id).name).join(' / ') + (group.ids.length > 1 ? '（并列）' : '')), '', pageUrl].join('\n');
}
export function encodeResult(rankings, total) {
  return btoa(JSON.stringify({ v: 1, n: total, p: true, r: rankings.map(group => [group.rank, group.ids]) }))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeResult(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 10000 || !/^[\w-]+$/.test(encoded)) throw new Error('Invalid result link.');
  const value = JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')));
  if (!value || value.v !== 1 || !Number.isInteger(value.n) || value.n < 2 || value.n > characters.length
    || typeof value.p !== 'boolean' || !Array.isArray(value.r) || !value.r.length || value.r.length > value.n) throw new Error('Invalid result.');
  const seen = new Set();
  let expectedRank = 1;
  const rankings = value.r.map(group => {
    if (!Array.isArray(group) || group.length !== 2 || group[0] !== expectedRank
      || !Array.isArray(group[1]) || !group[1].length || group[1].length > value.n) throw new Error('Invalid rank.');
    for (const id of group[1]) {
      if (!characterById.has(id) || seen.has(id)) throw new Error('Invalid character.');
      seen.add(id);
    }
    expectedRank += group[1].length;
    return { rank: group[0], ids: group[1] };
  });
  if (seen.size > value.n) throw new Error('Invalid result count.');
  // Old p:false links still open, now with portraits enabled.
  return { rankings, total: value.n, showImages:true };
}
