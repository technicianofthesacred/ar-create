import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createLibrary} from '../runtime/services/library.mjs';
import {createReviewMedia} from '../runtime/services/review-media.mjs';
import {createMagazineLibraryPhotos} from '../runtime/services/magazine-library-photos.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6uxsAAAAASUVORK5CYII=','base64');
const jpeg=Buffer.from([255,216,255,224,0,1,2,3]);
const pick=row=>Object.fromEntries(['rootId','sourceId','revision','sourceHash'].map(key=>[key,row[key]]));
function snapshot(root){const result=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name),stat=fs.lstatSync(file);result.push([path.relative(root,file),stat.ino,stat.mtimeMs,stat.size,item.isFile()?sha(fs.readFileSync(file)):null]);if(item.isDirectory())walk(file);}}walk(root);return result;}
async function fixture(t){const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-photo-library-')));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));const data=path.join(home,'private'),connected=path.join(home,'connected'),files=path.join(home,'Files');for(const dir of [data,connected,files])fs.mkdirSync(dir);fs.writeFileSync(path.join(connected,'unplaced.png'),png);fs.mkdirSync(path.join(files,'Other story','Photos'),{recursive:true});fs.writeFileSync(path.join(files,'Other story','Photos','never-used.jpg'),jpeg);const connections=[{id:'connected',name:'Connected photographs',path:connected}],library=createLibrary({dataDir:data,connections});await library.import({rootId:'library',files:[{name:'owned.png',base64:png.toString('base64')} ]});await library.tree();const publicationRow={rootId:sha('publication-root'),sourceId:sha('unplaced-publication'),revision:sha('publication-edition'),sourceHash:sha(jpeg),name:'publication-unused.jpg',description:'Trusted published description',contentType:'image/jpeg',bytes:jpeg.length,storyLabel:'Another article',relativePath:'CONVERSATIONS/another/images/unused.jpg'};const publication={catalog:async()=>({items:[publicationRow],coverage:{complete:true}}),preview:async selector=>{assert.deepEqual(selector,pick(publicationRow));return {body:jpeg,hash:sha(jpeg),contentType:'image/jpeg',description:publicationRow.description};}};const originals=createReviewMedia({filesRoot:files});return {home,data,connected,files,connections,library,originals,publication,service:createMagazineLibraryPhotos({library,originals,publication})};}

test('all existing Library roots, cross-story originals and unused publication photos share a pure exact-byte catalog',async t=>{
 const f=await fixture(t),before=snapshot(f.home),catalog=await f.service.catalog();
 assert.equal(catalog.schema,'ar-create.magazine-library-photos.v1');assert.equal(catalog.coverage.complete,true);assert.equal(catalog.items.length,4);
 assert.deepEqual(new Set(catalog.items.map(row=>row.sourceLabel)),new Set(['My library','Connected photographs','Original photos','Publication photos']));
 assert.ok(catalog.items.some(row=>row.storyLabel==='Other story'));assert.ok(catalog.items.some(row=>row.name==='publication-unused.jpg'));
 for(const row of catalog.items){assert.match(row.rootId,/^[a-f0-9]{64}$/);const opened=await f.service.preview(pick(row));assert.equal(sha(opened.body),row.sourceHash);assert.equal(opened.contentType,row.contentType);assert.equal('path' in row,false);assert.equal('originalUrl' in row,false);assert.equal('body' in row,false);}
 for(const row of catalog.items){assert.ok(row.originRef);assert.equal(row.originRef.rootId,row.rootId);if(row.sourceLabel==='Publication photos')assert.deepEqual(row.originRef,{kind:'publication',rootId:row.rootId,relativePath:row.relativePath});else assert.deepEqual(row.originRef,{kind:row.sourceLabel==='Original photos'?'originals':'library',rootId:row.rootId,sourceId:row.sourceId});}
 assert.deepEqual(snapshot(f.home),before,'catalog and previews do not create or rewrite Library/private files');
});

test('explicit Use retains through Library once and immutable resolution survives changed mutable copy, restart and removed origin',async t=>{
 const f=await fixture(t),catalog=await f.service.catalog(),row=catalog.items.find(row=>row.sourceLabel==='Original photos'),original=path.join(f.files,'Other story','Photos','never-used.jpg'),before=fs.readFileSync(original),selection=pick(row);
 const saved=await f.service.retain(selection),again=await f.service.retain(selection);assert.equal(saved.file,`library-photo-${sha(jpeg)}.jpg`);assert.equal(saved.sourceId,again.sourceId);assert.deepEqual(fs.readFileSync(original),before);
 const index=JSON.parse(fs.readFileSync(path.join(f.data,'library-index.json'))),retained=index.sources.filter(source=>source.provenance?.kind==='magazine-library-photo');assert.equal(retained.length,1);assert.equal(retained[0].id,saved.sourceId);assert.equal('body' in saved,false);
 fs.writeFileSync(path.join(f.data,'library',retained[0].rel_path),png);fs.unlinkSync(original);
 const restarted=createLibrary({dataDir:f.data,connections:f.connections}),service=createMagazineLibraryPhotos({library:restarted});await restarted.tree();
 const resolved=await service.resolve({file:saved.file});assert.deepEqual(resolved.body,jpeg);assert.equal(resolved.sourceId,saved.sourceId);assert.equal(resolved.hash,sha(jpeg));assert.equal(resolved.description,'');assert.equal('path' in resolved,false);
 await assert.rejects(service.resolve({file:'../../secret.jpg'}),/token/);await assert.rejects(service.resolve({file:saved.file,path:'/etc/passwd'}),/token/);
});

test('changed bytes, source revisions, roots and arbitrary selector paths are refused',async t=>{
 const f=await fixture(t),catalog=await f.service.catalog(),owned=catalog.items.find(row=>row.sourceLabel==='My library'),connected=catalog.items.find(row=>row.sourceLabel==='Connected photographs'),original=catalog.items.find(row=>row.sourceLabel==='Original photos');
 await assert.rejects(f.service.preview({...pick(owned),file:'/etc/passwd'}),/identity/);await assert.rejects(f.service.preview({...pick(owned),sourceHash:sha('other')}),/stale/);
 fs.writeFileSync(path.join(f.data,'library','owned.png'),jpeg);await assert.rejects(f.service.preview(pick(owned)),/changed/);
 fs.writeFileSync(path.join(f.files,'Other story','Photos','never-used.jpg'),png);await assert.rejects(f.service.retain(pick(original)),/changed/);
 fs.renameSync(f.connected,f.connected+'-old');fs.mkdirSync(f.connected);fs.writeFileSync(path.join(f.connected,'unplaced.png'),png);await assert.rejects(f.service.preview(pick(connected)),/root changed/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.data,'library-index.json'))).sources.some(source=>source.provenance?.kind==='magazine-library-photo'),false);
});

test('invalid image bytes, symlinks and hardlinks cannot become selectable photo assets',async t=>{
 const f=await fixture(t);fs.writeFileSync(path.join(f.connected,'invalid.png'),'not an image');await f.library.tree();
 fs.linkSync(path.join(f.connected,'unplaced.png'),path.join(f.connected,'linked.png'));
 const result=await f.service.catalog();assert.equal(result.coverage.complete,false);assert.ok(result.coverage.skipped>=2);assert.equal(result.items.some(row=>['invalid.png','unplaced.png','linked.png'].includes(row.name)),false);
 const owned=result.items.find(row=>row.sourceLabel==='My library');const physical=path.join(f.data,'library','owned.png');fs.unlinkSync(physical);fs.symlinkSync('/etc/passwd',physical);await assert.rejects(f.service.preview(pick(owned)),/Symlink|regular/);
});

test('trusted publication description carries into retained asset without borrowing another target description',async t=>{
 const f=await fixture(t),catalog=await f.service.catalog(),row=catalog.items.find(row=>row.sourceLabel==='Publication photos');const saved=await f.service.retain(pick(row));assert.equal(saved.description,'Trusted published description');assert.equal((await f.service.resolve({file:saved.file})).description,saved.description);
});


test('a corrupted immutable original refuses replay and resolution without making another Library copy',async t=>{
 const f=await fixture(t),catalog=await f.service.catalog(),row=catalog.items.find(row=>row.sourceLabel==='Original photos'),saved=await f.service.retain(pick(row));
 const indexFile=path.join(f.data,'library-index.json'),index=JSON.parse(fs.readFileSync(indexFile)),source=index.sources.find(row=>row.id===saved.sourceId);fs.writeFileSync(source.originalFile,png);
 await assert.rejects(f.service.resolve({file:saved.file}),/changed/);await assert.rejects(f.service.retain(pick(row)),/changed/);
 assert.equal(JSON.parse(fs.readFileSync(indexFile)).sources.filter(row=>row.provenance?.kind==='magazine-library-photo').length,1);
});

test('oversized sources and unsafe descriptions are disclosed or blank without requiring user cleanup',async t=>{
 const f=await fixture(t),big=path.join(f.connected,'too-big.png');fs.writeFileSync(big,png);fs.truncateSync(big,20*1024*1024+1);await f.library.tree();
 const provider=f.publication.catalog;f.publication.catalog=async()=>{const result=await provider();return {...result,items:result.items.map(row=>({...row,description:'Incorrect%metadata\n',privatePath:'/secret',body:png}))};};
 const result=await f.service.catalog();assert.equal(result.coverage.complete,false);assert.ok(result.coverage.issues.some(row=>row.reason==='photo-size-limit'));assert.equal(result.items.some(row=>row.name==='too-big.png'),false);
 const published=result.items.find(row=>row.sourceLabel==='Publication photos');assert.equal(published.description,'');assert.equal('privatePath' in published,false);assert.equal('body' in published,false);
});
