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

async function structuralReview(t,{enabled=true,foreign=false,populated=false,photos=false}={}){
 const {createServer}=await import('../runtime/server.mjs');
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'review-empty-folders-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const parentId=randomUUID(),childId=randomUUID();const dataDir=path.join(home,'native');fs.mkdirSync(dataDir);fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify({revision:0,sources:[],collections:[],evidence:[],legacyImported:[],...(populated?{folders:[{id:parentId,domain:'media',name:'Retained parent',parentId:null,sourceIds:[]},{id:childId,domain:'media',name:'Unavailable retained membership',parentId,sourceIds:[randomUUID()]}]}:{})}));let photoIds=[];if(photos){const {createLibrary}=await import('../runtime/services/library.mjs');const library=createLibrary({dataDir});const saved=await library.import({rootId:'library',files:[{name:'photo.png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='},{name:'second.png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='},{name:'note.md',content:'Invented original words.'},{name:'clip.mp4',base64:Buffer.from('00000018667479706d7034320000000069736f6d6d703432','hex').toString('base64')}]});photoIds=saved.receipts.map(r=>r.source.id);}const native=await createServer({dataDir,publicDir:path.resolve('public'),researchEnabled:false});
 await new Promise(r=>native.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{native.closeAllConnections();native.close(r);}));
 const authorityURL='http://127.0.0.1:'+native.address().port;
 await (await fetch(authorityURL+'/api/sources/tree')).json();
 let inspected=dataDir;if(foreign){inspected=path.join(home,'foreign');fs.cpSync(dataDir,inspected,{recursive:true});}
 const configFile=path.join(home,'host.json');fs.writeFileSync(configFile,JSON.stringify({dataDir:inspected}));
 const inspection=createLibraryReviewInspection({configFile});
 let origin;
 const reopen=async()=>{const {server}=await createExistingWorkReview({config:{authorityURL,allowedAuthorityPort:native.address().port,magazineRoots:[],libraryFolderCorrections:enabled},libraryInspection:inspection});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));origin='http://127.0.0.1:'+server.address().port;};
 await reopen();
 const read=async(domain='media')=>{const response=await fetch(origin+'/api/library/folders?domain='+domain);return {status:response.status,...await response.json()};};
 const post=async(input,{route='/api/library/folders',headers={}}={})=>{const response=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(input)});return {status:response.status,...await response.json()};};
 const change=async(action,extra={},domain='media')=>{const current=await read(domain);return post({domain,action,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.indexHash,...extra});};
 return {dataDir,origin,authorityURL,read,post,change,configFile,parentId,childId,photoIds,reopen};
}
test('opt-in same-owner transport creates empty nested groups, guards CAS and permits exact structural Undo',async t=>{
 const f=await structuralReview(t),initial=await f.read();assert.equal(initial.status,200,JSON.stringify(initial));assert.equal(initial.folderStructureWritable,true);assert.equal(initial.folderStructureOnly,true);assert.equal(initial.readOnly,true);assert.equal(initial.folderUndoOperationId,null);
 const create={domain:'media',action:'create',name:'Invented gallery',operationId:randomUUID(),expectedRevision:initial.revision,expectedHash:initial.indexHash};const parent=await f.post(create);assert.equal((await f.post(create)).replayed,true);assert.equal((await f.post({...create,name:'Different request'})).status,409);assert.equal(parent.status,200);assert.equal(parent.schema,'ar-create.library-folders.v1');assert.equal(parent.readOnly,true);assert.equal(parent.folderStructureWritable,true);assert.equal(parent.folderUndoOperationId,parent.receipt.operationId);
 const child=await f.change('create',{name:'Before photos',parentId:parent.selectedFolderId});assert.equal(child.status,200);assert.equal(child.folders.find(r=>r.id===child.selectedFolderId).parentId,parent.selectedFolderId);
 const renamed=await f.change('rename',{folderId:child.selectedFolderId,name:'A considered sequence'});assert.equal(renamed.status,200);
 const stale=await f.post({domain:'media',action:'rename',folderId:child.selectedFolderId,name:'Stale',operationId:randomUUID(),expectedRevision:child.revision,expectedHash:child.indexHash});assert.equal(stale.status,409);
 const moved=await f.change('reparent',{folderId:child.selectedFolderId,parentId:null});assert.equal(moved.status,200);
 const undone=await f.change('undo',{undoOperationId:moved.receipt.operationId});assert.equal(undone.status,200);assert.equal(undone.folders.find(r=>r.id===child.selectedFolderId).parentId,parent.selectedFolderId);assert.equal(undone.folderUndoOperationId,null);
 const removed=await f.change('remove',{folderId:child.selectedFolderId});assert.equal(removed.status,200);assert.equal(removed.folders.length,1);
 assert.equal((await f.change('undo',{undoOperationId:removed.receipt.operationId})).folders.length,2);
 const library=await f.change('create',{name:'Empty research hierarchy'},'library');assert.equal(library.status,200);
 assert.deepEqual(fs.readdirSync(path.join(f.dataDir,'library')),[]);const index=JSON.parse(fs.readFileSync(path.join(f.dataDir,'library-index.json')));assert.deepEqual(index.sources,[]);assert.deepEqual(index.collections,[]);assert.deepEqual(index.evidence,[]);assert.ok(index.folders.every(row=>row.sourceIds.length===0));
});
test('default-disabled and byte-identical foreign Library owners cannot acquire structural authority',async t=>{
 const off=await structuralReview(t,{enabled:false});assert.equal((await off.read()).folderStructureWritable,undefined);assert.equal((await off.read()).folderMembershipWritable,undefined);assert.equal((await off.change('link',{folderId:randomUUID(),sourceIds:[randomUUID()]})).status,423);assert.equal((await off.change('create',{name:'Held'})).status,423);
 const foreign=await structuralReview(t,{foreign:true});assert.equal((await foreign.post({domain:'media',action:'link',folderId:randomUUID(),sourceIds:[randomUUID()],operationId:randomUUID(),expectedRevision:0,expectedHash:'a'.repeat(64)})).status,409);assert.equal((await foreign.read()).status,409);assert.equal((await foreign.post({domain:'media',action:'create',name:'Held',operationId:randomUUID(),expectedRevision:0,expectedHash:'a'.repeat(64)})).status,409);
});
test('structural transport refuses source actions, paths, foreign actors, unknown Undo and changed host config',async t=>{
 const f=await structuralReview(t),current=await f.read(),request={domain:'media',action:'create',name:'Empty only',operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.indexHash};
 for(const input of [{...request,action:'constructor'},{...request,action:'link',folderId:randomUUID(),sourceIds:[randomUUID()]},{...request,sourceIds:[]},{...request,path:'/outside'},{...request,name:'../outside'},{...request,action:'undo',name:undefined,undoOperationId:randomUUID()}]){
  const closed=Object.fromEntries(Object.entries(input).filter(([,v])=>v!==undefined));const result=await f.post(closed);assert.equal(result.status,input.action==='undo'?409:400,JSON.stringify(result));
 }
 assert.equal((await f.post(request,{headers:{Origin:'http://evil.invalid'}})).status,403);assert.equal((await f.post(request,{headers:{'X-AR-Actor':'agent:codex'}})).status,403);assert.equal((await f.post(request,{route:'/api/library/folders?domain=media'})).status,400);
 const nativeRead=await(await fetch(f.authorityURL+'/api/library/folders?domain=media')).json(),outside=await fetch(f.authorityURL+'/api/library/folders',{method:'POST',headers:{Origin:f.authorityURL,'Content-Type':'application/json'},body:JSON.stringify({...request,operationId:randomUUID(),expectedRevision:nativeRead.revision,expectedHash:nativeRead.indexHash,name:'Other entrance'})});assert.equal(outside.status,200);const saved=await outside.json();
 assert.equal((await f.read()).folderUndoOperationId,null);assert.equal((await f.change('undo',{undoOperationId:saved.receipt.operationId})).status,409);
 const before=fs.readFileSync(path.join(f.dataDir,'library-index.json'),'utf8');fs.writeFileSync(f.configFile,JSON.stringify({dataDir:f.dataDir,changed:true}));assert.equal((await f.read()).status,409);assert.equal((await f.post(request)).status,409);assert.equal(fs.readFileSync(path.join(f.dataDir,'library-index.json'),'utf8'),before);
});

test('nonempty groups and their ancestors retain exact existing memberships',async t=>{
 const f=await structuralReview(t,{populated:true}),indexFile=path.join(f.dataDir,'library-index.json'),before=fs.readFileSync(indexFile,'utf8');
 for(const folderId of [f.parentId,f.childId]){
  assert.equal((await f.change('rename',{folderId,name:'Held rename'})).status,409);
  assert.equal((await f.change('reparent',{folderId,parentId:null})).status,409);
  assert.equal((await f.change('remove',{folderId})).status,409);
 }
 assert.equal(fs.readFileSync(indexFile,'utf8'),before);
});

test('structural opt-in cannot grant authority without trusted same-owner inspection',async()=>{
 await assert.rejects(createExistingWorkReview({config:{authorityURL:'http://127.0.0.1:65530',allowedAuthorityPort:65530,magazineRoots:[],libraryFolderCorrections:true}}),/same trusted host inspection/);
});


test('photo memberships are media-only, exact, replay-safe and reversible without editing sources',async t=>{
 const f=await structuralReview(t,{photos:true}),[photo,second,note,video]=f.photoIds;
 const initial=await f.read();assert.equal(initial.folderMembershipWritable,true);assert.equal((await f.read('library')).folderMembershipWritable,undefined);
 const album=await f.change('create',{name:'Invented album'}),folderId=album.selectedFolderId;
 const before=JSON.parse(fs.readFileSync(path.join(f.dataDir,'library-index.json'))),originals=inventory(path.join(f.dataDir,'library'));
 const request={domain:'media',action:'link',folderId,sourceIds:[photo],operationId:randomUUID(),expectedRevision:album.revision,expectedHash:album.indexHash};
 const linked=await f.post(request);assert.equal(linked.status,200,JSON.stringify(linked));assert.deepEqual(linked.folders.find(r=>r.id===folderId).sourceIds,[photo]);assert.equal(linked.folderUndoOperationId,request.operationId);
 assert.equal((await f.post(request)).replayed,true);assert.equal((await f.post({...request,sourceIds:[second]})).status,409);
 assert.equal((await f.post({...request,operationId:randomUUID()})).status,409);
 for(const sourceIds of [[note],[video],[randomUUID()],[photo,photo],[],['publication-alias'],Array(20001).fill(photo)])assert.ok([400,404,409].includes((await f.change('link',{folderId,sourceIds})).status));
 assert.equal((await f.change('link',{folderId,sourceIds:[photo]},'library')).status,400);
 assert.equal((await f.change('move',{folderId,sourceIds:[photo]})).status,400);
 assert.equal((await f.change('rename',{folderId,name:'Populated'})).status,409);
 const undone=await f.change('undo',{undoOperationId:request.operationId});assert.equal(undone.status,200);assert.deepEqual(undone.folders.find(r=>r.id===folderId).sourceIds,[]);
 await f.change('link',{folderId,sourceIds:[photo,second]});const removed=await f.change('unlink',{folderId,sourceIds:[photo]});assert.equal(removed.status,200);assert.deepEqual(removed.folders.find(r=>r.id===folderId).sourceIds,[second]);
 const restored=await f.change('undo',{undoOperationId:removed.receipt.operationId});assert.equal(restored.status,200);assert.deepEqual(restored.folders.find(r=>r.id===folderId).sourceIds,[photo,second]);
 const index=JSON.parse(fs.readFileSync(path.join(f.dataDir,'library-index.json')));for(const key of ['sources','collections','evidence'])assert.deepEqual(index[key],before[key]);assert.deepEqual(inventory(path.join(f.dataDir,'library')),originals);
 fs.unlinkSync(path.join(f.dataDir,'library',index.sources.find(r=>r.id===photo).rel_path));
 assert.ok([404,409].includes((await f.change('unlink',{folderId,sourceIds:[photo]})).status));
});


test('reopened photo membership review cannot replay or Undo another connection receipt',async t=>{
 const f=await structuralReview(t,{photos:true}),album=await f.change('create',{name:'Restart album'}),folderId=album.selectedFolderId;
 const request={domain:'media',action:'link',folderId,sourceIds:[f.photoIds[0]],operationId:randomUUID(),expectedRevision:album.revision,expectedHash:album.indexHash};
 const linked=await f.post(request);assert.equal(linked.status,200);
 await f.reopen();assert.equal((await f.read()).folderUndoOperationId,null);assert.equal((await f.post(request)).status,409);assert.equal((await f.change('undo',{undoOperationId:request.operationId})).status,409);
 const unlinked=await f.change('unlink',{folderId,sourceIds:request.sourceIds});assert.equal(unlinked.status,200);
 const current=await f.read(),unlink={domain:'media',action:'link',folderId,sourceIds:request.sourceIds,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.indexHash};
 const added=await f.post(unlink);assert.equal(added.status,200);assert.equal((await f.post(unlink)).replayed,true);
 const before=fs.readFileSync(path.join(f.dataDir,'library-index.json'),'utf8');
 for(const extra of [{sourceIds:[f.photoIds[0]],name:'Unexpected'},{sourceIds:[f.photoIds[0]],path:'../photo.png'},{sourceIds:[f.photoIds[0]],parentId:null}])assert.equal((await f.change('unlink',{folderId,...extra})).status,400);
 assert.equal(fs.readFileSync(path.join(f.dataDir,'library-index.json'),'utf8'),before);
});

test('photo album gateway uses native exact selectors, connection Undo and same-owner admission',async t=>{
 const f=await structuralReview(t,{photos:true}),album=await f.change('create',{name:'Catalog album'}),folderId=album.selectedFolderId;
 const catalog=await(await fetch(f.authorityURL+'/api/magazine/library-photos')).json(),item=catalog.items.find(row=>row.sourceId===f.photoIds[0]);assert.ok(item);
 const photo=Object.fromEntries(['rootId','sourceId','revision','sourceHash'].map(key=>[key,item[key]])),route='/api/magazine/library-photos/album';
 const originalIndex=JSON.parse(fs.readFileSync(path.join(f.dataDir,'library-index.json'))),originalFiles=inventory(path.join(f.dataDir,'library'));
 const request={action:'link',folderId,operationId:randomUUID(),expectedRevision:album.revision,expectedHash:album.indexHash,photo};
 const linked=await f.post(request,{route});assert.equal(linked.status,200,JSON.stringify(linked));assert.equal(linked.receipt.action,'linkPhoto');assert.equal(linked.folderMembershipWritable,true);assert.equal(linked.folderUndoOperationId,request.operationId);
 assert.equal((await f.post(request,{route})).replayed,true);assert.equal((await f.post({...request,photo:{...photo,sourceHash:'a'.repeat(64)}},{route})).status,409);
 const undone=await f.change('undo',{undoOperationId:request.operationId});assert.equal(undone.status,200);assert.deepEqual(undone.folders.find(row=>row.id===folderId).sourceIds,[]);assert.equal(undone.folders.find(row=>row.id===folderId).photoRefs?.length||0,0);
 const current=await f.read(),fresh={...request,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.indexHash};
 for(const input of [{...fresh,domain:'media'},{...fresh,action:'move'},{...fresh,photo:{...photo,path:'/outside'}},{...fresh,photo:{...photo,sourceId:'publication-alias'}},{...fresh,photo:{...photo,rootId:'b'.repeat(64)}}]){const denied=await f.post(input,{route});assert.ok([400,404,409].includes(denied.status),JSON.stringify({input,denied}));}
 for(const headers of [{Origin:'http://evil.invalid'},{'X-AR-Actor':'agent:codex'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.post(fresh,{route,headers})).status,403);
 assert.equal((await f.post(fresh,{route:route+'?x=1'})).status,400);
 const relinked=await f.post(fresh,{route});assert.equal(relinked.status,200);const exactMembership=relinked.folders.find(row=>row.id===folderId);
 for(const action of ['rename','reparent','remove'])assert.equal((await f.change(action,{folderId,...action==='rename'?{name:'Blocked'}:action==='reparent'?{parentId:null}:{}})).status,409);
 const unlink={...fresh,action:'unlink',operationId:randomUUID(),expectedRevision:relinked.revision,expectedHash:relinked.indexHash},unlinked=await f.post(unlink,{route});assert.equal(unlinked.status,200,JSON.stringify(unlinked));assert.equal(unlinked.receipt.action,'unlinkPhoto');assert.equal((await f.post(unlink,{route})).replayed,true);
 const restored=await f.change('undo',{undoOperationId:unlink.operationId});assert.equal(restored.status,200);assert.deepEqual(restored.folders.find(row=>row.id===folderId),exactMembership);
 const after=JSON.parse(fs.readFileSync(path.join(f.dataDir,'library-index.json')));for(const key of ['sources','collections','evidence'])assert.deepEqual(after[key],originalIndex[key]);assert.deepEqual(inventory(path.join(f.dataDir,'library')),originalFiles);
 const off=await structuralReview(t,{enabled:false});assert.equal((await off.post(fresh,{route})).status,423);
 const foreign=await structuralReview(t,{foreign:true});assert.equal((await foreign.post(fresh,{route})).status,409);
 await f.reopen();assert.equal((await f.change('undo',{undoOperationId:request.operationId})).status,409);
});
