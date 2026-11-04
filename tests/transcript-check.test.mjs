// The transcript check: a model proposes, Adrian decides from the app's own page, and every "use" goes through the
// recording's correction boundary. Real server, real correction receipts, an invented recording and a stand-in model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {addRecording,seg} from './helpers/word-recording.mjs';
import {validateSuggestions,suggestionPrompt,createTranscriptCheck} from '../runtime/services/transcript-check.mjs';
import {transcriptCheckFor} from '../runtime/services/transcript-check-http.mjs';
import {withActor} from '../runtime/services/actor.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const TALK=[
 seg(0,'So today I watched a painter at work.'),
 seg(4,'Dates this Nepalese method, Navari.'),
 seg(9,'Each can came from a rock.'),
 seg(13,'Thank you to all the listeners too.'),
 seg(17,'Aged tea and brush.',{Aged:.2,tea:.3}),
 seg(21,'It does some hell.'),
 seg(23,'fit well with each other.'),
];
const SEGS=TALK.map(s=>({text:s.text}));
const GOOD={problems:[
 {indexes:[1],tier:'sure',fixes:[{index:1,text:'Dates this Nepalese method, Newari.'}],reason:'The Nepalese tradition is spelled Newari.'},
 {indexes:[2],tier:'sure',fixes:[{index:2,text:'Each color came from a rock.'}],reason:'Follows crushing the pigments.'},
 {indexes:[3],tier:'notyou',fixes:null,reason:'A phrase speech models invent in silence.'},
 {indexes:[4],tier:'ear',fixes:[{index:4,text:'Agate and brush.'}],reason:'A guess. The polishing stone is agate.'},
 {indexes:[5,6],tier:'ear',fixes:[{index:5,text:'It just somehow'},{index:6,text:'fits well with each other.'}],reason:'Two halves of one sentence.'},
]};

test('suggestions are held to the contract before anything is saved',()=>{
 const ok=validateSuggestions(GOOD,SEGS);
 assert.equal(ok.length,5);assert.ok(ok.every(p=>/^[a-f0-9-]{36}$/.test(p.id)));
 const bad=(change,message)=>assert.throws(()=>validateSuggestions({problems:[change]},SEGS),message);
 bad({indexes:[9],tier:'sure',fixes:[{index:9,text:'x'}],reason:'r'},/do not exist/);
 bad({indexes:[1,3],tier:'ear',fixes:null,reason:'r'},/in a row/);
 bad({indexes:[3],tier:'notyou',fixes:[{index:3,text:'x'}],reason:'r'},/takes no fix/);
 bad({indexes:[1],tier:'sure',fixes:null,reason:'r'},/must say what it changes/);
 bad({indexes:[1],tier:'sure',fixes:[{index:1,text:'Dates this Nepalese method, Navari.'}],reason:'r'},/must change something/);
 bad({indexes:[1],tier:'sure',fixes:[{index:1,text:'two\nlines'}],reason:'r'},/one non-empty line/);
 bad({indexes:[1],tier:'maybe',fixes:null,reason:'r'},/no known kind/);
 assert.throws(()=>validateSuggestions({problems:[GOOD.problems[0],GOOD.problems[0]]},SEGS),/same line/);
 const prompt=suggestionPrompt({title:'Day one',segments:TALK,vocabulary:'Newari, Lu Yu'});
 assert.match(prompt,/4 \| 0:17 \| Aged tea and brush\. \| unsure: Aged, tea/);
 assert.match(prompt,/Newari, Lu Yu/);
});

async function setup(t,execute){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const rec=addRecording({dir:config.dataDir,clock:{at:Date.now()}},{segments:TALK,story:'Day one'});
 // The stand-in model: the route's own check instance, with execute replaced before first use.
 const {createRecordings}=await import('../runtime/services/recordings.mjs');
 void createRecordings;
 const send=(method,route,{body,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text?JSON.parse(text):null}));});
  req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 const page=(method,route,body)=>send(method,route,{body,headers:{Origin:url}});
 const agent=(method,route,body)=>send(method,route,{body,headers:{'X-AR-Actor':'agent:claude-code','X-AR-Client':'http'}});
 return {url,id:rec.id,dataDir:config.dataDir,send,page,agent,rec,execute};
}

test('the model proposes; Adrian decides on the page; uses go through correction receipts; agents cannot decide',async t=>{
 const f=await setup(t);
 // Swap in the stand-in model for this data folder before the first request creates the instance.
 const {transcriptCheckFor:forDir}=await import('../runtime/services/transcript-check-http.mjs');
 const recordings={transcriptCorrections:(await import('../runtime/services/transcript-corrections.mjs')).createTranscriptCorrections({dir:path.join(f.dataDir,'recordings'),config:{conversationTimestamps:true}})};
 const check=forDir({dataDir:f.dataDir,recordings,options:{available:()=>true,execute:async({prompt})=>{assert.match(prompt,/OUTPUT-ONLY/);return {response:{artifacts:{'suggestions.json':JSON.stringify(GOOD)}},model:'stand-in'};}}});
 const base='/api/transcript-check/'+f.id;

 let r=await f.agent('GET',base);assert.equal(r.status,200);assert.equal(r.body.check.state,'none');assert.equal(r.body.segments.length,7);
 r=await f.agent('POST',base+'/suggest',{});assert.equal(r.status,202,JSON.stringify(r.body));
 await check.wait(f.id);
 r=await f.page('GET',base);assert.equal(r.body.check.state,'ready');assert.equal(r.body.problems.length,5);
 const byTier=t=>r.body.problems.filter(p=>p.tier===t);

 // An agent, or a script without the page, cannot decide.
 let denied=await f.agent('POST',base+'/decide',{problemId:byTier('ear')[0].id,action:'use',expected:r.body.expected});
 assert.equal(denied.status,403);
 denied=await f.send('POST',base+'/decide-group',{body:{tier:'sure',expected:r.body.expected},headers:{'X-AR-Actor':'human:adrian','X-AR-Client':'cli'}});
 assert.equal(denied.status,403,'Adrian from a script is refused too: the record must show he tapped it in the app');

 // The two easy groups.
 r=await f.page('POST',base+'/decide-group',{tier:'sure',expected:r.body.expected});assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.segments[1].text,'Dates this Nepalese method, Newari.');
 assert.equal(r.body.segments[2].text,'Each color came from a rock.');
 r=await f.page('POST',base+'/decide-group',{tier:'notyou',expected:r.body.expected});
 assert.deepEqual(r.body.leftOut,[3]);
 assert.equal(r.body.segments[3].text,'Thank you to all the listeners too.','left out of the talk, never deleted from the transcript');
 assert.equal(check.checkedText(f.id).includes('listeners'),false);

 // A stale page is refused by the correction boundary.
 const ear=r.body.problems.filter(p=>p.tier==='ear');
 const stale=await f.page('POST',base+'/decide',{problemId:ear[0].id,action:'use',expected:{...r.body.expected,revision:'0'}});
 assert.equal(stale.status,409);assert.match(stale.body.error,/changed since inspection/);

 // His own words win over the suggestion; a split sentence is fixed line by line.
 r=await f.page('POST',base+'/decide',{problemId:ear[0].id,action:'use',fixes:[{index:4,text:'Agate, and the brush.'}],expected:r.body.expected});
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.segments[4].text,'Agate, and the brush.');
 r=await f.page('POST',base+'/decide',{problemId:ear[1].id,action:'keep',expected:r.body.expected});
 assert.equal(r.body.segments[5].text,'It does some hell.','keep changes nothing');
 assert.ok(r.body.problems.every(p=>p.decision),'every suggestion decided');
 assert.equal(r.body.problems.find(p=>p.tier==='ear').decision.by.actor,'human:adrian');
 assert.equal(r.body.check.stale,false,'its own corrections do not make the check look stale');

 // Receipts: the recording owner recorded every change; the first transcript and RAW are untouched.
 const receipts=fs.readdirSync(path.join(f.rec.output,'.corrections'));assert.ok(receipts.some(n=>n==='base.json'));
 assert.equal(fs.readFileSync(f.rec.raw,'utf8'),'Exact immutable synthetic RAW.');
 const leave=await f.page('POST',base+'/decide',{problemId:ear[1].id,action:'leave',expected:r.body.expected});
 assert.equal(leave.status,400,'only a line that is not the speaker can be left out');
});

test('a failed read is recorded plainly and can be tried again',async t=>{
 const f=await setup(t);
 const recordings={transcriptCorrections:(await import('../runtime/services/transcript-corrections.mjs')).createTranscriptCorrections({dir:path.join(f.dataDir,'recordings'),config:{conversationTimestamps:true}})};
 let calls=0;
 const check=createTranscriptCheck({dataDir:f.dataDir,corrections:recordings.transcriptCorrections,available:()=>true,execute:async()=>{calls++;if(calls===1)return {response:{artifacts:{'suggestions.json':'{"problems":[{"indexes":[99],"tier":"sure","fixes":null,"reason":"x"}]}'}}};return {response:{artifacts:{'suggestions.json':JSON.stringify(GOOD)}}};}});
 await withActor({actor:'agent:claude-code',client:'cli'},()=>check.suggest(f.id));await check.wait(f.id);
 assert.equal(check.view(f.id).check.state,'failed');assert.match(check.view(f.id).check.error,/lines that do not exist/);
 await check.suggest(f.id);await check.wait(f.id);
 assert.equal(check.view(f.id).check.state,'ready');assert.equal(calls,2);
 assert.equal(fs.readdirSync(path.join(f.dataDir,'transcript-checks')).filter(n=>n.startsWith('.run-')).length,0,'no scratch folders left behind');
 await assert.rejects(withActor({actor:'agent:claude-code',client:'cli'},()=>check.decideGroup(f.id,{tier:'sure',expected:check.view(f.id).expected})),/human-only/);
});
