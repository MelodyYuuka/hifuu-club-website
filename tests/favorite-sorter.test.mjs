import assert from 'node:assert/strict';
import test from 'node:test';
import { FavoriteSorter, comparisonBound, shuffleIds } from '../src/favorite/sorter.js';

function finish(ids, values, limit = ids.length) {
  const sorter = new FavoriteSorter(ids, limit);
  while (!sorter.done) {
    const { left, right } = sorter.pair;
    sorter.choose(values[left] === values[right] ? 'tie' : values[left] > values[right] ? 'left' : 'right');
  }
  return sorter;
}

test('every subset size and ranking limit matches a reference sort', () => {
  for (let n = 2; n <= 48; n++) {
    const ids = Array.from({ length: n }, (_, i) => `c${i}`);
    const values = Object.fromEntries(ids.map((id, i) => [id, (i * 37) % n]));
    for (const limit of new Set([1, 5, n].map(k => Math.min(n, k)))) {
      const result = finish(ids, values, limit);
      const expected = [...ids].sort((a, b) => values[b] - values[a]);
      const cutoff = values[expected[limit - 1]];
      const included = expected.filter(id => values[id] >= cutoff);
      assert.deepEqual(new Set(result.rankings.flatMap(r => r.ids)), new Set(included));
      let rank = 1;
      for (const group of result.rankings) {
        assert.equal(group.rank, rank);
        assert.ok(group.ids.every(id => values[id] === values[expected[rank - 1]]));
        rank += group.ids.length;
      }
      assert.ok(result.decisions.length <= comparisonBound(n, limit));
    }
  }
});

test('winner needs exactly N-1 comparisons, ties at the cutoff are retained', () => {
  const result = finish(['a', 'b', 'c', 'd'], { a: 8, b: 8, c: 1, d: 8 }, 1);
  assert.equal(result.decisions.length, 3);
  assert.deepEqual(result.rankings, [{ rank: 1, ids: ['a', 'b', 'd'] }]);
});

test('all equal characters occupy rank one without duplicates', () => {
  const result = finish(['a', 'b', 'c', 'd', 'e'], { a: 1, b: 1, c: 1, d: 1, e: 1 });
  assert.equal(result.rankings.length, 1);
  assert.equal(result.rankings[0].ids.length, 5);
});

test('replay, undo from result, and changing a decision are deterministic', () => {
  let sorter = new FavoriteSorter(['a', 'b', 'c', 'd'], 3);
  sorter.choose('right');
  const before = sorter.pair;
  sorter.choose('tie');
  const restored = new FavoriteSorter(sorter.ids, sorter.limit, sorter.decisions);
  assert.deepEqual(restored.pair, sorter.pair);
  sorter = sorter.undo();
  assert.deepEqual(sorter.pair, before);
  sorter.choose('left');
  while (!sorter.done) sorter.choose('left');
  const replay = new FavoriteSorter(sorter.ids, sorter.limit, sorter.decisions);
  assert.deepEqual(replay.rankings, sorter.rankings);
  sorter = sorter.undo();
  assert.equal(sorter.done, false);
  sorter.choose('right');
  // Reversing the last decision may expose another contender; completion is not immediate.
  while (!sorter.done) sorter.choose('left');
  const changedReplay = new FavoriteSorter(sorter.ids, sorter.limit, sorter.decisions);
  assert.deepEqual(changedReplay.rankings, sorter.rankings);
});

test('invalid IDs, limits, decisions and overlong replay are rejected', () => {
  assert.throws(() => new FavoriteSorter(['a']));
  assert.throws(() => new FavoriteSorter(['a', 'a']));
  assert.throws(() => new FavoriteSorter(['a', 'b'], 0));
  assert.throws(() => new FavoriteSorter(['a', 'b'], 3));
  assert.throws(() => new FavoriteSorter(['a', 'b'], 1, ['skip']));
  assert.throws(() => new FavoriteSorter(['a', 'b'], 1, ['left', 'right']));
});

test('shuffle preserves the input and all IDs', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const result = shuffleIds(ids, () => 0);
  assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
  assert.deepEqual(new Set(result), new Set(ids));
  assert.notDeepEqual(result, ids);
});
