import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
const context = new AsyncLocalStorage();
export const withIsolatedConfig = (config, fn) => context.run(config, fn);
export function readIsolatedConfig() {
  const local = context.getStore();
  if (local) return local;
  const file = process.env.AR_CREATE_MAG_CONFIG;
  if (!file || path.basename(file) !== 'runner-config.json' || !path.isAbsolute(file)) throw new Error('Magazine runner requires an ar-create-owned configuration. Original configuration is never read.');
  const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid isolated runner configuration.');
  const config = JSON.parse(fs.readFileSync(file, 'utf8')); const own = fs.realpathSync(path.dirname(file));
  // macOS /var and /private/var are aliases. Compare their proven physical
  // directories, while keeping the saved job paths valid under either spelling.
  for (const key of ['magFiles', 'magVault']) {
    if(typeof config[key]!=='string'||!path.isAbsolute(config[key]))throw new Error('Runner outputs must remain in the isolated recording root.');
    const stat=fs.lstatSync(config[key]);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Runner output roots must be real owned directories.');
    const real=fs.realpathSync(config[key]);if(real!==own&&!real.startsWith(own+path.sep))throw new Error('Runner outputs must remain in the isolated recording root.');
  }
  // The shared word library is read by the job to build its transcription prompt; it is never written from here.
  if (config.wordLibrary !== undefined && (typeof config.wordLibrary !== 'string' || !path.isAbsolute(config.wordLibrary) || path.basename(config.wordLibrary) !== 'library.json')) throw new Error('The word library must be an absolute path to library.json.');
  if (config.i64Export?.enabled || config.magDrops?.length || config.teaTerms) throw new Error('Original export/drop integrations are disabled.');
  return {...config,__file:file};
}
