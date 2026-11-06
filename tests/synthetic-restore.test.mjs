import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {coherentFixture,op,words,sourceRevision} from './helpers/coherent-journey-fixture.mjs';
import {syntheticSnapshot,restoreSynthetic} from './helpers/coherent-journey-restore.mjs';
import {createServer} from '../runtime/server.mjs';
import {createWorkspaceExecution} from '../runtime/services/artifact-execution.mjs';
import {outputMarkdown} from '../runtime/services/render-helper.mjs';
import {digest} from '../runtime/services/files.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';

test('bounded clean-home restore: same native IDs, words, decisions, pending proposals, history, exports and exact Undo',async t=>{
 const f=await coherentFixture(t),base=await f.native(),operationId=op();
 const edit=await f.request('/api/study-draft/save',{...f.scope,expected:base.expected,operationId,operations:[{kind:'insert',id:op(),beforeId:null,raw:'Invented saved edit eligible for Undo after restoration.'}]},200,'human:adrian');
 await f.consent('people/answer',{personId:f.person.id,state:'yes'},'human:adrian');
 const ar=await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.article.output.id}));
 const current=(await f.request('/api/study/outputs/refresh',{...f.group,selectedOutputId:ar.output.id,expectedOutput:ar.expectedOutput,expectedNative:ar.writingProof.expected,operationId:op()})).view;
 const body=outputMarkdown({id:f.scope.bindingId,title:current.output.title,revision:current.output.manuscriptRevision,paragraphs:current.output.manuscript,outputs:[current.output]},current.output);
 const exported=await f.request('/api/study/outputs/export',{...f.group,selectedOutputId:current.output.id,kind:'article',expectedOutput:current.expectedOutput,expectedNative:current.writingProof.expected,manuscriptRevision:current.output.manuscriptRevision,name:'Restored invented Article',mimeType:'text/markdown',body});
 const shareScope={...f.group,selectedOutputId:current.output.id,recipientId:op(),deliveredExportId:exported.artifact.id},share=await f.request(f.query('/api/study/share',shareScope));
 const invitation=await f.request('/api/study/share/save',{...shareScope,operationId:op(),expected:share.expected,expectedEdition:share.currentEdition,changes:{recipient:'Invented restore reader',message:'Read the retained cup edition; leave uncertainty intact.'}},200,'human:adrian');
 const before={native:await f.native(),contracts:await f.ai('contracts'),board:await f.request('/api/simmer/board?subject=hk'),concept:await f.request('/api/concept?parentStudyId=hk'),carousel:await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.carousel.output.id})),review:await f.request(f.query('/api/study-ai/review',{...f.scope,requestId:f.pending.id})),journal:await f.request('/api/journal'),sources:await f.request('/api/sources/tree')};
 const retainedSources=[];for(const source of before.sources.sources){const response=await fetch(f.url+'/api/sources/blob?'+new URLSearchParams({id:source.id}));assert.equal(response.status,200);retainedSources.push({id:source.id,hash:digest(Buffer.from(await response.arrayBuffer()))});}
 const photoOriginals=[];for(const block of f.board.groups.flatMap(g=>g.blocks).filter(b=>b.kind==='photo')){const response=await fetch(f.url+'/api/sources/blob?'+new URLSearchParams({id:block.photo.sourceId,original:'1'}));assert.equal(response.status,200);photoOriginals.push({id:block.photo.sourceId,hash:digest(Buffer.from(await response.arrayBuffer()))});}
 await f.close();
 // An actual committed first file with a lost acknowledgement, not a fake
 // pending JSON row. Recovery must use the original saved operation UUID.
 let interrupted=false;const owner=createStudyDraftCopies({dataDir:f.config.dataDir,originals:createStudyOriginals(f.config.studyOriginalRoots),afterCommit:()=>{if(!interrupted){interrupted=true;throw Error('W8 invented lost native acknowledgement');}}});
 const pendingOperation={...f.scope,expected:edit.expected,operationId:op(),operations:[{kind:'insert',id:op(),beforeId:null,raw:'Interrupted native words retained exactly.'}]};
 await assert.rejects(owner.save(pendingOperation),/lost native acknowledgement/);assert.equal(interrupted,true);
 const snapshot=syntheticSnapshot(f,{sourceRevision:sourceRevision});
 const destination=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w8-restored-')));t.after(()=>fs.rmSync(destination,{recursive:true,force:true}));
 const restored=restoreSynthetic(snapshot,destination);
 // Make every old original/data path unavailable, so accidental old-root reads fail.
 fs.renameSync(f.home.dir,f.home.dir+'-unavailable');t.after(()=>fs.rmSync(f.home.dir+'-unavailable',{recursive:true,force:true}));
 const execution=createWorkspaceExecution({codexPath:null,boundedEditorial:true}),server=await createServer({...restored,publicDir:path.resolve('public'),voiceHome:null,sharedArticles:true,researchEnabled:false,execution});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));execution.dispose();});const url='http://127.0.0.1:'+server.address().port;
 const api=async(route,input,status=200,actor='human:adrian')=>{const r=await fetch(url+route,{headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':actor.startsWith('human:')?'ui':'cli',Origin:url},...(input===undefined?{}:{method:'POST',body:JSON.stringify(input)})});const v=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(v));return v;};
 const pendingRead=await api(f.query('/api/study-draft/read',f.scope));assert.equal(pendingRead.readiness.ready,false);
 const recoveredOperation=await api('/api/study-draft/recover',{...f.scope,operationId:pendingOperation.operationId});assert.equal(recoveredOperation.readiness.ready,true);assert.ok(recoveredOperation.raw.includes('Interrupted native words retained exactly.'));
 const native=await api('/api/study-draft/undo',{...f.scope,expected:recoveredOperation.expected,operationId:op(),undoOperationId:pendingOperation.operationId});assert.equal(native.raw,edit.raw);assert.deepEqual(native.projection,edit.projection);
 assert.deepEqual(await api(f.query('/api/study-ai/contracts',f.scope)),before.contracts);
 assert.equal((await api('/api/concept?parentStudyId=hk')).authorThoughts,words.note);
 assert.deepEqual((await api('/api/simmer/board?subject=hk')).groups,before.board.groups);
 const carousel=await api(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.carousel.output.id}));assert.deepEqual(carousel.output,before.carousel.output);
 const review=await api(f.query('/api/study-ai/review',{...f.scope,requestId:f.pending.id}));assert.equal(review.id,before.review.id);assert.equal(review.status,before.review.status);assert.equal(review.stale,true);assert.ok(JSON.stringify(review).includes('The seam is visible'));
 await api(f.query('/api/study-ai/accept',f.scope),{requestId:f.pending.id,operationId:op()},409);
 assert.deepEqual(await api(f.query('/api/study-ai/review',{...f.scope,requestId:f.pending.id})),review);assert.equal((await api(f.query('/api/study-draft/read',f.scope))).raw,native.raw);
 const download=await fetch(url+exported.artifact.url);assert.equal(download.status,200);assert.equal(await download.text(),body);
 const history=await api('/api/journal');assert.ok(before.journal.lines.length>0);for(const row of before.journal.lines)assert.ok(history.lines.some(saved=>JSON.stringify(saved)===JSON.stringify(row)),'Exact journal row preserved');
 const sources=await api('/api/sources/tree');for(const source of before.sources.sources)assert.ok(sources.sources.some(s=>s.id===source.id),'Source ID preserved: '+source.id);
 for(const source of retainedSources){const response=await fetch(url+'/api/sources/blob?'+new URLSearchParams({id:source.id}));assert.equal(response.status,200);assert.equal(digest(Buffer.from(await response.arrayBuffer())),source.hash);}
 for(const source of photoOriginals){const response=await fetch(url+'/api/sources/blob?'+new URLSearchParams({id:source.id,original:'1'}));assert.equal(response.status,200);assert.equal(digest(Buffer.from(await response.arrayBuffer())),source.hash);}
 const restoredShare=await api(f.query('/api/study/share',{...shareScope,targetEdition:invitation.targetEdition}));assert.deepEqual(restoredShare.preparation,invitation.preparation);assert.deepEqual(restoredShare.delivery,invitation.delivery);
 const replay=await api('/api/simmer/intake',f.intake,200,'agent:codex');assert.equal(replay.replayed,true);
 const undone=await api('/api/study-draft/undo',{...f.scope,expected:native.expected,operationId:op(),undoOperationId:operationId});assert.equal(undone.raw,base.raw);assert.deepEqual(undone.projection.map(p=>p.id),base.projection.map(p=>p.id));
 const missingPhoto=photoOriginals[0],originalRow=snapshot.rows.find(r=>r.kind==='file'&&r.path.startsWith('owned/source-originals/')&&r.hash===missingPhoto.hash);assert.ok(originalRow);const originalPath=path.join(destination,originalRow.path);fs.unlinkSync(originalPath);
 const missing=await fetch(url+'/api/sources/blob?'+new URLSearchParams({id:missingPhoto.id,original:'1'}));assert.equal(missing.status,404,'Missing retained original must refuse, never fall back to working image');const workingPhoto=await fetch(url+'/api/sources/blob?'+new URLSearchParams({id:missingPhoto.id}));assert.equal(workingPhoto.status,200);assert.equal(digest(Buffer.from(await workingPhoto.arrayBuffer())),missingPhoto.hash);assert.equal((await api(f.query('/api/study-draft/read',f.scope))).raw,base.raw);
 fs.writeFileSync(originalPath,Buffer.from(originalRow.bytes,'base64'),{flag:'wx',mode:0o600});
 const proof={schema:'ar-create.w8-restoration-proof.v1',sourceRevision:snapshot.sourceRevision,inventoryHash:snapshot.inventoryHash,files:snapshot.rows.filter(r=>r.kind==='file').length,bindings:restored.studyRelocation.bindings.map(b=>b.bindingId),oldHomeUnavailable:true,idsPreserved:true,exactWords:true,exactUndo:true,pendingProposalRetained:true,pendingNativeOperationRecovered:pendingOperation.operationId,staleProposalRefused:true,retainedEditionHash:digest(body),restoredSharePreparation:true,sourceBytes:retainedSources,originalPhotoBytes:photoOriginals,missingOriginal:{id:missingPhoto.id,status:missing.status,workingPhotoAvailable:true},sources:sources.sources.map(s=>({id:s.id,availability:s.availability,originalMetadata:s.originalMetadata})),syntheticOnly:true,productionBackup:false};
 if(process.env.W8_PROOF_DIR){fs.mkdirSync(process.env.W8_PROOF_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,'restore.json'),JSON.stringify(proof,null,2));}
});

test('synthetic restore validates before writes and leaves failed partial files in caller-owned private fixtures',async t=>{
 const f=await coherentFixture(t);assert.throws(()=>syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)}),/Close fixture/);await f.close();const snapshot=syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)});
 const parent=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w8-restore-negative-')));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
 const privateFixture=()=>{const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w8-restored-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
 for(const mutate of [s=>s.rows.find(r=>r.kind==='file').bytes='Y2hhbmdlZA==',s=>s.rows[0].path='../escape',s=>s.rows[0].path='owned/oauth',s=>s.rows.push({...s.rows[0]}),s=>s.inventoryHash='0'.repeat(64)]){const s=structuredClone(snapshot);mutate(s);const dest=privateFixture(),stamp=fs.statSync(dest);assert.throws(()=>restoreSynthetic(s,dest));assert.deepEqual(fs.readdirSync(dest),[]);assert.equal(fs.statSync(dest).ino,stamp.ino);}
 const missing=path.join(parent,'missing');assert.throws(()=>restoreSynthetic(snapshot,missing),/ENOENT/);assert.equal(fs.existsSync(missing),false,'Helper never creates a destination');
 const occupied=privateFixture();fs.writeFileSync(path.join(occupied,'keep'),'Unrelated exact bytes.');assert.throws(()=>restoreSynthetic(snapshot,occupied),/destination refused/);assert.deepEqual(fs.readdirSync(occupied),['keep']);assert.equal(fs.readFileSync(path.join(occupied,'keep'),'utf8'),'Unrelated exact bytes.');
 const broken=structuredClone(snapshot),binding=broken.rows.find(r=>/metadata\/ar-project-folder-bindings\/[a-f0-9-]+\.json$/.test(r.path));assert.ok(binding);const invalid=Buffer.from('{broken binding json');binding.bytes=invalid.toString('base64');binding.size=invalid.length;binding.hash=digest(invalid);broken.inventoryHash=digest(JSON.stringify(broken.rows.map(({bytes,...r})=>r)));const failed=privateFixture(),failedStamp=fs.statSync(failed);assert.throws(()=>restoreSynthetic(broken,failed),SyntaxError);assert.equal(fs.statSync(failed).ino,failedStamp.ino);assert.deepEqual(fs.readFileSync(path.join(failed,binding.path)),invalid,'Failed partial fixture remains for caller inspection');for(const row of broken.rows.filter(r=>r.kind==='file'))assert.equal(digest(fs.readFileSync(path.join(failed,row.path))),row.hash,'No helper rollback deletes partial files');assert.equal(fs.readFileSync(path.join(occupied,'keep'),'utf8'),'Unrelated exact bytes.');
 const link=path.join(f.config.dataDir,'library','unsafe-link');fs.symlinkSync(f.home.config,link);assert.throws(()=>syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)}),/Symlink/);fs.unlinkSync(link);
 for(const name of ['config.json','W8-SYNTHETIC']){const file=path.join(f.home.dir,name),saved=file+'.saved',external=path.join(parent,'external-'+name);fs.renameSync(file,saved);fs.writeFileSync(external,'Not a configuration: this external file must never be parsed.');
  try{fs.symlinkSync(external,file);assert.throws(()=>syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)}),/Symlink/);fs.unlinkSync(file);fs.linkSync(external,file);assert.throws(()=>syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)}),/single-link/);fs.unlinkSync(file);fs.mkdirSync(file);assert.throws(()=>syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)}),/ordinary/);fs.rmdirSync(file);if(process.platform!=='win32'){execFileSync('mkfifo',[file]);assert.throws(()=>syntheticSnapshot(f,{sourceRevision:'a'.repeat(40)}),/ordinary/);fs.unlinkSync(file);}}
  finally{if(fs.existsSync(file))fs.rmSync(file,{recursive:true,force:true});fs.renameSync(saved,file);}assert.equal(fs.readFileSync(external,'utf8'),'Not a configuration: this external file must never be parsed.');}
});
