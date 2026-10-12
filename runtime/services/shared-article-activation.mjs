import fs from 'node:fs';
import path from 'node:path';

// CLI startup only. Factory callers remain explicit and isolated by default.
export function sharedArticlesEnabled(dataDir, override = process.env.AR_SHARED_ARTICLES) {
  if (override !== undefined) {
    if (!['0', '1'].includes(override)) throw new Error('AR_SHARED_ARTICLES must be 0 or 1.');
    return override === '1';
  }
  const file = path.join(dataDir, 'shared-articles-activation.json');
  const stat = fs.lstatSync(file, {throwIfNoEntry:false});
  if (!stat) return false;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096) throw new Error('Shared article activation must be a small regular configuration file.');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value?.schema !== 'ar-create.shared-articles-activation.v1' || typeof value.enabled !== 'boolean') throw new Error('Shared article activation is invalid; existing files were preserved.');
  return value.enabled;
}
