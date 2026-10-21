/**
 * Lazy tournament sorter. Leaves are characters; each cached winner is a tied group.
 * Only paths containing an extracted winner are invalidated, so finding the top K
 * costs at most (N - 1) + (K - 1) * ceil(log2(N)) comparisons (without ties).
 * The deterministic decision log can be replayed for persistence and undo.
 */
export function comparisonBound(count, limit) {
  if (count < 2) return 0;
  return count - 1 + (Math.min(count, limit) - 1) * Math.ceil(Math.log2(count));
}

function tree(ids) {
  if (ids.length === 1) return { id: ids[0], head: null, removed: false };
  const mid = Math.ceil(ids.length / 2);
  return { left: tree(ids.slice(0, mid)), right: tree(ids.slice(mid)), head: null };
}

function* peek(node) {
  if (node.head !== null) return node.head;
  if ('id' in node) return (node.head = node.removed ? [] : [node.id]);
  const left = yield* peek(node.left);
  const right = yield* peek(node.right);
  if (!left.length || !right.length) return (node.head = left.length ? left : right);
  const choice = yield { left: left[0], right: right[0] };
  return (node.head = choice === 'left' ? left : choice === 'right' ? right : [...left, ...right]);
}

function remove(node, ids) {
  if ('id' in node) {
    if (!ids.has(node.id)) return false;
    node.removed = true;
    node.head = null;
    return true;
  }
  const left = remove(node.left, ids);
  const right = remove(node.right, ids);
  if (left || right) node.head = null;
  return left || right;
}

function* tournament(ids, limit, rankings) {
  const root = tree(ids);
  let count = 0;
  while (count < limit) {
    const winners = yield* peek(root);
    if (!winners.length) break;
    rankings.push({ rank: count + 1, ids: [...winners] });
    count += winners.length;
    remove(root, new Set(winners));
  }
  return rankings;
}

export class FavoriteSorter {
  constructor(ids, limit = ids.length, decisions = []) {
    if (!Array.isArray(ids) || ids.length < 2 || new Set(ids).size !== ids.length) {
      throw new Error('At least two distinct character IDs are required.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > ids.length) throw new Error('Invalid ranking limit.');
    this.ids = [...ids];
    this.limit = limit;
    this.decisions = [];
    this.rankings = [];
    this.iterator = tournament(this.ids, limit, this.rankings);
    this.step = this.iterator.next();
    for (const decision of decisions) this.choose(decision);
  }

  get done() { return this.step.done; }
  get pair() { return this.done ? null : this.step.value; }

  choose(choice) {
    if (this.done) throw new Error('The ranking is already complete.');
    if (!['left', 'right', 'tie'].includes(choice)) throw new Error('Invalid choice.');
    this.decisions.push(choice);
    this.step = this.iterator.next(choice);
    return this.pair;
  }

  undo() {
    if (!this.decisions.length) return this;
    return new FavoriteSorter(this.ids, this.limit, this.decisions.slice(0, -1));
  }
}

export function shuffleIds(ids, random = Math.random) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
