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

test('insertion preserves legacy exact origin and distinct equal-byte Library UUIDs with idempotent retained identities',async t=>{
 const f=await fixture(t);await f.library.import({rootId:'library',files:[{name:'equal-bytes-other.png',base64:png.toString('base64')}]});const catalog=await f.service.catalog(),a=catalog.items.find(row=>row.name==='owned.png'),b=catalog.items.find(row=>row.name==='equal-bytes-other.png');assert.notEqual(a.sourceId,b.sourceId);assert.equal(a.sourceHash,b.sourceHash);
 const legacy=await f.service.retain(pick(a)),againA=await f.service.retainInsertion(pick(a));assert.equal(againA.file,legacy.file);assert.equal(againA.sourceId,legacy.sourceId);assert.equal(await f.service.insertionFile(pick(a)),legacy.file);
 const savedB=await f.service.retainInsertion(pick(b)),againB=await f.service.retainInsertion(pick(b));assert.notEqual(savedB.file,legacy.file);assert.notEqual(savedB.sourceId,legacy.sourceId);assert.equal(savedB.sourceId,againB.sourceId);assert.equal(savedB.file,againB.file);assert.match(savedB.file,/^library-photo-[a-f0-9]{64}-[a-f0-9]{64}\.png$/);assert.equal('body' in savedB,false);
 const refreshed=await f.service.catalog(),newB=refreshed.items.find(row=>row.sourceId===b.sourceId);assert.equal((await f.service.retainInsertion(pick(newB))).sourceId,savedB.sourceId);
 const reopened=createMagazineLibraryPhotos({library:createLibrary({dataDir:f.data,connections:f.connections}),originals:f.originals,publication:f.publication});for(const saved of [legacy,savedB]){const resolved=await reopened.resolve({file:saved.file});assert.equal(resolved.sourceId,saved.sourceId);assert.deepEqual(resolved.body,png);}
 const index=JSON.parse(fs.readFileSync(path.join(f.data,'library-index.json'))),retained=index.sources.filter(row=>row.provenance?.kind==='magazine-library-photo');assert.equal(retained.length,2);assert.equal(retained.find(row=>row.id===legacy.sourceId).provenance.origin.sourceId,a.sourceId);assert.equal(retained.find(row=>row.id===savedB.sourceId).provenance.origin.sourceId,b.sourceId);
});

test('retained-origin metadata is bounded and immutable insertion bytes resolve after mutable copies change or disappear',async t=>{
 const f=await fixture(t),catalog=await f.service.catalog(),asset=catalog.items.find(row=>row.name==='owned.png'),saved=await f.service.retainInsertion(pick(asset)),indexFile=path.join(f.data,'library-index.json'),index=JSON.parse(fs.readFileSync(indexFile)),retained=index.sources.find(row=>row.id===saved.sourceId),mutable=path.join(f.data,'library',retained.rel_path);
 retained.provenance.origin.path='/private/unrelated';retained.provenance.origin.title='Never project';retained.provenance.originRef.path='/private/another';fs.writeFileSync(indexFile,JSON.stringify(index));
 const metadata=(await f.library.photosSnapshot()).items.find(row=>row.id===saved.sourceId);assert.deepEqual(Object.keys(metadata.retainedOrigin).sort(),['revision','rootId','sourceHash','sourceId']);assert.deepEqual(Object.keys(metadata.retainedOriginRef).sort(),['kind','rootId','sourceId']);assert.equal(JSON.stringify(metadata).includes('/private/'),false);assert.equal(metadata.retainedOrigin.sourceId,asset.sourceId);
 fs.writeFileSync(mutable,jpeg);let resolved=await f.service.resolve({file:saved.file});assert.deepEqual(resolved.body,png);assert.equal(resolved.originRef.sourceId,asset.sourceId);fs.unlinkSync(mutable);resolved=await f.service.resolve({file:saved.file});assert.deepEqual(resolved.body,png);assert.equal(resolved.originRef.sourceId,asset.sourceId);
});

test('an extended token refuses changed recorded origin and occupied unowned retained filenames without overwriting',async t=>{
 const f=await fixture(t),catalog=await f.service.catalog(),a=catalog.items.find(r=>r.name==='owned.png'),selector=pick(a),filename=await f.service.insertionFile(selector),bare=filename.slice('library-photo-'.length);
 // An unrelated existing owner record at the target name must stay unchanged.
 await f.library.retainAlbumPhoto({folder:'Magazine photos',name:bare,bytes:png,provenance:{kind:'other-retention'}});await assert.rejects(f.service.retainInsertion(selector),/occupied/);
 const other=await fixture(t),asset=(await other.service.catalog()).items.find(r=>r.name==='owned.png'),saved=await other.service.retainInsertion(pick(asset)),indexFile=path.join(other.data,'library-index.json'),index=JSON.parse(fs.readFileSync(indexFile));index.sources.find(r=>r.id===saved.sourceId).provenance.origin.sourceId='12345678-1234-1234-1234-123456789abc';fs.writeFileSync(indexFile,JSON.stringify(index));await assert.rejects(other.service.resolve({file:saved.file}),/origin changed/);
});
