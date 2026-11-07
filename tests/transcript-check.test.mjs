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
 const bad=(change,message)=>assert.throws(()=>validateSuggestions({problems:[change]},SEGS,{strict:true}),message);
 bad({indexes:[9],tier:'sure',fixes:[{index:9,text:'x'}],reason:'r'},/do not exist/);
 bad({indexes:[1,3],tier:'ear',fixes:null,reason:'r'},/in a row/);
 bad({indexes:[3],tier:'notyou',fixes:[{index:3,text:'x'}],reason:'r'},/takes no fix/);
 bad({indexes:[1],tier:'sure',fixes:null,reason:'r'},/must say what it changes/);
 bad({indexes:[1],tier:'sure',fixes:[{index:1,text:'Dates this Nepalese method, Navari.'}],reason:'r'},/must change something/);
 bad({indexes:[1],tier:'sure',fixes:[{index:1,text:'two\nlines'}],reason:'r'},/one non-empty line/);
 bad({indexes:[1],tier:'maybe',fixes:null,reason:'r'},/no known kind/);
 assert.throws(()=>validateSuggestions({problems:[GOOD.problems[0],GOOD.problems[0]]},SEGS,{strict:true}),/same line/);
 // Without strict, one slip is dropped and counted; the rest are kept.
 const kept=validateSuggestions({problems:[...GOOD.problems,{indexes:[0],tier:'sure',fixes:[{index:0,text:SEGS[0].text}],reason:'no change'}]},SEGS);
 assert.equal(kept.length,5);assert.equal(kept.dropped,1);
 assert.throws(()=>validateSuggestions({problems:[{indexes:[99],tier:'sure',fixes:null,reason:'r'}]},SEGS),/None of the suggestions/);
 // A fix the model would bet on is filed as sure; without a fix it stays an ear check.
 const bet=validateSuggestions({problems:[{indexes:[4],tier:'ear',certain:true,fixes:[{index:4,text:'Agate and brush.'}],reason:'r'},{indexes:[5],tier:'ear',certain:true,fixes:null,reason:'r'}]},SEGS);
 assert.deepEqual(bet.map(p=>p.tier),['sure','ear']);
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
 const check=forDir({dataDir:f.dataDir,recordings,options:{available:()=>true,execute:async({prompt})=>{assert.match(prompt,/Return JSON only/);return {text:JSON.stringify(GOOD),model:'stand-in'};}}});
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
 const check=createTranscriptCheck({dataDir:f.dataDir,corrections:recordings.transcriptCorrections,available:()=>true,execute:async()=>{calls++;if(calls===1)return {text:'{"problems":[{"indexes":[99],"tier":"sure","fixes":null,"reason":"x"}]}'};return {text:JSON.stringify(GOOD)};}});
 await withActor({actor:'agent:claude-code',client:'cli'},()=>check.suggest(f.id));await check.wait(f.id);
 assert.equal(check.view(f.id).check.state,'failed');assert.match(check.view(f.id).check.error,/None of the suggestions fitted/);
 await check.suggest(f.id);await check.wait(f.id);
 assert.equal(check.view(f.id).check.state,'ready');assert.equal(calls,2);
 assert.equal(fs.readdirSync(path.join(f.dataDir,'transcript-checks')).filter(n=>n.startsWith('.run-')).length,0,'no scratch folders left behind');
 await assert.rejects(withActor({actor:'agent:claude-code',client:'cli'},()=>check.decideGroup(f.id,{tier:'sure',expected:check.view(f.id).expected})),/human-only/);
});

test('undo takes a decision back exactly, and refuses when the lines were changed since',async t=>{
 const f=await setup(t);
 const recordings={transcriptCorrections:(await import('../runtime/services/transcript-corrections.mjs')).createTranscriptCorrections({dir:path.join(f.dataDir,'recordings'),config:{conversationTimestamps:true}})};
 const check=transcriptCheckFor({dataDir:f.dataDir,recordings,options:{available:()=>true,execute:async()=>({text:JSON.stringify(GOOD)})}});
 const base='/api/transcript-check/'+f.id;
 await f.agent('POST',base+'/suggest',{});await check.wait(f.id);
 let r=await f.page('GET',base);
 r=await f.page('POST',base+'/decide-group',{tier:'sure',expected:r.body.expected});
 assert.equal(r.body.segments[1].text,'Dates this Nepalese method, Newari.');
 const sure=r.body.problems.find(p=>p.indexes[0]===1);
 const denied=await f.agent('POST',base+'/undo',{problemId:sure.id,expected:r.body.expected});assert.equal(denied.status,403);
 r=await f.page('POST',base+'/undo',{problemId:sure.id,expected:r.body.expected});assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.segments[1].text,'Dates this Nepalese method, Navari.','a group fix is undone line by line');
 assert.equal(r.body.problems.find(p=>p.id===sure.id).decision,null);
 assert.equal(r.body.segments[2].text,'Each color came from a rock.','the rest of the group stays');
 // A split sentence fixed in two lines comes back as both lines.
 const split=r.body.problems.find(p=>p.indexes.length===2);
 r=await f.page('POST',base+'/decide',{problemId:split.id,action:'use',expected:r.body.expected});
 assert.deepEqual([r.body.segments[5].text,r.body.segments[6].text],['It just somehow','fits well with each other.']);
 r=await f.page('POST',base+'/undo',{problemId:split.id,expected:r.body.expected});
 assert.deepEqual([r.body.segments[5].text,r.body.segments[6].text],['It does some hell.','fit well with each other.']);
 // Changed again somewhere else: the undo is refused and nothing moves.
 r=await f.page('POST',base+'/decide',{problemId:split.id,action:'use',expected:r.body.expected});
 const edited=recordings.transcriptCorrections.edit(f.id,{expected:r.body.expected,corrections:[{index:5,text:'It just somehow, truly'}]});
 const refused=await f.page('POST',base+'/undo',{problemId:split.id,expected:edited.expected});
 assert.equal(refused.status,409);assert.match(refused.body.error,/changed again/);
 assert.equal((await f.page('GET',base)).body.segments[5].text,'It just somehow, truly');
 // Keep and leave-out undo without touching the text.
 r=await f.page('GET',base);const notyou=r.body.problems.find(p=>p.tier==='notyou');
 r=await f.page('POST',base+'/decide',{problemId:notyou.id,action:'leave',expected:r.body.expected});assert.deepEqual(r.body.leftOut,[3]);
 r=await f.page('POST',base+'/undo',{problemId:notyou.id,expected:r.body.expected});assert.deepEqual(r.body.leftOut,[]);
 const none=await f.page('POST',base+'/undo',{problemId:notyou.id,expected:r.body.expected});assert.equal(none.status,409);
});

test('the claude read gets no tools, no MCP servers and no settings, and only its answer comes back',async()=>{
 const {executeClaude}=await import('../runtime/services/transcript-check.mjs');
 const {EventEmitter}=await import('node:events');
 const fake=(stdout,code=0)=>{let seen;const spawnChild=(file,args)=>{seen={file,args};const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin={on(){},end(input){seen.input=input;setImmediate(()=>{c.stdout.emit('data',Buffer.from(stdout));c.emit('close',code);});}};c.kill=()=>{};return c;};return {spawnChild,seen:()=>seen};};
 const ok=fake(JSON.stringify({type:'result',is_error:false,result:'```json\n{"problems":[]}\n```',model:'claude-sonnet'}));
 const r=await executeClaude({cwd:'.',prompt:'P',claudePath:'/bin/claude',spawnChild:ok.spawnChild});
 assert.equal(r.text,'{"problems":[]}');assert.equal(ok.seen().input,'P');
 const args=ok.seen().args;for(const [flag,value] of [['--tools',''],['--setting-sources',''],['--model','sonnet'],['--output-format','json']])assert.equal(args[args.indexOf(flag)+1],value,flag);
 assert.ok(args.includes('--strict-mcp-config')&&args.includes('--no-session-persistence')&&args.includes('-p'));
 await assert.rejects(executeClaude({cwd:'.',prompt:'P',claudePath:'/bin/claude',spawnChild:fake(JSON.stringify({is_error:true,result:'login required'})).spawnChild}),/signed in/);
 await assert.rejects(executeClaude({cwd:'.',prompt:'P',claudePath:'/bin/claude',spawnChild:fake('not json').spawnChild}),/unreadable/);
 await assert.rejects(executeClaude({cwd:'.',prompt:'P',claudePath:null}),/not installed/);
});

test('a checked recording puts one item on Needs you with a link to the check, and takes it off when all is decided',async t=>{
 const f=await setup(t);
 const recordings={transcriptCorrections:(await import('../runtime/services/transcript-corrections.mjs')).createTranscriptCorrections({dir:path.join(f.dataDir,'recordings'),config:{conversationTimestamps:true}})};
 const check=transcriptCheckFor({dataDir:f.dataDir,recordings,options:{available:()=>true,execute:async()=>({text:JSON.stringify(GOOD)})}});
 const base='/api/transcript-check/'+f.id;
 await f.agent('POST',base+'/suggest',{});await check.wait(f.id);
 const asks=async()=>(await f.agent('GET','/api/needs-you?status=all')).body.asks.filter(a=>a.scope?.kind==='recording-check'&&a.scope.id===f.id);
 let mine=await asks();
 assert.equal(mine.length,1);assert.equal(mine[0].status,'open');assert.equal(mine[0].band,'only-adrian');
 assert.equal(mine[0].link.href,'/transcript-check/index.html?job='+f.id);
 assert.match(mine[0].question,/^Review 5 passages in this recording/);assert.doesNotMatch(mine[0].question,/A recording/);
 // A second read of the same check does not raise a second item.
 await check.suggest(f.id);assert.equal((await asks()).length,1);
 let r=await f.page('GET',base);
 r=await f.page('POST',base+'/decide-group',{tier:'sure',expected:r.body.expected});
 r=await f.page('POST',base+'/decide-group',{tier:'notyou',expected:r.body.expected});
 assert.equal((await asks())[0].status,'open','still open while the ear checks wait');
 for(const p of r.body.problems.filter(x=>!x.decision))r=await f.page('POST',base+'/decide',{problemId:p.id,action:'keep',expected:r.body.expected});
 mine=await asks();assert.equal(mine[0].status,'answered');assert.equal(mine[0].resolution.by,'human:adrian');
});

test('a corrected name can be remembered by the shared word library, only by Adrian, only a name this fix changed',async t=>{
 const f=await setup(t);
 const recordings={transcriptCorrections:(await import('../runtime/services/transcript-corrections.mjs')).createTranscriptCorrections({dir:path.join(f.dataDir,'recordings'),config:{conversationTimestamps:true}})};
 const check=transcriptCheckFor({dataDir:f.dataDir,recordings,options:{available:()=>true,execute:async()=>({text:JSON.stringify(GOOD)})}});
 const base='/api/transcript-check/'+f.id;
 await f.agent('POST',base+'/suggest',{});await check.wait(f.id);
 let r=await f.page('GET',base);
 r=await f.page('POST',base+'/decide-group',{tier:'sure',expected:r.body.expected});
 const fixed=r.body.problems.find(p=>p.indexes[0]===1),color=r.body.problems.find(p=>p.indexes[0]===2);
 assert.deepEqual(fixed.decision.names,[{heard:'Navari',spelling:'Newari',remembered:false}]);
 assert.deepEqual(color.decision.names,[],'a plain word is not offered');
 assert.equal((await f.agent('POST',base+'/remember',{problemId:fixed.id,spelling:'Newari'})).status,403);
 assert.equal((await f.page('POST',base+'/remember',{problemId:fixed.id,spelling:'Kathmandu'})).status,400);
 r=await f.page('POST',base+'/remember',{problemId:fixed.id,spelling:'Newari'});assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.problems.find(p=>p.id===fixed.id).decision.names[0].remembered,true);
 const words=(await f.agent('GET','/api/words?q=Newari&status=all')).body;
 const entry=(words.entries||words.words||[]).find(e=>e.spelling==='Newari');
 assert.ok(entry,'Newari is in the library');assert.equal(entry.status,'confirmed');
 assert.ok(entry.variants.some(v=>v.text==='Navari'&&v.kind==='heard'),'the mishearing is remembered as heard');
 assert.equal(entry.source.recording,f.id);
});

test('a model fix quotes the words it replaces, may cross a line break, and is spread back over the lines',()=>{
 const lines=[{text:'Multi generations of...'},{text:"I'm painting in this traditional way."},{text:'Aged tea.'},{text:'Continue down this process.'}];
 const ok=validateSuggestions({problems:[
  {indexes:[0,1],tier:'sure',before:"of... I'm painting",after:'of painting',reason:'r'},
  {indexes:[2,3],tier:'ear',before:'Aged tea. Continue',after:'As he aged, he continued',reason:'A guess.'},
 ]},lines,{strict:true});
 assert.deepEqual(ok[0].fixes,[{index:0,text:'Multi generations of'},{index:1,text:'painting in this traditional way.'}],'no doubled "of"');
 assert.deepEqual(ok[1].fixes.map(f=>f.index),[2,3]);
 assert.equal(ok[1].fixes.map(f=>f.text).join(' '),'As he aged, he continued down this process.');
 assert.throws(()=>validateSuggestions({problems:[{indexes:[2],tier:'sure',before:'Aged coffee',after:'Agate',reason:'r'}]},lines,{strict:true}),/quote words that are in its lines/);
 assert.throws(()=>validateSuggestions({problems:[{indexes:[2],tier:'sure',before:'Aged tea.',after:'',reason:'r'}]},lines,{strict:true}),/cannot empty a whole line/);
});

test('Adrian types over any paragraph: words are spread over its lines, an emptied line is left out, and it undoes',async t=>{
 const f=await setup(t);
 const recordings={transcriptCorrections:(await import('../runtime/services/transcript-corrections.mjs')).createTranscriptCorrections({dir:path.join(f.dataDir,'recordings'),config:{conversationTimestamps:true}})};
 const check=transcriptCheckFor({dataDir:f.dataDir,recordings,options:{available:()=>true,execute:async()=>({text:JSON.stringify(GOOD)})}});
 const base='/api/transcript-check/'+f.id;
 await f.agent('POST',base+'/suggest',{});await check.wait(f.id);
 let r=await f.page('GET',base);
 assert.ok(r.body.paragraphs.length>=1);assert.ok(r.body.segments.every(s=>typeof s.shown==='string'));
 assert.ok(r.body.segments[0].words.length>0,'word times for tap-to-hear');
 // Lines 3 to 4 ("Thank you to all the listeners too." "Aged tea and brush.") retyped: the first emptied, the second changed.
 const indexes=[3,4];
 assert.equal((await f.agent('POST',base+'/edit',{indexes,text:'Agate and brush.',expected:r.body.expected})).status,403,'agents never type over his words');
 r=await f.page('POST',base+'/edit',{indexes,text:'Agate and brush.',expected:r.body.expected});
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.segments[4].text,'Agate and brush.');
 assert.ok(r.body.leftOut.includes(3),'the emptied line is left out of the talk');
 assert.equal(r.body.segments[3].text,'Thank you to all the listeners too.','and kept in the transcript');
 const settled=r.body.problems.filter(p=>p.indexes.some(i=>i===3||i===4));
 assert.ok(settled.every(p=>p.decision?.action==='edited'),'suggestions on lines he changed are settled');
 const editId=r.body.lastEdit;
 // A stale page is refused; then the edit is taken back exactly.
 const stale=await f.page('POST',base+'/edit',{indexes:[0],text:'So today I watched painters at work.',expected:{...r.body.expected,revision:'0'}});assert.equal(stale.status,409);
 r=await f.page('POST',base+'/undo-edit',{editId,expected:r.body.expected});assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.segments[4].text,'Aged tea and brush.');assert.equal(r.body.leftOut.includes(3),false);
 assert.ok(settled.every(s=>!r.body.problems.find(p=>p.id===s.id).decision),'the suggestions come back');
 // An untouched line keeps its stored words exactly, even though the page shows it without its capital.
 r=await f.page('POST',base+'/edit',{indexes:[5,6],text:'It just somehow fits well with each other.',expected:r.body.expected});
 assert.deepEqual([r.body.segments[5].text,r.body.segments[6].text].join(' '),'It just somehow fits well with each other.');
 assert.equal(r.body.segments[0].text,'So today I watched a painter at work.');
});
