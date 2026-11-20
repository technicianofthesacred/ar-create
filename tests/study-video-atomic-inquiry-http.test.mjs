import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';

test('one agent HTTP handoff saves its existing independent inquiry with the exact source and replays without duplication',async t=>{
 const home=syntheticHome();t.after(()=>fs.rmSync(home.dir,{recursive:true,force:true}));const config=JSON.parse(fs.readFileSync(home.config));
 const server=await createServer({dataDir:config.dataDir,studyOriginalRoots:config.studyOriginalRoots,researchEnabled:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port,call=async(route,body)=>{const r=await fetch(base+route,{headers:{Connection:'close','X-AR-Actor':'agent:codex','X-AR-Client':'cli','Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,value:await r.json()};};
 const scope={projectKey:'hk',parentStudyId:'hk'},source=(await call('/api/study-originals?projectKey=hk')).value.records.find(r=>r.role==='source'),quote=source.raw.trim(),from=source.raw.indexOf(quote);
 await call('/api/sources/tree');const catalog=(await call('/api/inquiries/catalog?input=%7B%7D')).value,created=await call('/api/inquiries/create',{name:'Invented inquiry for an atomic handoff',sourceIds:[],expectedRevision:catalog.revision});assert.equal(created.status,200);
 const collectionId=created.value.collection.id,notesRoute='/api/inquiries/read?input='+encodeURIComponent(JSON.stringify({collectionId})),notesBefore=(await call(notesRoute)).value;
 const input={...scope,operationId:randomUUID(),findingId:'invented-saved-finding',title:'Invented atomic video brief',sourcePath:source.path,sourceHash:source.hash,from,to:from+quote.length,quote,collectionId};
 const first=await call('/api/study/video-briefs',input);assert.equal(first.status,200,JSON.stringify(first.value));assert.equal(first.value.brief.collectionId,collectionId);assert.equal(first.value.brief.inquiryOrigin.collectionId,collectionId);assert.equal(first.value.brief.provenance.actor,'agent:codex');
 assert.deepEqual(await call('/api/study/video-briefs',input),first);
 assert.equal((await call('/api/study/video-briefs',{...input,collectionId:randomUUID()})).status,409);
 assert.equal((await call('/api/study/video-briefs',{...input,operationId:randomUUID(),collectionId:randomUUID()})).status,404);
 assert.equal((await call('/api/study/video-briefs',{...input,operationId:randomUUID(),unexpected:'not allowed'})).status,400);
 assert.equal((await call('/api/study/video-briefs?'+new URLSearchParams(scope))).value.briefs.length,1);
 const citation=await call('/api/study/video-briefs/source?'+new URLSearchParams({...scope,id:input.operationId}));assert.equal(citation.status,200);assert.equal(citation.value.source.hash,source.hash);assert.equal(citation.value.source.quote,quote);assert.equal(citation.value.brief.collectionId,collectionId);
 const notesAfter=(await call(notesRoute)).value;for(const key of ['record','collection','sources'])assert.deepEqual(notesAfter[key],notesBefore[key]);
 const capabilities=(await call('/api/capabilities')).value.commands,command=capabilities.find(c=>c.route==='/api/study/video-briefs'&&c.method==='POST');assert(command);assert.deepEqual(command.actors,['any']);assert.equal(command.readOnly,false);assert.deepEqual(command.schema.body,['projectKey','parentStudyId','operationId','findingId','title','sourcePath','sourceHash','from','to','quote','collectionId?']);
 const {collectionId:omitted,...legacy}=input,old=await call('/api/study/video-briefs',{...legacy,operationId:randomUUID()});assert.equal(old.status,200);assert.equal(old.value.brief.collectionId,undefined);assert.equal(old.value.brief.inquiryOrigin,undefined);
});
