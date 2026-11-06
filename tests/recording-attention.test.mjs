import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {addRecording,seg} from './helpers/word-recording.mjs';
import {createTranscriptCorrections} from '../runtime/services/transcript-corrections.mjs';
import {createRecordingAttention,recordingPurpose} from '../runtime/services/recording-attention.mjs';
import {createNeedsYou} from '../runtime/services/needs-you.mjs';

function fixture(t,{story='Clay workshop',segments=[seg(0,'We visited the workshop.'),seg(4,'Then the Zorava bowl was fired.',{Zorava:.1}),seg(8,'The glaze turned blue.')]}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'attention-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const rec=addRecording({dir,clock:{at:Date.now()}},{story,segments});
 const corrections=createTranscriptCorrections({dir:rec.dir,config:rec.config});
 const library={snapshot:async()=>({entries:[],kept:{}})};
 const project=createRecordingAttention({dataDir:dir,corrections,library});
 const write=(folder,data)=>{fs.mkdirSync(path.join(dir,folder),{recursive:true});fs.writeFileSync(path.join(dir,folder,rec.id+'.json'),JSON.stringify(data));};
 const word={key:'low-confidence:zorava',kind:'low-confidence',word:'Zorava',sentence:segments[1]?.text||'',segmentIndex:1,start:4,end:6,status:'open',suggestion:null};
 const words={schema:'ar-create.word-check.v1',jobId:rec.id,story,items:[word],fixes:{suggested:[],applied:[]}};
 const check={schema:'ar-create.transcript-check.v1',jobId:rec.id,state:'ready',basis:corrections.read(rec.id).expected.revision,problems:[{id:randomUUID(),indexes:[1],tier:'ear',reason:'The local name needs listening.',fixes:[{index:1,text:'Then the Zorava bowl was fired carefully.'}]}],decisions:{}};
 write('word-library/recordings',words);write('transcript-checks',check);
 const asks=['recording-words','recording-check'].map(kind=>({id:randomUUID(),band:'steer',status:'open',scope:{kind,id:rec.id},question:'Old vague question',about:story,choices:['Done'],raisedAt:new Date().toISOString()}));
 return {dir,rec,project,write,words,check,asks,corrections};
}

test('recording test classification needs explicit metadata or a whole test utterance, never a substring',()=>{
 assert.equal(recordingPurpose({purpose:'test'},[{text:'A normal sounding example.'}]),'test');
 assert.equal(recordingPurpose({story:'Phone clip'},[{text:'Test 1-2, Test Test.'}]),'test');
 assert.equal(recordingPurpose({story:'Phone clip'},[{text:'Studio verification, the sample speaks through color, and the result is clear.'}]),'test');
 assert.equal(recordingPurpose({story:'Testing clay glazes'},[{text:'We test each glaze in the kiln before using it on a bowl.'}]),'work');
 assert.equal(recordingPurpose({story:'phone-'+randomUUID()},[{text:'The potter described how the kiln changed the glaze.'}]),'work');
});

test('one request per recording shows a current passage, reason, proposal, neighboring context and bounded audio',async t=>{
 const f=fixture(t);const before=fs.readFileSync(path.join(f.dir,'transcript-checks',f.rec.id+'.json'));
 const rows=await f.project(f.asks);
 assert.equal(rows.length,1);const r=rows[0].recording;
 assert.equal(r.title,'Clay workshop');assert.equal(r.items.length,1,'overlapping checks share one excerpt and player');assert.equal(r.wordCount,1);assert.equal(r.passageCount,1);
 assert.ok(r.items.some(i=>i.text.includes('Zorava bowl')&&i.reason));
 assert.ok(r.items.some(i=>i.proposed?.includes('carefully')));assert.match(r.items[0].reason,/Zorava/);
 assert.ok(r.items.every(i=>i.audioUrl.startsWith('/transcription/'+f.rec.id+'/audio#t=')));
 assert.match(r.items[0].context,/visited the workshop/);
 assert.ok(r.items.every(i=>i.start>=0&&i.end>i.start));
 assert.deepEqual(fs.readFileSync(path.join(f.dir,'transcript-checks',f.rec.id+'.json')),before,'projection never answers or edits');
});

test('test recordings, removed jobs, changed source passages and obsolete weak matches do not become requests',async t=>{
 const f=fixture(t);f.words.items[0]={...f.words.items[0],key:'near-match:creation',word:'Creation',suggestion:'Reaction'};
 f.write('word-library/recordings',f.words);assert.equal((await f.project([f.asks[0]])).length,0);
 f.check.basis='stale';f.write('transcript-checks',f.check);assert.equal((await f.project([f.asks[1]])).length,0);
 const jobFile=path.join(f.rec.dir,'.transcription-jobs',f.rec.id+'.json');
 fs.writeFileSync(jobFile,JSON.stringify({...f.rec.job,purpose:'test'}));assert.equal((await f.project(f.asks)).length,0);
 fs.rmSync(jobFile);assert.equal((await f.project(f.asks)).length,0);
});

test('audio absence is honest; a generated filename gets a descriptive excerpt rather than its UUID',async t=>{
 const f=fixture(t,{story:'phone-'+randomUUID()});const snap=f.corrections.read(f.rec.id);
 f.project=createRecordingAttention({dataDir:f.dir,corrections:{read:()=>snap},library:{snapshot:async()=>({entries:[]})}});fs.rmSync(f.rec.audio);
 const [row]=await f.project(f.asks);assert.ok(row);assert.doesNotMatch(row.recording.title,/phone-|[a-f0-9]{8}-/);
 assert.match(row.recording.title,/workshop/);assert.ok(row.recording.items.every(i=>i.audioUrl===null));
});

test('generic asks and recorded human answers stay intact; projected counts agree; hidden recordings never auto-answer',async t=>{
 const f=fixture(t);let clock=Date.now();const needs=createNeedsYou({dataDir:f.dir,now:()=>clock,recordingAttention:f.project});
 const common={operationId:randomUUID(),band:'steer',question:'Check words?',choices:['Keep','Review'],default:'Keep',applyAt:new Date(clock+1000).toISOString(),scope:f.asks[0].scope};
 const a=await needs.raise(common,{actor:'cron:shared-words'});
 await needs.raise({...common,operationId:randomUUID(),band:'only-adrian',question:'Check passages?',default:undefined,applyAt:undefined,scope:f.asks[1].scope},{actor:'cron:transcript-check'});
 const generic=await needs.raise({operationId:randomUUID(),band:'only-adrian',question:'Which story next?',choices:['Clay','Glaze']},{actor:'agent:codex'});
 let list=await needs.list({status:'all'});assert.equal(list.asks.length,2);assert.equal(list.counts.open,2);assert.equal(list.counts.onlyAdrian,2);
 assert.ok(list.asks.some(x=>x.id===generic.id));
 clock+=2000;await needs.sweep();const raw=await needs.list({id:a.id,status:'all'});assert.equal(raw.asks[0].status,'open');assert.equal(raw.asks[0].resolution,null);assert.equal(raw.counts.open,3,'id reads preserve the existing global raw-count contract for owners');
});

test('requalification refuses an obsolete replacement even when the token key still matches',async t=>{
 const f=fixture(t);const snap=f.corrections.read(f.rec.id);
 const {qualifiedWords}=await import('../runtime/services/recording-attention.mjs');
 const item={...f.words.items[0],key:'near-match:zorava',kind:'near-match',suggestion:'Wrong old term',entryId:'old'};
 const entries=[{id:'current',status:'confirmed',spelling:'Zoravo',category:'person',variants:[]}];
 assert.deepEqual(qualifiedWords({...f.words,items:[item]},snap,{entries}),[]);
});

test('equal sentences at separate moments and distinct proposed corrections are not discarded',async t=>{
 const f=fixture(t);f.check.problems.push({...f.check.problems[0],id:randomUUID(),fixes:[{index:1,text:'Then the Zorava pot was fired.'}]});
 f.write('transcript-checks',f.check);const [row]=await f.project(f.asks);
 assert.equal(row.recording.passageCount,2);assert.equal(row.recording.items.length,2);
 assert.ok(row.recording.items.some(i=>i.proposed.includes('pot')));
});
