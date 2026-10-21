import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { games } from '../src/favorite/characters.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';
import { characterById, defaultSettings, candidateIds, restoreSession, serializeSession, decodeResult, encodeResult, flattenRankings } from '../src/favorite/model.js';

const app = await readFile(new URL('../src/favorite/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/favorite/style.css', import.meta.url), 'utf8');
const oldResult = 'eyJ2IjoxLCJuIjoxNzMsInAiOmZhbHNlLCJyIjpbWzEsWyIwMzUiXV0sWzIsWyIwMzYiXV0sWzMsWyIxMjkiXV0sWzQsWyIwMTMiXV0sWzUsWyIwMDUiXV0sWzYsWyIwMDIiXV0sWzcsWyIwMDEiXV0sWzgsWyIwMTQiXV0sWzksWyIwMDMiXV0sWzEwLFsiMDEyIl1dXX0';

function sourceFunction(name, next) {
  const start = app.indexOf('function ' + name + '(');
  const end = app.indexOf('\nfunction ' + next + '(', start);
  assert.ok(start >= 0 && end > start);
  return app.slice(start, end);
}

test('setup and application no longer contain an image-mode control or rendering branches', () => {
  assert.doesNotMatch(html + app + css, /show-images|image-toggle|runImages|纯文字模式/);
  assert.doesNotMatch(app, /showImages/);
  assert.match(html, /id="roster-details"/);
  assert.match(html, /name="limit" value="all"/);
  assert.match(css, /\.portrait-stage\.image-failed/);
  assert.match(app, /image\.closest\('\.winner-portrait'\)/);
});

test('the exact old disabled-image share link now displays portraits without changing its rankings', () => {
  const legacy = JSON.parse(Buffer.from(oldResult, 'base64url').toString('utf8'));
  assert.equal(legacy.p, false);
  const result = decodeResult(oldResult);
  assert.equal(result.showImages, true);
  assert.equal(result.total, 173);
  assert.deepEqual(result.rankings.map(group => [group.rank, group.ids]), legacy.r);
  const encoded = encodeResult(result.rankings, result.total, false);
  assert.equal(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')).p, true);
  assert.deepEqual(decodeResult(encoded), result);
});

test('actual shared result renderer always includes winner and row portraits, even with a legacy false flag', () => {
  const result = {...decodeResult(oldResult), showImages:false};
  const elements = new Map();
  const context = vm.createContext({
    currentResult:null, sorter:null, characterById, flattenRankings, games,
    escape:String,
    $:selector => {
      if (!elements.has(selector)) elements.set(selector, {});
      return elements.get(selector);
    },
  });
  vm.runInContext(sourceFunction('renderResult', 'clearResultHash'), context);
  context.renderResult(result);
  assert.match(elements.get('#winner-card').innerHTML, /<img src="\.\/assets\/characters\/035\.webp"/);
  const list = elements.get('#ranking-list').innerHTML;
  assert.equal([...list.matchAll(/class="rank-avatar"/g)].length, 10);
  for (const {character} of flattenRankings(result.rankings)) assert.ok(list.includes('src="' + character.image + '"'));
  assert.equal(elements.get('#result-count').textContent, '10 位角色');
  assert.equal(elements.get('#result-undo').hidden, true);
});

test('actual character picker and comparison cards always include images while keeping load-failure fallbacks', () => {
  const elements = new Map([
    ['#roster-details', {open:true}], ['#roster-list', {}], ['#roster-empty', {}],
  ]);
  const rows = ['001', '002'].map(id => characterById.get(id));
  const context = vm.createContext({
    settings:{...defaultSettings(), showImages:false},
    characterById, candidateIds, escape:String, icon:() => '',
    visibleRoster:() => rows, renderRosterSummary() {},
    $:selector => elements.get(selector),
  });
  vm.runInContext(sourceFunction('renderRoster', 'renderPresetState'), context);
  context.renderRoster();
  assert.equal([...elements.get('#roster-list').innerHTML.matchAll(/<img /g)].length, rows.length);
  assert.equal(elements.get('#roster-empty').hidden, true);
  vm.runInContext(sourceFunction('cardHTML', 'renderBattle'), context);
  for (const id of ['001', '002']) {
    const card = context.cardHTML(id, 'left');
    assert.ok(card.includes('src="' + characterById.get(id).image + '"'));
    assert.match(card, /portrait-fallback/);
  }
});

test('legacy inactive, running and completed saves enable portraits without changing progress or candidates', () => {
  const settings = {...defaultSettings(), games:['a'], excluded:['003'], included:['079'], presetIds:[], showImages:false};
  const original = structuredClone(settings);
  const now = 1792407600000;
  const progress = new FavoriteSorter(['001', '002', '079', '080'], 3);
  progress.choose('tie');
  const completed = new FavoriteSorter(['001', '002', '079'], 1);
  while (!completed.done) completed.choose('tie');
  for (const sorter of [null, progress, completed]) {
    const legacy = JSON.parse(serializeSession(settings, sorter, sorter ? now : null));
    legacy.settings.showImages = false;
    if (legacy.run) legacy.run.showImages = false;
    const restored = restoreSession(JSON.stringify(legacy));
    assert.equal(restored.settings.showImages, true);
    assert.equal(restored.showImages, true);
    assert.deepEqual(restored.settings, {...settings, showImages:true});
    assert.deepEqual(candidateIds(restored.settings), candidateIds(settings));
    if (sorter) {
      assert.deepEqual(restored.sorter.ids, sorter.ids);
      assert.deepEqual(restored.sorter.decisions, sorter.decisions);
      assert.equal(restored.sorter.limit, sorter.limit);
      assert.equal(restored.sorter.done, sorter.done);
      assert.equal(restored.startedAt, now);
      if (sorter.done) assert.deepEqual(restored.sorter.rankings, sorter.rankings);
      else assert.deepEqual(restored.sorter.pair, sorter.pair);
      assert.deepEqual(restored.sorter.undo().pair, sorter.undo().pair);
    } else assert.equal(restored.sorter, null);
    const next = JSON.parse(serializeSession(restored.settings, restored.sorter, restored.startedAt, false));
    assert.equal(next.settings.showImages, true);
    if (next.run) assert.equal(next.run.showImages, true);
  }
  assert.deepEqual(settings, original, 'Serialization and migration must not mutate the input settings');
});
