// The source manifest: which files are the application, and their hashes. It is NOT committed (review R2-04): it is
// computed from the git-tracked files of a clean checkout, written into <home>/service/ by scripts/release.mjs, and
// recomputed on the fly by scripts/check-package.mjs. Shared by those two and scripts/refresh-manifest.mjs.
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
export const manifestRows=manifest=>[...manifest.included,...manifest.authored];
export const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
export const trackedFiles=root=>git(root,'ls-files','-z').split('\0').filter(Boolean);

// Every tracked file that exists as a regular file (a symlink is hashed through, as the release copies it through),
// sorted, hashed. Rows keep the `authored`/`candidateSha256` shape so `release.mjs --verify` still reads old homes.
// The text is a pure function of the file contents, so the same tree always gives the same manifestSha256.
export function buildManifest(root){
 const rows=trackedFiles(root).filter(file=>file!==MANIFEST_FILE).filter(file=>{try{return fs.statSync(path.join(root,file)).isFile();}catch{return false;}}).sort()
  .map(file=>({path:file,candidateSha256:sha256(fs.readFileSync(path.join(root,file)))}));
 const manifest={schema:'ar-create.source-manifest.v2',note:'Computed from the git-tracked files of a clean checkout at release time. Not committed.',included:[],authored:rows};
 const text=JSON.stringify(manifest,null,2)+'\n';
 return {manifest,rows,text,sha256:sha256(text)};
}
