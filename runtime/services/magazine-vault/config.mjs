// Where the magazine is, from trusted startup configuration only (never from a request).
// In order: createServer({magazineVault}) (tests, serve.mjs), then <data>/magazine-vault.json
// (the installed home), then AR_CREATE_MAGAZINE_ROOT (serve.mjs sets it from config magazine.vaultRoot;
// read-only). Writing stays off unless the host says writable: true.
import {lstat, readFile} from 'node:fs/promises';
import path from 'node:path';

const KEYS = ['vaultRoot', 'filesRoot', 'drops', 'writable', 'exportStaging', 'magSendRepo', 'machine', 'previewPort'];
const abs = (value, label) => { if (value === undefined || value === null) return null; if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`magazine.${label} must be an absolute path.`); return path.resolve(value); };

export function validateMagazineVaultConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Magazine vault configuration must be an object.');
  const extra = Object.keys(value).filter(k => !KEYS.includes(k));
  if (extra.length) throw new Error(`Magazine vault configuration has unsupported field(s): ${extra.join(', ')}.`);
  if (value.writable !== undefined && typeof value.writable !== 'boolean') throw new Error('magazine.writable must be true or false.');
  if (value.drops !== undefined && (!Array.isArray(value.drops) || value.drops.length > 8)) throw new Error('magazine.drops must be a list of up to 8 folders.');
  if (value.previewPort !== undefined && (!Number.isInteger(value.previewPort) || value.previewPort < 1 || value.previewPort > 65535)) throw new Error('magazine.previewPort must be a port.');
  if (value.machine !== undefined && (typeof value.machine !== 'string' || !/^[\w.-]{1,64}$/.test(value.machine))) throw new Error('magazine.machine must be a host name.');
  return {
    vaultRoot: abs(value.vaultRoot, 'vaultRoot'), filesRoot: abs(value.filesRoot, 'filesRoot'),
    drops: (value.drops || []).map((d, i) => abs(d, `drops[${i}]`)), writable: value.writable === true,
    exportStaging: abs(value.exportStaging, 'exportStaging'), magSendRepo: abs(value.magSendRepo, 'magSendRepo'),
    ...(value.machine ? {machine: value.machine} : {}), ...(value.previewPort ? {previewPort: value.previewPort} : {}),
  };
}

export async function loadMagazineVaultConfig({dataDir, options, env = process.env}) {
  if (options !== undefined && options !== null) return validateMagazineVaultConfig(options);
  const file = path.join(dataDir, 'magazine-vault.json');
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('magazine-vault.json must be an owned regular file.');
    return validateMagazineVaultConfig(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (env.AR_CREATE_MAGAZINE_ROOT) return validateMagazineVaultConfig({vaultRoot: env.AR_CREATE_MAGAZINE_ROOT, writable: false});
  return {};
}
