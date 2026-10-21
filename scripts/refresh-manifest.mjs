// Bring source-manifest.json in line with the committed source: re-hash every listed file, list tracked files
// that are new under "authored", drop rows whose file no longer exists. Review the resulting diff like any other.
// Usage: node scripts/refresh-manifest.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MANIFEST_FILE,compareManifest,sha256} from './lib/manifest.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const {manifest,stale,missing,unlisted}=compareManifest(root);
const touched=stale.length+missing.length+unlisted.length;
if(check){
 if(touched){console.error(`Manifest out of date: ${stale.length} changed, ${missing.length} missing, ${unlisted.length} unlisted.\n`+[...stale.map(f=>'changed  '+f),...missing.map(f=>'missing  '+f),...unlisted.map(f=>'unlisted '+f)].join('\n'));process.exit(1);}
 console.log('source-manifest.json matches the checkout.');process.exit(0);
}
const gone=new Set(missing);
manifest.included=manifest.included.filter(row=>!gone.has(row.path));manifest.authored=manifest.authored.filter(row=>!gone.has(row.path));
for(const row of [...manifest.included,...manifest.authored])row.candidateSha256=sha256(fs.readFileSync(path.join(root,row.path)));
for(const file of unlisted)manifest.authored.push({path:file,candidateSha256:sha256(fs.readFileSync(path.join(root,file)))});
fs.writeFileSync(path.join(root,MANIFEST_FILE),JSON.stringify(manifest,null,2)+'\n');
console.log(`Refreshed ${MANIFEST_FILE}: ${stale.length} re-hashed, ${unlisted.length} added, ${missing.length} removed.`);
