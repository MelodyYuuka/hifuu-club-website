
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { characters, games } from '../src/favorite/characters.js';
import { FavoriteSorter, comparisonBound } from '../src/favorite/sorter.js';
import { defaultSettings, candidateIds, rankingLimit, validateSettings, serializeSession, restoreSession, encodeResult, decodeResult, resultText, flattenRankings } from '../src/favorite/model.js';

const settings = defaultSettings();
const ids = ['001', '002', '079', '080'];
const now = 1792407600000;
test('catalog has unique IDs, valid game references, and real local WebP files', async () => {
  assert.equal(characters.length, 173);
  assert.equal(new Set(characters.map(c => c.id)).size, characters.length);
  const groupIds = new Set(games.map(g => g.id));
  for (const character of characters) {
    assert.ok(character.name && character.title);
    assert.ok(character.games.every(id => groupIds.has(id)), character.name);
    assert.match(character.image, /^\.\/assets\/characters\/\d{3}\.webp$/);
    const file = new URL('../src/favorite/' + character.image, import.meta.url);
    assert.ok((await stat(file)).size > 100);
    const bytes = await readFile(file);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});
test('filters combine by union, deduplicate appearances, and respect exclusions', () => {
  assert.equal(candidateIds(settings).length, 145);
  assert.equal(candidateIds({...settings, games:[]}).length, 0);
  assert.equal(candidateIds({...settings, games:games.map(g => g.id)}).length, characters.length);
  const selected = candidateIds({...settings, games:['a','b','c']});
  assert.equal(selected.filter(id => id === '001').length, 1);
  assert.ok(selected.includes('002'));
  const excluded = {...settings, games:['a'], excluded:['001']};
  assert.ok(!candidateIds(excluded).includes('001'));
  assert.ok(candidateIds(excluded, true).includes('001'));
  assert.equal(rankingLimit(settings, 3), 3);
  assert.equal(rankingLimit({...settings, limit:'all'}, characters.length), characters.length);
  assert.equal(rankingLimit({...settings, limit:1}, characters.length), 1);
});
test('settings validation rejects malformed and unknown inputs', () => {
  assert.ok(validateSettings(defaultSettings()));
  for (const bad of [null, {}, {...settings, games:['bad']}, {...settings, games:['a','a']}, {...settings, excluded:['<script>']}, {...settings, limit:0}, {...settings, limit:5}, {...settings, showImages:'true'}]) assert.equal(validateSettings(bad), false);
});
test('save / restore preserves pending pair and undo history while enabling portraits', () => {
  const sorter = new FavoriteSorter(ids, 3);
  sorter.choose('tie'); sorter.choose('right');
  const saved = restoreSession(serializeSession({...settings, showImages:false}, sorter, now, true));
  assert.deepEqual(saved.sorter.pair, sorter.pair);
  assert.deepEqual(saved.sorter.decisions, sorter.decisions);
  assert.deepEqual(saved.sorter.undo().pair, sorter.undo().pair);
  assert.equal(saved.showImages, true);
  assert.equal(saved.settings.showImages, true);
  assert.equal(saved.startedAt, now);
});
test('completed results survive reload, including ties beyond a top-one cutoff', () => {
  const sorter = new FavoriteSorter(ids, 1);
  while (!sorter.done) sorter.choose('tie');
  const saved = restoreSession(serializeSession(settings, sorter, now));
  assert.equal(saved.sorter.done, true);
  assert.deepEqual(saved.sorter.rankings, [{rank:1, ids}]);
  assert.equal(saved.sorter.undo().done, false);
  assert.ok(restoreSession(null).sorter === null);
  assert.ok(restoreSession(serializeSession(settings, null, null)).sorter === null);
});
test('corrupt, oversized, incompatible or impossible saves are rejected', () => {
  const make = run => JSON.stringify({ version:1, settings, run });
  const validRun = {ids, limit:3, decisions:[], startedAt:now, showImages:true};
  for (const raw of ['null', '[]', '{}', '{broken', 'x'.repeat(100001), JSON.stringify({version:9, settings}), make({...validRun, ids:['001','001']}), make({...validRun, ids:['001','bad']}), make({...validRun, limit:5}), make({...validRun, startedAt:-1}), make({...validRun, decisions:['skip']}), make({...validRun, decisions:Array(10000).fill('left')}), make({...validRun, ids:['001','002'], limit:1, decisions:['left','right']})]) assert.throws(() => restoreSession(raw));
});
test('share links and copied text preserve complete rankings and ties with portraits enabled', () => {
  const rankings = [{rank:1, ids:['079','080']}, {rank:3, ids:['001']}, {rank:4, ids:['002']}];
  assert.deepEqual(decodeResult(encodeResult(rankings, 4, false)), {rankings, total:4, showImages:true});
  const text = resultText(rankings, 'https://example.com/favorite/');
  assert.equal(text.split('\n')[0], '我的东方本命角色榜单');
  assert.ok(text.endsWith('\n\nhttps://example.com/favorite/'));
  assert.doesNotMatch(text, /秘封俱乐部|从 4 位角色中选出|没有标准答案/);
  assert.match(text, /（并列）/);
  assert.match(text, /3\. 博丽灵梦/);
  assert.equal(flattenRankings(rankings).length, 4);
});
test('shared data cannot inject characters, duplicate ranks, or fake participant counts', () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  for (const value of [null, {}, {v:1,n:2,p:true,r:[]}, {v:1,n:2,p:true,r:[[1,['evil']]]}, {v:1,n:2,p:true,r:[[1,['001']],[2,['001']]]}, {v:1,n:2,p:true,r:[[1,['001','002']],[3,['079']]]}, {v:1,n:4,p:true,r:[[2,['001']]]}, {v:1,n:4,p:true,r:[[1,['001','002']],[2,['079']]]}, {v:1,n:999,p:true,r:[[1,['001']]]}]) assert.throws(() => decodeResult(encode(value)));
  for (const value of ['', '#', 'x'.repeat(10001)]) assert.throws(() => decodeResult(value));
});
test('full catalog sorting completes with consistent ranks within comparison bound', () => {
  const all = characters.map(c => c.id);
  const sorter = new FavoriteSorter(all, all.length);
  while (!sorter.done) sorter.choose(Number(sorter.pair.left) > Number(sorter.pair.right) ? 'left' : 'right');
  assert.equal(flattenRankings(sorter.rankings).length, all.length);
  assert.deepEqual(sorter.rankings.map(g => g.ids[0]), [...all].sort((a,b) => Number(b)-Number(a)));
  assert.ok(sorter.decisions.length <= comparisonBound(all.length, all.length));
  const restored = restoreSession(serializeSession(settings, sorter, now));
  assert.deepEqual(restored.sorter.rankings, sorter.rankings);
  const full = decodeResult(encodeResult(sorter.rankings, all.length));
  assert.deepEqual(full.rankings, sorter.rankings);
});


test('homepage exposes the new page and its HTML resolves the local entry modules', async () => {
  const homepage = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.match(homepage, /href="favorite\/"/);
  const page = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');
  assert.match(page, /type="module" src="\.\/app\.js"/);
  assert.match(page, /href="\.\/style\.css"/);
  assert.match(page, /id="battle-view"/);
  assert.match(page, /id="result-view"/);
});
