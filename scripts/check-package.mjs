// verify:package — the tracked tree contains only application source: no private data, no machine-specific paths.
// The manifest is computed from `git ls-files` on the fly (it is not a committed file), so there is nothing to refresh.
import {GENERATED,MANIFEST_FILE,buildManifest} from './lib/manifest.mjs';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const {rows}=buildManifest(root);
const forbidden=/(?:^|\/)(?:user-data|qa-data|before-[^/]*|node_modules|recordings|manuscripts|photos|captures|exports|backups)(?:\/|$)|workflow-records\.js$|reference-data\.js$|\.env(?:\.|$)|serializer-donor-fixtures\.json$/;
const leaks=/\/Users\/|\/Volumes\/|\/opt\/homebrew|\.codex\/visualizations|\.venv-transcription|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|Local connection verification\.|At the base of the Wuyi|Yan Jinwen|Mathew|wet-storage teas|living in the present|Real Porcelain current DEV|Index snapshot read|prepared private message|CAROUSEL - Hong Kong/;
for(const file of rows){if(forbidden.test(file.path))throw Error('Forbidden tracked file: '+file.path);if(!['scripts/check-package.mjs','tests/package.test.mjs'].includes(file.path)&&!/\.(ttf|woff2)$/.test(file.path)&&leaks.test(fs.readFileSync(path.join(root,file.path),'utf8')))throw Error('Private or machine-specific content: '+file.path);}
console.log(`Package check: ${rows.length} tracked source files computed from git; private/generated data excluded.`);

const allowed=new Set(rows.map(row=>row.path).concat(MANIFEST_FILE));
const generated=GENERATED;
function inspect(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=relative?relative+'/'+entry.name:entry.name;if(entry.name==='node_modules'||(!relative&&entry.name==='.git'))continue;if(entry.isDirectory())inspect(path.join(dir,entry.name),name);else if(!allowed.has(name)&&!generated.has(name))throw Error('File outside the tracked package allowlist: '+name);}}
inspect(root);
