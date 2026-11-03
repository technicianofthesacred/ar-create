// source-manifest.json is no longer committed or hand-refreshed (review R2-04): scripts/release.mjs computes it from
// the clean checkout at build time and writes it into <home>/service/. This command only shows what that computation
// gives for this checkout, so a person can look at it. Nothing in the repository changes.
// Usage: node scripts/refresh-manifest.mjs [--out <file>]   (--out writes the JSON somewhere outside the checkout)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildManifest,trackedFiles} from './lib/manifest.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {rows,text,sha256}=buildManifest(root);
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:null;
if(out){if(!out||out.startsWith('--')||!path.isAbsolute(out))throw Error('--out requires an absolute file path.');fs.writeFileSync(out,text);}
console.log(`Computed manifest: ${rows.length} of ${trackedFiles(root).length} tracked files, sha256 ${sha256}${out?`; written to ${out}`:''}.`);
console.log('Nothing to commit: the release writes this into <home>/service/source-manifest.json and RELEASE.json.manifestSha256.');
