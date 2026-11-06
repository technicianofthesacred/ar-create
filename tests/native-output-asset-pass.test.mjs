import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetPassCache } from '../runtime/services/native-output-asset-pass.mjs';

test('simultaneously queued outputs share one future byte pass and receive independent rows', async () => {
  let passes = 0;
  const cache = createAssetPassCache();
  const compute = async () => { passes++; return [{ id: 'a', hash: 'first' }]; };
  const results = await Promise.all(Array.from({ length: 12 }, () => cache.get('same-index', compute)));
  assert.equal(passes, 1);
  results[0][0].hash = 'mutated by caller';
  assert.equal(results[1][0].hash, 'first');
  assert.equal((await cache.get('same-index', compute))[0].hash, 'first');
  assert.equal(passes, 2, 'a later proof recomputes even without an index change');
});

test('same-index byte and availability changes are visible immediately without waiting', async () => {
  const cache = createAssetPassCache(); let bytes = 'original', available = true;
  const compute = async () => available ? [{ id: 'photo', hash: bytes }] : [];
  assert.equal((await cache.get('index', compute))[0].hash, 'original');
  bytes = 'changed';
  assert.equal((await cache.get('index', compute))[0].hash, 'changed');
  available = false;
  assert.deepEqual(await cache.get('index', compute), []);
});

test('a request after hashing started cannot inherit a suspended older asset pass', async () => {
  const cache = createAssetPassCache(); let release, started;
  const begins = new Promise(resolve => { started = resolve; });
  const first = cache.get('same-index', async () => {
    const earlier = [{ id: 'photo', hash: 'before-change' }]; started();
    await new Promise(resolve => { release = resolve; }); return earlier;
  });
  await begins;
  assert.equal((await cache.get('same-index', async () => [{ id: 'photo', hash: 'after-change' }]))[0].hash, 'after-change');
  release(); assert.equal((await first)[0].hash, 'before-change');
  assert.equal((await cache.get('same-index', async () => [{ id: 'photo', hash: 'latest' }]))[0].hash, 'latest');
});

test('different indices stay separate and failure never poisons a subsequent proof', async () => {
  const cache = createAssetPassCache(); let passes = 0;
  const compute = async () => { passes++; return []; };
  await Promise.all([cache.get('a', compute), cache.get('b', compute), cache.get('a', compute)]);
  assert.equal(passes, 2);
  const failed = () => cache.get('a', async () => { throw Error('Cannot read photo'); });
  const results = await Promise.allSettled([failed(), failed()]);
  assert.ok(results.every(result => result.status === 'rejected'));
  await cache.get('a', compute); assert.equal(passes, 3);
});
