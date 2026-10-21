// The reviewed-source manifest (source-manifest.json): which files are the application, and their hashes.
// Shared by scripts/check-package.mjs, scripts/refresh-manifest.mjs and scripts/release.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const MANIFEST_FILE='source-manifest.json';
// Built from reviewed source by `npm run build` (runtime/scripts/build-document-study.mjs); never committed.
// The release builds them inside the staging folder, so a release may contain exactly these beyond the manifest.
export const GENERATED=new Set(['runtime/services/media-article-spec.mjs','scripts/gen-capabilities.mjs','runtime/article-codec.mjs','runtime/services/draft-correspondence.mjs','public/document-study/donor/layouts.js','public/document-study/donor/catalog-browser.js','public/document-study/donor/ig-templates.browser.js','runtime/services/native-output-helpers.mjs','runtime/services/native-output-owner.test.mjs','runtime/services/render-helper.mjs','runtime/public/assets/study-output-canvas.js','runtime/public/assets/study-output-canvas.css']);
// The server cannot start without these; a release that did not produce them is refused.
export const REQUIRED_GENERATED=['runtime/article-codec.mjs','runtime/services/draft-correspondence.mjs','runtime/services/media-article-spec.mjs','runtime/services/native-output-helpers.mjs','runtime/services/render-helper.mjs','runtime/public/assets/study-output-canvas.js','public/document-study/donor/layouts.js','public/document-study/donor/catalog-browser.js','public/document-study/donor/ig-templates.browser.js'];
// Source that is reviewed and versioned but is not shipped to the installed service.
export const NOT_SHIPPED=path=>/^(tests|todo)\//.test(path)||/(^|\/)[^/]+\.test\.[cm]?[jt]sx?$/.test(path)||path==='TODO.md'||path==='.gitignore';
// Generated files the release removes again after building (build inputs for tests, developer tooling).
export const PRUNE_AFTER_BUILD=path=>NOT_SHIPPED(path)||path==='scripts/gen-capabilities.mjs';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const readManifest=root=>JSON.parse(fs.readFileSync(path.join(root,MANIFEST_FILE),'utf8'));
export const manifestRows=manifest=>[...manifest.included,...manifest.authored];
export const manifestSha256=root=>sha256(fs.readFileSync(path.join(root,MANIFEST_FILE)));
export const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:64*1024*1024});
export const trackedFiles=root=>git(root,'ls-files','-z').split('\0').filter(Boolean);

// Compare the manifest with the checkout: stale hashes, missing files, tracked files nobody reviewed.
export function compareManifest(root){
 const manifest=readManifest(root),rows=manifestRows(manifest),listed=new Set(rows.map(row=>row.path));
 const stale=[],missing=[];
 for(const row of rows){
  const file=path.join(root,row.path);
  if(!fs.existsSync(file)){missing.push(row.path);continue;}
  if(sha256(fs.readFileSync(file))!==row.candidateSha256)stale.push(row.path);
 }
 const unlisted=trackedFiles(root).filter(file=>file!==MANIFEST_FILE&&!listed.has(file)&&fs.existsSync(path.join(root,file)));
 return {manifest,rows,stale,missing,unlisted};
}
