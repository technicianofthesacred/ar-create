import {build} from 'esbuild';import path from 'node:path';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const front=path.resolve(runtime,'../public/document-study');
await build({absWorkingDir:runtime,entryPoints:['src/workspaces/article-codec.ts'],outfile:'article-codec.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',logLevel:'warning'});
await build({absWorkingDir:runtime,entryPoints:['src/native/correspondence.ts'],outfile:'services/draft-correspondence.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',logLevel:'warning'});
// Regenerate browser wrappers from maintained source, not copied bundles.
const original=await fs.readFile(path.join(front,'donor/ig-original-catalog.source.mjs'),'utf8');
await fs.writeFile(path.join(front,'donor/layouts.js'),'const ORIGINAL_LAYOUTS = '+await fs.readFile(path.join(front,'donor/ig-original-layouts.json'),'utf8')+';\n');
await fs.writeFile(path.join(front,'donor/catalog-browser.js'),original.replace(/^import layouts .*;$/m,'const layouts = ORIGINAL_LAYOUTS;').replaceAll('export function ','function ').replace('export const originalCatalog','const originalCatalog').replace('export default originalCatalog;',''));
const templates=await fs.readFile(path.join(front,'donor/ig-templates.js'),'utf8');
await fs.writeFile(path.join(front,'donor/ig-templates.browser.js'),templates.replace(/^import .*originalCatalog.*;$/m,'').replace('export default IG;','window.STUDY_CATALOG = IG.T;'));
await build({absWorkingDir:runtime,entryPoints:['../scripts/gen-capabilities-portable.ts'],outfile:'../scripts/gen-capabilities.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',logLevel:'warning'});
console.log('Document-study runtime and template wrappers built from reviewed source.');

await import('./build-native-output-owner.mjs');
await import('./build-media-article-spec.mjs');
await import('./build-study-output-canvas.mjs');
