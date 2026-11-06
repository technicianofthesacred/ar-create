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
 const source=(await library.tree()).sources.find(s=>s.rel_path==='recording.wav'),id=randomUUID(),output=outputKind==='outside'?path.join(dataDir,'..','prior-home','recordings','Transcription',id):outputKind==='missing'?path.join(dir,'Missing recording','Transcription',id):path.join(dir,'.hidden-output',id);
 const currentOutput=path.join(dir,'Current recording','Transcription',id);fs.mkdirSync(currentOutput,{recursive:true});fs.writeFileSync(path.join(currentOutput,'transcript.md'),'---\nkind: transcript\nreview_status: reviewed\n---\n\nSynthetic transcript still needs its recording identity recovered.');
 fs.mkdirSync(path.join(dir,'.transcription-jobs'));fs.writeFileSync(path.join(dir,'.transcription-jobs',id+'.json'),JSON.stringify({id,story:'Invented recording',file:'recording.wav',source:path.join(dir,'recording.wav'),state:'done',transcriptReady:true,output}));fs.writeFileSync(path.join(dir,'source-links.json'),JSON.stringify({[source.id]:id}));
 recordings=createRecordings({dataDir,library});return {dataDir,dir,library,recordings,source,currentOutput,id};
}
for(const outputKind of ['outside','hidden'])test(`invalid ${outputKind} recording location does not block unrelated Library sources`,async t=>{
 const f=await fixture(t,outputKind),state=f.recordings.state(f.source.id);assert.equal(state.state,'unavailable');assert.equal(state.transcriptReady,false);assert.match(state.reason,/location is unavailable/);
 const tree=await f.library.tree(),ready=tree.sources.find(s=>s.rel_path==='Ready.md'),audio=tree.sources.find(s=>s.id===f.source.id);assert.equal(ready.cardEligibility.eligible,true);const transcriptPath=path.join(f.currentOutput,'transcript.md');assert.equal(tree.sources.some(s=>s.path===transcriptPath),false,'Internal job transcripts stay out of the Library list');const managed=f.recordings.sourceSnapshot({rootId:'recordings',rel_path:path.relative(f.dir,transcriptPath),path:transcriptPath});assert.equal(managed.managed,true);assert.equal(managed.coherent,false);assert.equal(audio.cardEligibility.eligible,false);assert.match(audio.cardEligibility.reason,/recover/);assert.equal(audio.pipelineStates.transcription.state,'unavailable');assert.equal(tree.sources.some(s=>s.rel_path.includes('.hidden')||s.rel_path.includes('.sync-conflict-')),false);
 for(const rel of ['../prior-home/transcript.json','.hidden-output/transcript.json','folder/a.sync-conflict-copy.md']){assert.throws(()=>safeRel(rel),/Hidden files, conflicts and traversal/);assert.throws(()=>resolveInside(f.dir,rel),/Hidden files, conflicts and traversal/);}
});

for(const outputKind of ['outside','hidden','missing'])test(`recordings list keeps invalid ${outputKind} transcript unavailable while original audio stays linked`,async t=>{
 const f=await fixture(t,outputKind),before=fs.readFileSync(path.join(f.dir,'.transcription-jobs',f.id+'.json'));
 const {jobs}=await f.recordings.list(),job=jobs.find(row=>row.id===f.id);
 assert.ok(job);assert.equal(job.state,'unavailable');assert.equal(job.transcriptReady,false);assert.equal(job.originalAvailable,true);assert.equal(job.sourceId,f.source.id);assert.match(job.reason,/location is unavailable/);
 assert.deepEqual(fs.readFileSync(path.join(f.dir,'.transcription-jobs',f.id+'.json')),before);
 const original=await f.library.blob(f.source.id);assert.equal(fs.readFileSync(original.file,'utf8'),'Synthetic audio placeholder.');
 for(const rel of ['../prior-home/transcript.json','.hidden-output/transcript.json'])assert.throws(()=>resolveInside(f.dir,rel),/Hidden files, conflicts and traversal/);
});

test('list checks each exact job instead of borrowing the newest job availability for a shared original',async t=>{
 const f=await fixture(t,'outside'),newId=randomUUID(),output=path.join(f.dir,'Ready recording','Transcription',newId);fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'transcript.json'),JSON.stringify({language:'en',speakers:[],segments:[],metadata:{review:{status:'unreviewed'}}}));
 fs.writeFileSync(path.join(f.dir,'.transcription-jobs',newId+'.json'),JSON.stringify({id:newId,story:'Invented ready recording',file:'recording.wav',source:path.join(f.dir,'recording.wav'),state:'done',transcriptReady:true,output}));
 fs.writeFileSync(path.join(f.dir,'source-links.json'),JSON.stringify({[f.source.id]:newId}));
 const recordings=createRecordings({dataDir:f.dataDir,library:f.library});assert.equal(recordings.state(f.source.id).state,'done');
 const {jobs}=await recordings.list(),old=jobs.find(j=>j.id===f.id),ready=jobs.find(j=>j.id===newId);
 assert.equal(old.state,'unavailable');assert.equal(old.transcriptReady,false);assert.equal(old.sourceId,undefined);
 assert.equal(ready.state,'done');assert.equal(ready.transcriptReady,true);assert.equal(ready.sourceId,f.source.id);assert.equal(ready.originalAvailable,true);assert.equal(fs.existsSync(path.join(output,'.corrections')),false,'Listing never initializes or generates transcript correction files');
});

test('missing original stays linked but cannot be advertised as an available fallback',async t=>{
 const f=await fixture(t,'outside');fs.unlinkSync(path.join(f.dir,'recording.wav'));const {jobs}=await f.recordings.list(),job=jobs.find(j=>j.id===f.id);
 assert.equal(job.state,'unavailable');assert.equal(job.transcriptReady,false);assert.equal(job.sourceId,f.source.id);assert.equal(job.originalAvailable,false);
 await assert.rejects(f.library.blob(f.source.id),error=>error.status===404);
});

// These executable probes report invented dependency metadata only. No Python
// imports, speech inference, model downloads or transcription jobs run here.
function readinessFixture(t,{dependencies={},engine,offline=false,models=true,missingModel=null}={}){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'recording-readiness-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const flags={mlx_whisper:true,torch:true,pyannote:true,sherpa_onnx:true,ffmpeg:true,...dependencies},python=path.join(root,'metadata-probe');
 fs.writeFileSync(python,`#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(flags))});\n`,{mode:0o700});
 const runtime={python,...(engine?{diarizationEngine:engine}:{}),...(offline?{offline:true}:{})};
 if(models){for(const [option,names]of [['asrModelDirectory',['config.json','weights.npz']],['diarizationModelDirectory',['sherpa-onnx-pyannote-segmentation-3-0/model.onnx','wespeaker_en_voxceleb_resnet34_LM.onnx']]]){const dir=path.join(root,option);fs.mkdirSync(dir);runtime[option]=dir;for(const name of names){const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});if(name!==missingModel)fs.writeFileSync(file,'Invented existence-only model placeholder; never loaded.');}}}
 const dataDir=path.join(root,'data');fs.mkdirSync(dataDir);const recordings=createRecordings({dataDir,library:{blob:async()=>{throw Error('Readiness must not open source audio.');}},transcriptionRuntime:runtime});return {recordings,runtime,dataDir,flags};
}

test('explicit sherpa readiness does not require unused Community dependencies',async t=>{
 const f=readinessFixture(t,{engine:'sherpa',offline:true,dependencies:{torch:false,pyannote:false}}),{capability,jobs}=await f.recordings.list();assert.equal(capability.ready,true);assert.equal(capability.status,'available-on-explicit-start');assert.deepEqual(capability.dependencies,f.flags);assert.equal(f.recordings.magazineIntake.ready(),true);assert.equal(jobs.length,0);const saved=JSON.parse(fs.readFileSync(path.join(f.dataDir,'recordings/runner-config.json')));assert.equal(saved.diarizationEngine,'sherpa');assert.equal(saved.runtimeEnvironment.HF_HUB_OFFLINE,'1');assert.equal(saved.runtimeEnvironment.TRANSFORMERS_OFFLINE,'1');
});
test('explicit Community readiness does not require unused Sherpa and does require both Community dependencies',async t=>{
 const f=readinessFixture(t,{engine:'community',dependencies:{sherpa_onnx:false}});assert.equal((await f.recordings.list()).capability.ready,true);for(const dependency of ['torch','pyannote']){const missing=readinessFixture(t,{engine:'community',dependencies:{[dependency]:false}});assert.equal((await missing.recordings.list()).capability.ready,false,dependency);assert.equal(missing.recordings.magazineIntake.ready(),false);}
});
test('automatic/default engine preserves both engines and all selected engines require shared speech/decoder dependencies',async t=>{
 for(const engine of [undefined,'auto','community','sherpa']){const complete=readinessFixture(t,{engine});assert.equal((await complete.recordings.list()).capability.ready,true);for(const dependency of ['mlx_whisper','ffmpeg',...(engine==='community'?['torch','pyannote']:engine==='sherpa'?['sherpa_onnx']:['torch','pyannote','sherpa_onnx'])]){const f=readinessFixture(t,{engine,dependencies:{[dependency]:false}}),{capability}=await f.recordings.list();assert.equal(capability.ready,false,`${engine||'default'} needs ${dependency}`);assert.equal(capability.status,'saved-only');assert.match(capability.problem,/missing transcription dependencies/);await assert.rejects(f.recordings.route({method:'POST',headers:{}},{},new URL('/transcription/12345678-1234-4234-8234-123456789abc/start','http://local')),{status:503});}}
});
test('selected engine still refuses incomplete configured model files and incomplete offline configuration',async t=>{
 for(const missingModel of ['weights.npz','sherpa-onnx-pyannote-segmentation-3-0/model.onnx','wespeaker_en_voxceleb_resnet34_LM.onnx']){const f=readinessFixture(t,{engine:'sherpa',offline:true,missingModel,dependencies:{torch:false,pyannote:false}}),{capability}=await f.recordings.list();assert.equal(capability.ready,false);assert.match(capability.problem,/models are unavailable|models are incomplete/);}
 assert.throws(()=>readinessFixture(t,{engine:'sherpa',offline:true,models:false}),/Offline transcription requires/);assert.throws(()=>readinessFixture(t,{engine:'community',offline:true}),/Offline transcription requires/);assert.throws(()=>readinessFixture(t,{engine:'unknown'}),/Unknown diarization engine/);
});

test('missing and non-boolean required probe flags cannot report readiness',async t=>{for(const value of [undefined,null,'true',1]){const f=readinessFixture(t,{engine:'sherpa',dependencies:{sherpa_onnx:value,torch:false,pyannote:false}});assert.equal((await f.recordings.list()).capability.ready,false);}});

test('local candidate runtime reuses only explicitly installed speech models with offline configuration',t=>{const f=readinessFixture(t,{engine:'sherpa',offline:true,dependencies:{torch:false,pyannote:false}}),r=f.recordings.candidateRuntime();assert.equal(r.ready,true);assert.equal(r.python,f.runtime.python);assert.equal(r.asrModelDirectory,f.runtime.asrModelDirectory);assert.equal(r.environment.HF_HUB_OFFLINE,'1');assert.equal(r.environment.TRANSFORMERS_OFFLINE,'1');const missing=readinessFixture(t,{models:false});assert.equal(missing.recordings.candidateRuntime().ready,false);});
