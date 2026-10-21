import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CATALOG_VERSION, characters, games } from '../src/favorite/characters.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';
import { defaultSettings, candidateIds, serializeSession, restoreSession, encodeResult, decodeResult } from '../src/favorite/model.js';

const th20Names = ['尘塚姥芽', '封兽魑魅', '道神驯子', '维缦·浅间', '磐永阿梨夜', '渡里贝子'];
const th20Ids = ['200', '201', '202', '203', '204', '205'];
const previousDefault = { ...defaultSettings(), games: [...'abcdefghijklmn', 'A', 'B', 'D', 'E'] };
const previousAll = [...previousDefault.games, ...'FGHIJ'];
const legacySave = (settings, run = null) => JSON.stringify({version:1, settings, run});

test('TH20 has all six new named characters, including the Extra boss', () => {
  assert.deepEqual(games.find(game => game.id === 'o'), {id:'o', name:'东方锦上京', code:'TH20', group:'main'});
  assert.equal(games.filter(game => game.group === 'main').length, 15);
  assert.deepEqual(characters.filter(character => th20Ids.includes(character.id)).map(character => character.name), th20Names);
  assert.ok(th20Ids.every(id => candidateIds(defaultSettings()).includes(id)));
});

test('TH20 filter includes protagonists, returning boss, and actual ending appearances without duplicates', () => {
  const expected = ['001','002','008','009','010','020','022','029','034','050','051','057','058','060','149','182','183','195','198', ...th20Ids];
  const selected = candidateIds({...defaultSettings(), games:['o']});
  assert.equal(selected.length, 25);
  assert.deepEqual(new Set(selected), new Set(expected));
  const joined = candidateIds({...defaultSettings(), games:['o','D','a']});
  assert.equal(joined.filter(id => id === '034').length, 1);
  assert.equal(joined.filter(id => id === '001').length, 1);
});

test('pre-update default and all presets gain TH20 without discarding their other settings', () => {
  const oldDefault = {...previousDefault, limit:1, showImages:false};
  const upgraded = restoreSession(legacySave(oldDefault));
  assert.ok(upgraded.settings.games.includes('o'));
  assert.equal(upgraded.settings.limit, 1);
  assert.equal(upgraded.settings.showImages, true);
  assert.equal(candidateIds(upgraded.settings).length, 143);
  const oldAll = {...oldDefault, games:previousAll};
  assert.equal(candidateIds(restoreSession(legacySave(oldAll)).settings).length, 171);
});

test('catalog upgrade does not change a custom selection or undo a deliberate TH20 opt-out', () => {
  const custom = {...previousDefault, games:['a','b','c']};
  assert.deepEqual(restoreSession(legacySave(custom)).settings, custom);
  const curated = {...previousDefault, excluded:['001']};
  const migrated = restoreSession(legacySave(curated)).settings;
  assert.deepEqual(migrated.excluded, curated.excluded);
  assert.ok(!migrated.games.includes('o'));
  assert.ok(migrated.games.includes('th075'));
  assert.ok(migrated.games.includes('th175'));
  assert.ok(!migrated.games.includes('A'));
  const currentSettings = {...defaultSettings(), games:defaultSettings().games.filter(id => id !== 'o')};
  const current = serializeSession(currentSettings, null, null);
  assert.equal(JSON.parse(current).catalogVersion, CATALOG_VERSION);
  assert.deepEqual(restoreSession(current).settings, currentSettings);
});

test('old running tests keep exactly the same candidates, pair and history after a catalog upgrade', () => {
  const sorter = new FavoriteSorter(['001','002','034','079'], 3);
  sorter.choose('tie');
  const old = JSON.parse(serializeSession(previousDefault, sorter, 1792407600000));
  delete old.catalogVersion;
  const upgraded = restoreSession(JSON.stringify(old));
  assert.ok(upgraded.settings.games.includes('o'));
  assert.deepEqual(upgraded.sorter.ids, sorter.ids);
  assert.deepEqual(upgraded.sorter.pair, sorter.pair);
  assert.deepEqual(upgraded.sorter.decisions, sorter.decisions);
  assert.deepEqual(upgraded.sorter.undo().pair, sorter.undo().pair);
});

test('new TH20 results and existing share links use the same stable wire format', () => {
  const rankings = [{rank:1, ids:['205']}, {rank:2, ids:['034','204']}];
  assert.deepEqual(decodeResult(encodeResult(rankings, 25)), {rankings, total:25, showImages:true});
  const oldRankings = [{rank:1, ids:['079','080']}];
  assert.deepEqual(decodeResult(encodeResult(oldRankings, 165)).rankings, oldRankings);
  for (const catalogVersion of [null, '2', 0, -1, CATALOG_VERSION + 1]) {
    assert.throws(() => restoreSession(JSON.stringify({version:1, catalogVersion, settings:defaultSettings(), run:null})));
  }
});

test('page and documentation advertise TH20 instead of the previous data cutoff', async () => {
  const app = await readFile(new URL('../src/favorite/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../src/favorite/README.md', import.meta.url), 'utf8');
  const credits = await readFile(new URL('../src/favorite/CREDITS.md', import.meta.url), 'utf8');
  assert.match(html, /data-tab="main" type="button">正作 <span>15<\/span>/);
  assert.match(app, /锦上京（TH20）/);
  assert.doesNotMatch(app + readme + credits, /暂未收录锦上京|未收录锦上京等角色/);
  assert.match(credits, /177\.webp 至 205\.webp/);
});
