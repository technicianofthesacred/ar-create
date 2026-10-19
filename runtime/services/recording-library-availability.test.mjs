import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLibrary} from './library.mjs';
import {createRecordings} from './recordings.mjs';
import {safeRel,resolveInside} from './files.mjs';
async function fixture(t,outputKind){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'recording-availability-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dataDir,'library'));fs.writeFileSync(path.join(dataDir,'library','Ready.md'),'Synthetic unrelated readable context.');fs.writeFileSync(path.join(dataDir,'library','.hidden.md'),'Hidden synthetic context.');fs.writeFileSync(path.join(dataDir,'library','Ready.sync-conflict-20261018.md'),'Conflict copy stays outside Library.');
 let recordings;const library=createLibrary({dataDir,recordingState:id=>recordings?.state(id),recordingSourceSnapshot:source=>recordings?.sourceSnapshot(source)}),dir=path.join(dataDir,'recordings');fs.writeFileSync(path.join(dir,'recording.wav'),'Synthetic audio placeholder.');
 const source=(await library.tree()).sources.find(s=>s.rel_path==='recording.wav'),id=randomUUID(),output=outputKind==='outside'?path.join(dataDir,'..','prior-home','recordings','Transcription',id):path.join(dir,'.hidden-output',id);
 const currentOutput=path.join(dir,'Current recording','Transcription',id);fs.mkdirSync(currentOutput,{recursive:true});fs.writeFileSync(path.join(currentOutput,'transcript.md'),'---\nkind: transcript\nreview_status: reviewed\n---\n\nSynthetic transcript still needs its recording identity recovered.');
 fs.mkdirSync(path.join(dir,'.transcription-jobs'));fs.writeFileSync(path.join(dir,'.transcription-jobs',id+'.json'),JSON.stringify({id,state:'done',transcriptReady:true,output}));fs.writeFileSync(path.join(dir,'source-links.json'),JSON.stringify({[source.id]:id}));
 recordings=createRecordings({dataDir,library});return {dataDir,dir,library,recordings,source,currentOutput};
}
for(const outputKind of ['outside','hidden'])test(`invalid ${outputKind} recording location does not block unrelated Library sources`,async t=>{
 const f=await fixture(t,outputKind),state=f.recordings.state(f.source.id);assert.equal(state.state,'unavailable');assert.equal(state.transcriptReady,false);assert.match(state.reason,/location is unavailable/);
 const tree=await f.library.tree(),ready=tree.sources.find(s=>s.rel_path==='Ready.md'),audio=tree.sources.find(s=>s.id===f.source.id);assert.equal(ready.cardEligibility.eligible,true);const transcript=tree.sources.find(s=>s.path===path.join(f.currentOutput,'transcript.md'));assert.equal(transcript.cardEligibility.eligible,false);assert.equal(transcript.transcriptState.coherent,false);assert.match(transcript.cardEligibility.reason,/location differs/);const managed=f.recordings.sourceSnapshot({rootId:'recordings',rel_path:path.relative(f.dir,transcript.path),path:transcript.path});assert.equal(managed.managed,true);assert.equal(managed.coherent,false);assert.equal(audio.cardEligibility.eligible,false);assert.match(audio.cardEligibility.reason,/recover/);assert.equal(audio.pipelineStates.transcription.state,'unavailable');assert.equal(tree.sources.some(s=>s.rel_path.includes('.hidden')||s.rel_path.includes('.sync-conflict-')),false);
 for(const rel of ['../prior-home/transcript.json','.hidden-output/transcript.json','folder/a.sync-conflict-copy.md']){assert.throws(()=>safeRel(rel),/Hidden files, conflicts and traversal/);assert.throws(()=>resolveInside(f.dir,rel),/Hidden files, conflicts and traversal/);}
});
