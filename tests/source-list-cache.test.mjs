import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../public/document-study/source-list-cache.js', import.meta.url), 'utf8');
const scope = 'a'.repeat(64);
function setup({ origin = 'https://example.test', storage, now = () => 1_800_000_000_000 } = {}) {
  const values = new Map();
  const store = storage || {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const window = { location: { origin }, sessionStorage: store };
  vm.runInNewContext(code, { window, TextEncoder, Date, Set, Object, Array, Number, JSON, encodeURIComponent, unescape, encodeURIComponent });
  return { cache: window.createSourceListCache({ scope, storage: store, now }), store, values, create: window.createSourceListCache };
}
const sample = () => [{ id: 'mag_abc', title: 'Source title', fileName: 'notes.md', kind: 'transcript', authority: 'library', storyId: 'story-1', artifactId: 'artifact-1', hash: 'b'.repeat(64), archived: false }];
const onlyKey = (values) => [...values.keys()][0];

test('round trips whitelisted metadata exactly without mutating input or storing sensitive extras', () => {
  const { cache, values } = setup();
  const input = sample();
  Object.assign(input[0], { body: 'secret body', text: 'private text', excerpt: 'quote', paragraph: 'private paragraph', url: 'https://private.test', path: '/private/file', transcript: 'secret transcript', provider: 'secret provider', config: { secret: true }, session: 'token', projectBinding: 'private' });
  const snapshot = structuredClone(input);
  assert.equal(cache.write(input), true);
  assert.deepEqual(input, snapshot);
  const serialized = [...values.values()][0];
  for (const forbidden of ['secret body', 'private text', 'secret transcript', 'private/file', 'token', 'private paragraph']) assert.equal(serialized.includes(forbidden), false);
  const expected = sample();
  assert.deepEqual(JSON.parse(JSON.stringify(cache.read())), { sources: expected, savedAt: 1_800_000_000_000 });
});

test('scope and origin namespaces isolate cached lists', () => {
  const { cache, store } = setup();
  assert.equal(cache.write(sample()), true);
  assert.equal(setup({ storage: store, origin: 'https://other.test' }).cache.read(), null);
  const other = setup({ storage: store }).create({ scope: 'c'.repeat(64), storage: store });
  assert.equal(other.read(), null);
  assert.equal(setup({ storage: store }).create({ scope: 'bad', storage: store }).write(sample()), false);
});

test('read rejects expired, corrupt, duplicate, oversized and unsupported-field data', () => {
  const { cache, store, values } = setup();
  assert.equal(cache.write(sample()), true);
  const key = onlyKey(values);
  const good = JSON.parse(values.get(key));
  for (const invalid of [
    { ...good, savedAt: good.savedAt - 86_400_001 },
    'not json',
    { ...good, sources: [...good.sources, ...good.sources] },
    { ...good, sources: [{ ...good.sources[0], body: 'unsupported' }] },
  ]) {
    values.set(key, typeof invalid === 'string' ? invalid : JSON.stringify(invalid));
    assert.equal(cache.read(), null);
  }
  values.set(key, 'x'.repeat(1024 * 1024 + 1));
  assert.equal(cache.read(), null);
  assert.equal(values.has(key), false);
});

test('write rejects invalid metadata, duplicate IDs, excessive records and size limits', () => {
  const { cache } = setup();
  assert.equal(cache.write([{ id: 'x', hash: 'nope' }]), false);
  assert.equal(cache.write([{ id: 'x' }, { id: 'x' }]), false);
  assert.equal(cache.write(Array.from({ length: 2001 }, (_, i) => ({ id: String(i) }))), false);
  assert.equal(cache.write([{ id: 'x', title: 't'.repeat(1001) }]), false);
  assert.equal(cache.write([{ id: 'x', title: 't'.repeat(1_000_000) }]), false);
});

test('blocked and quota-limited storage fail softly', () => {
  const blocked = setup({ storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } }).cache;
  assert.equal(blocked.read(), null);
  assert.equal(blocked.write(sample()), false);
  const quota = setup({ storage: { getItem() { return null; }, setItem() { throw new Error('quota'); } } }).cache;
  assert.equal(quota.write(sample()), false);
  assert.equal(setup({ storage: null }).cache.read(), null);
});

test('empty catalog is cacheable and timestamp expiry is enforced', () => {
  let now = 1_800_000_000_000;
  const { cache } = setup({ now: () => now });
  assert.equal(cache.write([]), true);
  assert.deepEqual(JSON.parse(JSON.stringify(cache.read())), { sources: [], savedAt: now });
  now += 86_400_001;
  assert.equal(cache.read(), null);
});
