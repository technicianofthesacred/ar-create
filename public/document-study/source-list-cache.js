/* Best-effort, metadata-only startup cache. The fetched catalog remains authoritative. */
(() => {
  'use strict';

  const VERSION = 1;
  const TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_RECORDS = 2000;
  const MAX_BYTES = 1024 * 1024;
  const HASH = /^[a-f0-9]{64}$/i;
  const FIELDS = Object.freeze(['id', 'title', 'fileName', 'kind', 'authority', 'storyId', 'artifactId', 'hash', 'archived']);
  const STRING_LIMITS = Object.freeze({ id: 256, title: 1000, fileName: 1000, kind: 128, authority: 128, storyId: 256, artifactId: 256 });

  function bytes(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }

  function validSource(source, strict) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
    if (strict && Object.keys(source).some((key) => !FIELDS.includes(key))) return false;
    if (typeof source.id !== 'string' || source.id.length < 1 || source.id.length > STRING_LIMITS.id) return false;
    for (const [key, limit] of Object.entries(STRING_LIMITS)) {
      if (key === 'id' && !Object.prototype.hasOwnProperty.call(source, key)) continue;
      if (Object.prototype.hasOwnProperty.call(source, key) && (typeof source[key] !== 'string' || source[key].length > limit)) return false;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'hash') && source.hash !== null && (typeof source.hash !== 'string' || !HASH.test(source.hash))) return false;
    if (Object.prototype.hasOwnProperty.call(source, 'archived') && typeof source.archived !== 'boolean') return false;
    return true;
  }

  function clean(source) {
    const result = {};
    for (const key of FIELDS) if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
    return result;
  }

  window.createSourceListCache = function createSourceListCache(options = {}) {
    const { scope, now = Date.now } = options || {};
    let storage = options && options.storage;
    if (storage === undefined) {
      try { storage = window.sessionStorage; } catch { storage = null; }
    }
    const origin = window.location && window.location.origin;
    if (typeof scope !== 'string' || !HASH.test(scope) || typeof origin !== 'string' || !origin) {
      return { read: () => null, write: () => false };
    }
    const key = `ar-create:source-list:v${VERSION}:${encodeURIComponent(origin)}:${scope.toLowerCase()}`;
    const unavailable = () => ({ read: () => null, write: () => false });
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return unavailable();

    return {
      read() {
        let raw;
        try { raw = storage.getItem(key); } catch { return null; }
        if (typeof raw !== 'string' || !raw) return null;
        try {
          if (bytes(raw) > MAX_BYTES) throw new Error('oversized');
          const envelope = JSON.parse(raw);
          if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
              Object.keys(envelope).some((field) => !['version', 'origin', 'scope', 'savedAt', 'sources'].includes(field)) ||
              envelope.version !== VERSION || envelope.origin !== origin || envelope.scope !== scope.toLowerCase() ||
              !Number.isFinite(envelope.savedAt) || envelope.savedAt > now() || now() - envelope.savedAt > TTL_MS ||
              !Array.isArray(envelope.sources) || envelope.sources.length > MAX_RECORDS) throw new Error('invalid');
          const seen = new Set();
          for (const source of envelope.sources) {
            if (!validSource(source, true) || seen.has(source.id)) throw new Error('invalid source');
            seen.add(source.id);
          }
          return { sources: envelope.sources.map(clean), savedAt: envelope.savedAt };
        } catch {
          try { storage.removeItem && storage.removeItem(key); } catch { /* optional eviction */ }
          return null;
        }
      },
      write(catalog) {
        if (!Array.isArray(catalog) || catalog.length > MAX_RECORDS) return false;
        try {
          const seen = new Set();
          const sources = catalog.map((source) => {
            if (!validSource(source, false) || seen.has(source.id)) throw new Error('invalid source');
            seen.add(source.id);
            return clean(source);
          });
          const savedAt = now();
          if (!Number.isFinite(savedAt)) return false;
          const serialized = JSON.stringify({ version: VERSION, origin, scope: scope.toLowerCase(), savedAt, sources });
          if (bytes(serialized) > MAX_BYTES) return false;
          storage.setItem(key, serialized);
          return true;
        } catch { return false; }
      }
    };
  };
})();
