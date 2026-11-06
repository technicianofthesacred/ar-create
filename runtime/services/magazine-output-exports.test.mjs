import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {digest} from './files.mjs';
import {createExports,createExportAssetReader} from './exports.mjs';
import {createMagazineOutputExports} from './magazine-output-exports.mjs';
import {createMagazineMediaInspection} from '../../scripts/magazine-media-inspection.mjs';
import {prepareMagazineHtml} from './render-helper.mjs';
function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mag-export-'))),repoRoot=path.join(dataDir,'publication'),vault=path.join(dataDir,'vault');fs.mkdirSync(repoRoot);fs.mkdirSync(vault);t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 let raw='---\ntype: DEV\ntitle: Invented edition\n---\n\nFirst exact words 瓷 😀.\n\nSecond exact words.\n',root=digest(vault),drift=false;
 const roots=[{id:'invented-root',path:vault}],relative='Workflow/3-Develop/DEV - Invented.md';
 const working={catalog:()=>({registered:true,rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:root}}),read:async q=>{const r={selection:{...q},authority:{kind:'magazine',storyId:q.storyId,pieceId:q.pieceId,path:relative,title:'Invented edition'},document:{text:raw,hash:digest(raw)}};if(drift){raw+=' changed';drift=false;}return r;}};
 const make=({historicalOnly=false}={})=>createMagazineOutputExports({working,exports:createExports({dataDir}),...historicalOnly?{}:{repoRoot,roots}});
 const input=()=>({storyId:'story',pieceId:'article',expectedHash:digest(raw)});
 async function prepare(){const selection=input(),media=createMagazineMediaInspection({repoRoot,resolveWorking:async q=>({...await working.read(q),target:{nativeProjectId:'story',artifactId:'mag_'+digest(roots[0].id+'\0'+vault+'\0'+relative),hash:q.expectedHash}})}),edition=await media.workingEdition(selection);return {...selection,renderRevision:edition.revision,name:'invented.html',body:await prepareMagazineHtml(edition,{origin:'http://localhost',readAsset:createExportAssetReader()})};}
 return {dataDir,make,input,prepare,edit(){raw+=' later';},root(){root='b'.repeat(64);},drift(){drift=true;}};
}
test('server-rendered Magazine HTML binds exact Unicode words and styles, preserves earlier bytes across a later edition and restart',async t=>{
 const f=fixture(t),service=f.make(),input=await f.prepare(),saved=await service.save(input),body=input.body;
 assert.equal(saved.artifact.hash,digest(body));assert.equal(saved.artifact.contentVerification,'server-rendered-exact-edition');assert.equal(saved.artifact.renderBinding.bodyHash,digest(body));assert.ok(saved.artifact.renderBinding.assets.some(a=>a.url.endsWith('.woff2')));assert.match(body,/First exact words 瓷 😀/);assert.ok(body.indexOf('First exact words')<body.indexOf('Second exact words'));assert.equal(saved.artifact.exportKind,'magazine-working-html');assert.equal(saved.artifact.sourceBinding.sourceHash,input.expectedHash);assert.equal(saved.artifact.deliveryState,'created');assert.equal(saved.artifact.publicationProof,undefined);
 assert.equal(fs.readFileSync((await service.file({...f.input(),exportId:saved.artifact.id})).file,'utf8'),body);
 assert.equal((await f.make().list(f.input())).artifacts[0].stale,false);assert.equal((await service.list({...f.input(),pieceId:'carousel'})).artifacts.length,0);
 f.edit();const next=await service.save(await f.prepare());assert.notEqual(next.artifact.hash,saved.artifact.hash);const list=await f.make().list(f.input());assert.equal(list.artifacts.find(a=>a.id===saved.artifact.id).stale,true);
 assert.equal(fs.readFileSync((await f.make().file({storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash,exportId:saved.artifact.id})).file,'utf8'),body);f.root();assert.equal((await f.make().list(f.input())).artifacts.length,0);
});
test('refuses unrelated HTML with valid source/render hashes, forged styles, stale source, source race and altered retained files',async t=>{
 const f=fixture(t),service=f.make(),input=await f.prepare();
 for(const replacement of ['<!doctype html><html>Unrelated words</html>',input.body.replace('First exact words','Forged replacement'),input.body.replace('font-family','forged-family')])await assert.rejects(service.save({...input,body:replacement}),/do not match/);
 await assert.rejects(service.save({...input,expectedHash:'d'.repeat(64)}));await assert.rejects(service.save({...input,path:'/elsewhere'}));await assert.rejects(service.save({...input,renderRevision:'d'.repeat(64)}),/render revision/);f.drift();await assert.rejects(service.save(input));assert.equal(fs.readdirSync(path.join(f.dataDir,'exports')).length,0);
 const saved=await service.save(await f.prepare());fs.writeFileSync(saved.artifact.path,'changed');await assert.rejects(service.file({...f.input(),exportId:saved.artifact.id}),/bytes changed/);
});

test('historical unverified manifests keep exact downloads without a current renderer configuration',async t=>{
 const f=fixture(t),input=await f.prepare(),saved=await f.make().save(input),manifest={...saved.artifact,contentVerification:'caller-supplied-bytes-not-render-verified'};delete manifest.renderBinding;
 fs.writeFileSync(path.join(path.dirname(saved.artifact.path),'.manifest.json'),JSON.stringify(manifest));
 f.edit();const historical=f.make({historicalOnly:true}),listed=await historical.list(f.input());assert.equal(listed.artifacts[0].stale,true);assert.equal(listed.artifacts[0].contentVerification,'caller-supplied-bytes-not-render-verified');assert.equal(listed.artifacts[0].renderBinding,undefined);
 const read=await historical.file({storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash,exportId:manifest.id});assert.equal(fs.readFileSync(read.file,'utf8'),input.body);await assert.rejects(historical.save(await f.prepare()),/not configured/);
});
