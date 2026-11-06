// Batch only callers queued before hashing begins. The Library index is not an
// asset-byte version: files can change without an index write. A later read,
// including an export final check, must start its own current-byte pass even
// when an earlier pass is still in flight. No time window certifies freshness.
export function createAssetPassCache() {
  const queued = new Map();
  const copy = rows => rows.map(row => ({ ...row }));
  return { get(key, compute) {
    let promise = queued.get(key);
    if (!promise) {
      promise = Promise.resolve().then(() => {
        queued.delete(key);
        return compute();
      });
      queued.set(key, promise);
    }
    return promise.then(copy);
  } };
}
