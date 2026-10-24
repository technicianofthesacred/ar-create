import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {createLibraryReviewInspection} from '../scripts/library-review-inspection.mjs';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
function inventory(root){const rows=[];function walk(file){const s=fs.lstatSync(file);rows.push([path.relative(root,file),s.ino,s.mtimeMs,s.ctimeMs,s.size,s.isFile()?hash(fs.readFileSync(file)):null]);if(s.isDirectory())for(const n of fs.readdirSync(file).sort())walk(path.join(file,n));}walk(root);return rows;}
test('review connects exact folder, catalog, collection and source readers without upstream discovery or filesystem writes',async t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'review-library-pure-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));const dataDir=path.join(home,'data');fs.mkdirSync(path.join(dataDir,'library'),{recursive:true});fs.mkdirSync(path.join(dataDir,'recordings'));
 const id=randomUUID(),collectionId=randomUUID(),raw='# Invented learning\n\nA finding worth understanding.\n',file=path.join(dataDir,'library','learning.md');fs.writeFileSync(file,raw);fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify({revision:3,sources:[{id,rootId:'library',rel_path:'learning.md',title:'Invented learning',kind:'note',hash:hash(raw)}],collections:[{id:collectionId,name:'Invented inquiry',sourceIds:[id]}],evidence:[]}));
 const configFile=path.join(home,'host.json');fs.writeFileSync(configFile,JSON.stringify({dataDir}));const before=inventory(home),inspection=createLibraryReviewInspection({configFile});let discoveryCalls=0;
 const {reader,server}=await createExistingWorkReview({config:{authorityURL:'http://127.0.0.1:65530',allowedAuthorityPort:65530,magazineRoots:[]},libraryInspection:inspection,fetchImpl:async url=>{if(new URL(url).pathname==='/api/sources/tree')discoveryCalls++;return {ok:true,json:async()=>({sessions:[],pieces:[],drafts:[],collections:[]})};}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const origin='http://127.0.0.1:'+server.address().port;
 const read=async route=>{const r=await fetch(origin+route);assert.equal(r.status,200,route);return r.json();};
 const folder=await read('/api/library/folders?domain=library');assert.equal(folder.readOnly,true);assert.equal(folder.sources[0].id,id);assert.deepEqual(folder.folders,[]);
 const catalog=await reader.catalog();assert.equal(catalog.sources[0].id,id);assert.equal(discoveryCalls,0);
 const snapshot=await read('/api/sources/tree');assert.equal(snapshot.sources[0].id,id);assert.match(snapshot.indexHash,/^[a-f0-9]{64}$/);
 const body=await read('/api/sources/file?id='+id);assert.equal(body.raw,raw);assert.equal(body.hash,hash(raw));assert.equal(body.readOnly,true);
 const collections=await read('/api/collections');assert.equal(collections.collections[0].id,collectionId);assert.deepEqual(collections.collections[0].sourceIds,[id]);
 assert.deepEqual((await read('/api/evidence')).cards,[]);assert.deepEqual((await read('/api/collection-relationships?collectionId='+collectionId)).relationships,[]);
 assert.equal((await fetch(origin+'/api/sources/file?id='+id+'&path=/outside')).status,400);assert.equal((await fetch(origin+'/api/library/folders?domain=library&domain=media')).status,400);
 const boot=await(await fetch(origin+'/document-study/package-config.js')).text();assert.match(boot,/catalogCacheScope/);assert.ok(!boot.includes(dataDir));assert.deepEqual(inventory(home),before);
 fs.writeFileSync(file,raw+'Outside change\n');assert.equal((await fetch(origin+'/api/sources/file?id='+id)).status,409);
 fs.writeFileSync(configFile,JSON.stringify({dataDir,changed:true}));await assert.rejects(inspection.tree(),/connection changed/);
});
