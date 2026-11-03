// Short-lived memo for the Library image list used by native output proofs. One overview pass proves
// every output; the list does not depend on the output, so it is computed once per window and per index.
const ASSET_PASS_MS = 2000;
export function createAssetPassCache({ ttl = ASSET_PASS_MS, now = Date.now } = {}) {
  let entry = null;
  const copy = (rows) => rows.map((row) => ({ ...row }));
  return { get(key, compute) {
    if (entry && entry.key === key && (entry.done === null || now() - entry.done <= ttl)) return entry.promise.then(copy);
    const mine = { key, done: null, promise: Promise.resolve().then(compute) };
    entry = mine;
    mine.promise.then(() => { mine.done = now(); }, () => { if (entry === mine) entry = null; });
    return mine.promise.then(copy);
  } };
}
