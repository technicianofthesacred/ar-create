import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createContinuityInterfaceFixture} from './continuity-interface.fixture.mjs';
import {createWorkContinuity} from './work-continuity.mjs';
import {createExports} from './exports.mjs';

test('completion distinguishes exact rendered Article from retained legacy bytes and refuses changed correspondence',async t=>{
 const f=await createContinuityInterfaceFixture(t,{native:true}),scope=f.scopes[2],selected={...f.group,selectedOutputId:scope.outputId},read=await f.outputs.read(selected),guard={...selected,expectedOutput:read.expectedOutput,expectedNative:read.writingProof.expected},continuity=createWorkContinuity({dataDir:f.dataDir,direction:f.direction,outputs:f.outputs,outputExports:f.exports});
 const input={...guard,manuscriptRevision:read.output.manuscriptRevision,name:'Invented edition',mimeType:'application/json',body:JSON.stringify(read.output,null,2)};
 const exact=await f.exports.saveArticle(input),legacyOwner=createExports({dataDir:f.dataDir,store:f.store});
 const legacy=await f.outputs.withExportSnapshot(guard,s=>legacyOwner.save({name:'Earlier retained export',mimeType:'application/json',body:JSON.stringify({unrelated:'Old caller bytes are retained honestly'}),outputId:scope.outputId,manuscriptRevision:read.output.manuscriptRevision},{...s,publicationBinding:{wordOwner:s.wordOwner,expectedOutput:s.expectedOutput,sourceProofHash:s.sourceProofHash}}));
 const record=async exportId=>{const v=await continuity.read({scope});return continuity.complete({scope,expected:v.expected,expectedWork:v.work.version,operationId:randomUUID(),actor:{clientId:randomUUID(),reportedRole:'agent'},completion:{destination:{kind:'local-file',label:'Retained local file'},exportId}});};
 assert.equal(legacy.artifact.contentVerification,'caller-supplied-bytes-not-render-verified');
 await assert.rejects(record(legacy.artifact.id),/exact saved edition/);
 const oldFile=await f.exports.file({...selected,exportId:legacy.artifact.id,format:'article'});assert.match(fs.readFileSync(oldFile.file,'utf8'),/Old caller bytes/);
 assert.equal((await continuity.read({scope})).data.completions.length,0);
 const completed=await record(exact.artifact.id);assert.equal(completed.data.completions[0].contentVerification,'server-rendered-exact-edition');assert.equal(completed.data.completions[0].publicationVerified,false);
 const owned=await f.exports.file({...selected,exportId:exact.artifact.id,format:'article'}),manifest=path.join(path.dirname(owned.file),'.manifest.json'),original=fs.readFileSync(manifest);
 for(const key of ['bodyHash','outputHash','rendererHash']){const changed=JSON.parse(original);changed.renderBinding[key]=key==='rendererHash'?'missing':'0'.repeat(64);fs.writeFileSync(manifest,JSON.stringify(changed));await assert.rejects(record(exact.artifact.id),/exact saved edition/);fs.writeFileSync(manifest,original);}
 assert.equal((await continuity.read({scope})).data.completions.length,1);
 assert.equal(fs.readFileSync(owned.file,'utf8'),input.body);
});
