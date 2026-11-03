import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetPassCache } from '../runtime/services/native-output-asset-pass.mjs';

test('N outputs read in one pass trigger one Library assets pass', async () => {
  let clock = 1000, passes = 0;
  const cache = createAssetPassCache({ ttl: 2000, now: () => clock });
  const compute = async () => { passes++; await new Promise((r) => setTimeout(r, 5)); return [{ id: 'a', hash: 'h' }]; };
  const results = await Promise.all(Array.from({ length: 12 }, () => cache.get('index-1', compute)));
  assert.equal(passes, 1);
  assert.equal(results.length, 12);
  results[0][0].hash = 'mutated';
  assert.equal((await cache.get('index-1', compute))[0].hash, 'h', 'callers get their own copy');
  assert.equal(passes, 1);
});

test('assets pass is redone after the window, when the index changes, and after a failure', async () => {
  let clock = 0, passes = 0, fail = false;
  const cache = createAssetPassCache({ ttl: 2000, now: () => clock });
  const compute = async () => { passes++; if (fail) throw Error('boom'); return []; };
  await cache.get('k', compute); await cache.get('k', compute);
  assert.equal(passes, 1);
  clock += 2500; await cache.get('k', compute);
  assert.equal(passes, 2);
  await cache.get('other-index', compute);
  assert.equal(passes, 3);
  fail = true; clock += 5000;
  await assert.rejects(cache.get('k', compute));
  fail = false; await cache.get('k', compute);
  assert.equal(passes, 5);
});
