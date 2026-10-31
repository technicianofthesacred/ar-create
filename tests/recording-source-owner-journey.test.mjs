import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from '../runtime/server.mjs';
import {createLibrary} from '../runtime/services/library.mjs';
import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';
import {digest} from '../runtime/services/files.mjs';

test('retained Library recording opens canonical Source by job identity without exposing processing derivatives',async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'recording-source-owner-journey-'))),fixture=createWorkshopFixture(dataDir);
 // Invented completed-job fixture: model execution and real microphone access are absent.
 fs.writeFileSync(path.join(fixture.output,'transcribe.json'),JSON.stringify(fixture.original));
 const library=createLibrary({dataDir}),original=(await library.tree()).sources.find(s=>s.rootId==='recordings'&&s.rel_path==='tone-fixture.wav');assert.ok(original);
 fs.writeFileSync(path.join(dataDir,'recordings','source-links.json'),JSON.stringify({[original.id]:fixture.id}));
 const server=await createServer({dataDir,publicDir:path.resolve('public'),transcriptionRuntime:{python:'/no-interpreter'}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
 const json=async(route,input)=>{const response=await fetch(base+route,input?{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian'},body:JSON.stringify(input)}:{});assert.equal(response.status,200,route);return response.json();};
 const tree=await json('/api/sources/tree');assert.ok(tree.sources.some(s=>s.id===original.id));assert.equal(tree.sources.some(s=>s.rootId==='recordings'&&s.rel_path.includes('/Transcription/'+fixture.id+'/')),false,'Processing derivatives remain out of Library');
 const job=(await json('/api/recordings')).jobs.find(j=>j.sourceId===original.id);assert.equal(job.id,fixture.id);assert.equal(job.state,'done');assert.equal(job.transcriptReady,true);assert.equal(job.url,'/transcription/'+fixture.id+'/view');
 const workshop=await fetch(base+job.url);assert.equal(workshop.status,200);const html=await workshop.text();assert.ok(html.includes('createSourceTermsReview'));assert.ok(html.includes('"jobId":"'+fixture.id+'"'));
 const snapshot=await json('/transcription/'+job.id+'/snapshot?readOnly=1');assert.equal(snapshot.jobId,job.id);assert.equal(snapshot.expected.jobId,job.id);assert.equal(snapshot.expected.audioHash,digest(fs.readFileSync(fixture.source)));assert.deepEqual(snapshot.result.segments,fixture.original.segments);assert.ok(snapshot.markdown.includes(fixture.original.segments[0].text));
 const before=digest(fs.readFileSync(path.join(fixture.output,'transcript.json'))),preview=await json('/api/source-transcript/terms/preview',{jobId:job.id,expected:snapshot.expected,find:'fixture tone',replace:'synthetic tone',segmentIndexes:[0]});assert.equal(preview.jobId,job.id);assert.equal(preview.sourceId,undefined);assert.equal(preview.changes.length,1);assert.equal(preview.applied,false);assert.equal(preview.canApply,false);assert.equal(digest(fs.readFileSync(path.join(fixture.output,'transcript.json'))),before);
 const after=await json('/api/sources/tree');assert.equal(after.sources.some(s=>s.rootId==='recordings'&&s.rel_path.includes('/Transcription/'+fixture.id+'/')),false);
});
