import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

// Version two's Capture sheet: the four ways in, how each saves, and what is kept when a save fails. The page runs in
// a DOM with the app's own scripts; commands are answered by a table, and every call is recorded so each test can say
// exactly what was sent. Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const html=read('public/v2/index.html');
const scriptsOf=h=>[...h.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);

const COMMANDS=[
 ['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],
 ['subject.standing','GET','/api/subject/standing',true],['subjects.standing','GET','/api/subjects/standing',true],['recordings','GET','/api/recordings',true],
 ['sources.folders','POST','/api/sources/folders',false],['sources.tree','GET','/api/sources/tree',true],['sources.import','POST','/api/sources/import',false],
 ['study.material.attach','POST','/api/study/material/attach',false],['first-flow.attach','POST','/api/first-flow/attach',false],
 ['.transcription.id.action','POST','/transcription/{id}/{action}',false],
 ['research-topics.start','POST','/api/research-topics/start',false],['research-topics.propose','POST','/api/research-topics/propose',false],
 ['research-topics.read','GET','/api/research-topics/read',true],['research-topics.let-go','POST','/api/research-topics/let-go',false],
].map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));

const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=(ms=20)=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,what)=>{for(let i=0;i<100;i++){if(fn())return;await settle(10);}assert.fail('timed out waiting for '+what);};

/** The page with Capture open or openable. respond(command, input) answers one command (a value, or [status, body]). */
async function capPage({respond,hash='#/subject/p1',actor='',media}={}){
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html'+(actor?'?reviewActor='+actor:'')+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{addEventListener(){}close(){}};
 w.URL.createObjectURL=()=>'blob:invented/'+Math.random().toString(16).slice(2);w.URL.revokeObjectURL=()=>{};
 w.scrollTo=()=>{};
 Object.defineProperty(w,'crypto',{value:globalThis.crypto,configurable:true});
 if(media){w.MediaRecorder=media.Recorder;Object.defineProperty(w.navigator,'mediaDevices',{value:media.devices,configurable:true});}
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href);
  if(u.pathname==='/api/capabilities')return {ok:true,status:200,text:async()=>JSON.stringify({commands:COMMANDS})};
  const command=COMMANDS.find(c=>{const re=new RegExp('^'+c.route.replace(/\{\w+\}/g,'([^/]+)')+'$');return c.method===(options.method||'GET')&&re.test(u.pathname);});
  const body=options.body?JSON.parse(options.body):u.searchParams.has('input')?JSON.parse(u.searchParams.get('input')):Object.fromEntries(u.searchParams);
  calls.push({name:command?.name,path:u.pathname,body,headers:options.headers});
  let answer=command?await respond?.(command.name,body,u):undefined;
  if(answer===undefined)answer={};
  const [status,value]=Array.isArray(answer)&&typeof answer[0]==='number'?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value)};
 };
 for(const src of scriptsOf(html))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(repo,'public/v2',src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(40);
 const doc=w.document;
 const api={w,doc,calls,
  open:async(subject)=>{if(subject!==undefined)w.v2.capture({subject});else doc.querySelector('[data-v2-capture]').click();await settle(30);return doc.querySelector('dialog.v2-capture');},
  sheet:()=>doc.querySelector('dialog.v2-capture'),
  text:()=>doc.querySelector('dialog.v2-capture')?.textContent.replace(/\s+/g,' ').trim(),
  tile:name=>doc.querySelector(`dialog.v2-capture [data-view="${name}"]`).click(),
  press:action=>doc.querySelector(`dialog.v2-capture [data-cap="${action}"]`).click(),
  typeInto:value=>{const el=doc.querySelector('dialog.v2-capture [data-cap-text]');el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));return el;},
  named:name=>calls.filter(c=>c.name===name),
  pick:(kind,files)=>{const input=doc.querySelector(`dialog.v2-capture [data-cap-input="${kind}"]`);Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new w.Event('change',{bubbles:true}));},
 };
 return api;
}
const STANDING={title:'The shaded garden',facts:{bindingId:'bind-1',projectId:'proj-1'}};
const receipt=(name,id='src-1')=>({receipts:[{ok:true,source:{id,name,rel_path:name}}]});
const goodSave=extra=>(name,body)=>{
 if(name==='subject.standing')return STANDING;
 if(name==='sources.import')return receipt(body.files[0].name,'src-'+Math.random().toString(16).slice(2,8));
 if(name==='recordings')return {capability:{ready:false},jobs:[]};
 if(name==='research-topics.start'||name==='research-topics.propose'||name==='research-topics.read')return {id:'topic-1',revision:1,hash:'h1'};
 return extra?.(name,body);
};

test('the helpers: a file name from the first words and the date, audio names and lengths, a subject from an id or an object',()=>{
 const ctx={window:undefined,module:{exports:{}}};ctx.globalThis=ctx;
 vm.runInNewContext(read('public/v2/shell/capture.js'),ctx);const C=ctx.module.exports;
 const when=new Date(2026,10,11,21,5,34);
 assert.equal(C.stamp(when),'2026-11-11 21.05.34');
 assert.equal(C.thoughtName('The leaf is ready by look and touch, not by counting days.',when),'The leaf is ready by look 2026-11-11 21.05.34.md','the first six words');
 assert.equal(C.thoughtName('  ...a/b\\c: "what?"  ',when),'a b c what 2026-11-11 21.05.34.md','characters a file name cannot hold become spaces, nothing else is tidied');
 assert.equal(C.thoughtName('   ',when),'Thought 2026-11-11 21.05.34.md');
 assert.equal(C.audioName(when,'audio/webm;codecs=opus'),'Microphone-2026-11-11 21.05.34.webm');
 assert.equal(C.audioName(when,'audio/mp4'),'Microphone-2026-11-11 21.05.34.m4a');
 assert.equal(C.audioName(when,'audio/ogg;codecs=opus'),'Microphone-2026-11-11 21.05.34.ogg');
 assert.equal(C.clock(7000),'0:07');assert.equal(C.clock(754000),'12:34');
 assert.deepEqual(JSON.parse(JSON.stringify(C.subjectOf('s1'))),{id:'s1',name:''});
 assert.deepEqual(JSON.parse(JSON.stringify(C.subjectOf({parentStudyId:'s2',title:'T'}))),{id:'s2',name:'T'});
 assert.equal(C.subjectOf(null),null);assert.equal(C.subjectOf({name:'x'}),null);
});

test('the client takes a longer wait for one call without changing the others',async()=>{
 const waits=[];
 const ctx={URLSearchParams,URL,JSON,Error,Promise,setTimeout,clearTimeout,console,crypto:globalThis.crypto,AbortSignal:{timeout:ms=>{waits.push(ms);return undefined;}},module:{exports:{}}};ctx.globalThis=ctx;
 vm.runInNewContext(read('public/v2/shell/client.js'),ctx);
 const c=ctx.module.exports.createClient({base:'http://x.test',storage:null,fetchImpl:async u=>({ok:true,status:200,text:async()=>u.includes('capabilities')?JSON.stringify({commands:[{name:'a.write',method:'POST',route:'/api/a',readOnly:false,schema:{}}]}):'{}'})});
 await c.call('a.write',{});await c.call('a.write',{},{timeoutMs:180000});await c.call('a.write',{});
 assert.deepEqual(waits,[20000,20000,180000,20000],'the list of commands and the plain calls keep 20 seconds; the one call asked for more');
});

test('the sheet names where it goes: the open subject, or the Library to file later',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const p=await capPage({respond:async(n,b)=>{if(n==='subject.standing'){await gate;return STANDING;}return goodSave()(n,b);}});
 await p.open({id:'p1',name:'Our name'});
 assert.match(p.text(),/Goes to Our name\. A question goes to Research\./);
 release();await until(()=>/The shaded garden/.test(p.text()),'the subject to be read');
 assert.match(p.text(),/Goes to The shaded garden\. A question goes to Research\./,'the name the app holds wins');
 p.doc.querySelector('dialog.v2-capture [data-cap="back"]')?.click();
 const q=await capPage({respond:goodSave(),hash:'#/'});
 await q.open();
 assert.match(q.text(),/Goes to the Library, to file later\. A question goes to Research\./);
 assert.doesNotMatch(q.text(),/inbox|will wait for you here/);
 const lost=await capPage({respond:(name)=>name==='subject.standing'?[404,{error:'No such subject.'}]:undefined});
 await lost.open({id:'gone'});await settle(40);
 assert.match(lost.text(),/Goes to the Library, to file later/,'a subject that cannot be read does not promise a place it cannot keep');
});

test('a thought is saved exactly as typed, in the subject folder, then attached; Cmd or Ctrl with Enter saves',async()=>{
 const p=await capPage({respond:goodSave()});
 await p.open({id:'p1'});await settle();
 p.tile('thought');
 assert.equal(p.doc.querySelector('dialog.v2-capture [data-cap="save"]').disabled,true,'nothing to save yet');
 const words='  The leaf is ready\n\nby look and touch.   ';
 const area=p.typeInto(words);
 area.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));
 await until(()=>p.named('study.material.attach').length>0,'the attach');
 const imp=p.named('sources.import')[0].body;
 assert.equal(imp.rootId,'library');assert.equal(imp.folder,'Projects/proj-1');
 assert.equal(imp.files[0].content,words,'the words go as typed: nothing trimmed or tidied');
 assert.equal(imp.files[0].base64,undefined);
 assert.match(imp.files[0].name,/^The leaf is ready by look \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.md$/,'its first words and the date');
 assert.deepEqual(p.calls.map(c=>c.name).filter(n=>/sources|attach/.test(n)),['sources.folders','sources.import','study.material.attach']);
 assert.equal(p.named('sources.folders')[0].body.folder,'Projects/proj-1');
 const att=p.named('study.material.attach')[0].body;assert.equal(att.bindingId,'bind-1');assert.equal(att.parentStudyId,'p1');assert.ok(att.operationId);assert.equal(att.sourceIds.length,1);
 assert.match(p.text(),/Thought added to The shaded garden\./);
 const link=p.doc.querySelector('dialog.v2-capture [data-cap-link]');assert.equal(link.getAttribute('href'),'#/subject/p1');
 assert.equal(p.doc.querySelector('dialog.v2-capture [data-cap="undo"]'),null,'no command takes a source back, so no Undo is offered');
 assert.doesNotMatch(p.text(),/Advanced/);
});

test('with no subject a thought goes to the Library root and says so; with a subject that has no project id, the attach is the material one',async()=>{
 const home=await capPage({respond:goodSave(),hash:'#/'});
 await home.open();home.tile('thought');home.typeInto('Only for later.');home.press('save');
 await until(()=>home.named('sources.import').length>0&&/saved in the Library/.test(home.text()),'the done line');
 assert.equal(home.named('sources.import')[0].body.folder,'');
 assert.deepEqual(home.calls.map(c=>c.name).filter(n=>/sources|attach/.test(n)),['sources.import'],'no folder and no attach at the root');
 assert.match(home.text(),/Thought saved in the Library, to file later\./);
 assert.match(home.doc.querySelector('dialog.v2-capture [data-cap-link]').getAttribute('href'),/^\/document-study\/index\.html\?.*section=library/,'the Library is opened in Advanced');
 const noProject=await capPage({respond:(n,b)=>n==='subject.standing'?{title:'T',facts:{bindingId:'bind-9',projectId:null}}:goodSave()(n,b)});
 await noProject.open({id:'p9'});await settle();noProject.tile('thought');noProject.typeInto('Hello');noProject.press('save');
 await until(()=>noProject.named('study.material.attach').length>0,'the attach');
 assert.equal(noProject.named('sources.import')[0].body.folder,'');
 assert.equal(noProject.named('sources.folders').length,0);
 assert.equal(noProject.named('first-flow.attach').length,0);
 const neither=await capPage({respond:(n,b)=>n==='subject.standing'?{title:'T',facts:{}}:goodSave()(n,b)});
 await neither.open({id:'p8'});await settle(40);
 assert.match(neither.text(),/Goes to the Library, to file later/,'with nothing to file under, the sheet says the Library, not a failure');
});

test('a failed save keeps the words and the sheet; Escape and a press outside do not close it; Try again saves it',async()=>{
 let fail=true;
 const p=await capPage({respond:(n,b)=>n==='sources.import'&&fail?[500,{error:'nope'}]:goodSave()(n,b)});
 await p.open({id:'p1'});await settle();p.tile('thought');p.typeInto('Words that must survive.');p.press('save');
 await until(()=>/was not saved/.test(p.text()),'the plain message');
 assert.match(p.text(),/The app could not answer\. Nothing was changed\. Your words are still here: try again\./);
 assert.equal(p.doc.querySelector('dialog.v2-capture [data-cap-text]').value,'Words that must survive.');
 p.sheet().dispatchEvent(new p.w.Event('cancel',{cancelable:true}));assert.ok(p.sheet(),'Escape does not close it');
 p.sheet().dispatchEvent(new p.w.MouseEvent('click',{bubbles:true}));assert.ok(p.sheet(),'a press outside does not close it');
 assert.match(p.text(),/not saved yet/i);
 fail=false;p.press('save');
 await until(()=>/Thought added/.test(p.text()),'the retry');
 p.press('done');assert.equal(p.sheet(),null);
 assert.equal(p.doc.activeElement,p.doc.querySelector('[data-v2-capture]'),'focus returns to the Capture button');
});

test('an unsaved thought or question survives a switch of tile inside the open sheet, and is marked on its tile',async()=>{
 const p=await capPage({respond:goodSave()});
 await p.open({id:'p1'});p.tile('thought');p.typeInto('Half a thought');p.press('back');
 assert.match(p.doc.querySelector('[data-view="thought"]').textContent,/Not saved yet/);
 p.tile('question');p.typeInto('Why is it so?');p.press('back');
 p.tile('thought');assert.equal(p.doc.querySelector('[data-cap-text]').value,'Half a thought');
 p.press('back');p.tile('question');assert.equal(p.doc.querySelector('[data-cap-text]').value,'Why is it so?');
 p.press('discard');assert.equal(p.doc.querySelectorAll('.v2-cap4 button').length,4);assert.doesNotMatch(p.doc.querySelector('[data-view="question"]').textContent,/Not saved yet/,'discarding forgets it');
});

test('a question: a human starts a research topic linked to the subject and can take it back; an assistant proposes it',async()=>{
 const p=await capPage({respond:goodSave()});
 await p.open({id:'p1'});await settle();p.tile('question');
 const line=p.typeInto('Does straw help the leaf? ');
 line.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await until(()=>p.named('research-topics.start').length>0&&/added to Research/.test(p.text()),'the topic');
 const sent=p.named('research-topics.start')[0].body;assert.equal(sent.name,'Does straw help the leaf? ','as typed');assert.deepEqual(sent.subjects,['p1']);assert.ok(sent.operationId);
 assert.equal(p.doc.querySelector('dialog.v2-capture [data-cap-link]').getAttribute('href'),'#/research/topic/topic-1');
 p.press('undo');await until(()=>p.named('research-topics.let-go').length>0,'the let-go');
 const letGo=p.named('research-topics.let-go')[0].body;assert.equal(letGo.id,'topic-1');assert.equal(letGo.expectedRevision,1);assert.equal(letGo.expectedHash,'h1');
 await until(()=>/taken back/.test(p.text()),'the plain line');assert.equal(p.doc.querySelector('dialog.v2-capture [data-cap="undo"]'),null);

 const a=await capPage({respond:goodSave(),actor:'agent:claude-code'});
 await a.open({id:'p1'});a.tile('question');a.typeInto('Is paper as good?');a.press('save');
 await until(()=>a.named('research-topics.propose').length>0&&/proposed to Research/.test(a.text()),'the proposal');
 assert.equal(a.named('research-topics.start').length,0,'an assistant never starts a topic');
 const prop=a.named('research-topics.propose')[0].body;
 assert.deepEqual(prop.subjects,['p1']);assert.equal(prop.origin.kind,'note');assert.equal(prop.origin.ref.kind,'source');assert.ok(prop.origin.ref.id);
 assert.equal(a.named('sources.import')[0].body.files[0].content,'Is paper as good?');
 assert.equal(a.doc.querySelector('dialog.v2-capture [data-cap="undo"]'),null,'a proposal is Adrian to keep or let go');

 const refused=await capPage({respond:(n,b)=>n==='research-topics.start'?[403,{error:'Only Adrian can do this.'}]:goodSave()(n,b)});
 await refused.open({id:'p1'});refused.tile('question');refused.typeInto('A question');refused.press('save');
 await until(()=>/was not sent/.test(refused.text()),'the refusal shown plainly');
 assert.match(refused.text(),/Only Adrian can do this\./);assert.equal(refused.doc.querySelector('[data-cap-text]').value,'A question');
});

function fakeMedia({denied='',onSave}={}){
 const made=[];
 class Recorder{
  static isTypeSupported(t){return t==='audio/webm;codecs=opus';}
  constructor(stream,opts){this.stream=stream;this.mimeType=opts?.mimeType||'audio/webm';this.state='inactive';made.push(this);}
  start(){this.state='recording';}
  feed(bytes){this.ondataavailable?.({data:{size:bytes,type:this.mimeType,_bytes:bytes}});}
  stop(){if(this.state==='inactive')return;this.state='inactive';setTimeout(()=>this.onstop?.(),0);}
 }
 const tracks=[];
 const devices={getUserMedia:async()=>{if(denied){const e=new Error(denied);e.name=denied;throw e;}const t={stopped:false,stop(){this.stopped=true;}};tracks.push(t);return {getTracks:()=>[t]};}};
 return {Recorder,devices,made,tracks};
}

test('Speak: asks for the microphone, shows the time and Stop, then Save and Discard; Save files it, and says plainly when transcription is not set up',async()=>{
 const media=fakeMedia();
 const p=await capPage({respond:goodSave(),media});
 await p.open({id:'p1'});await settle();p.tile('speak');
 await until(()=>media.made.length>0&&p.doc.querySelector('[data-cap="stop"]'),'the recording to begin');
 assert.ok(p.doc.querySelector('[data-cap-time]'),'the time is shown');
 p.sheet().dispatchEvent(new p.w.Event('cancel',{cancelable:true}));assert.ok(p.sheet(),'the sheet does not close while recording');assert.match(p.text(),/Stop the recording first/);
 assert.equal(p.doc.querySelector('[data-cap="back"]').disabled,true);
 media.made[0].feed(1000);p.press('stop');
 await until(()=>p.doc.querySelector('[data-cap="save"]'),'the review');
 assert.ok(p.doc.querySelector('[data-cap="discard"]'));assert.match(p.text(),/Length \d+:\d\d/);assert.ok(media.tracks.every(t=>t.stopped),'the microphone is released');
 p.press('save');
 await until(()=>/Recording added to/.test(p.text()),'the done line');
 const imp=p.named('sources.import')[0].body;assert.match(imp.files[0].name,/^Microphone-\d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.webm$/);assert.equal(typeof imp.files[0].base64,'string');assert.equal(imp.folder,'Projects/proj-1');
 assert.match(p.text(),/Transcription is not set up on this machine/);
 assert.equal(p.named('.transcription.id.action').length,0,'no transcript is started where none can be made');
});

test('Speak: where transcription is ready the transcript is started for the new recording; a failure to start is said, the recording stays saved',async()=>{
 let ready=true,startFails=false;
 const respond=goodSave((n,b)=>{});
 const handler=(n,b)=>{
  if(n==='sources.import')return receipt(b.files[0].name,'audio-1');
  if(n==='recordings')return {capability:{ready},jobs:[{id:'job-1',sourceId:'audio-1',state:'saved'}]};
  if(n==='.transcription.id.action')return startFails?[503,{error:'No engine.'}]:{job:{id:'job-1',state:'running'}};
  return respond(n,b);
 };
 const media=fakeMedia();
 const p=await capPage({respond:handler,media});
 await p.open({id:'p1'});await settle();p.tile('speak');await until(()=>media.made.length>0,'recorder');media.made[0].feed(500);await until(()=>p.doc.querySelector('[data-cap="stop"]'),'stop');p.press('stop');
 await until(()=>p.doc.querySelector('[data-cap="save"]'),'save');p.press('save');
 await until(()=>/transcript has started/.test(p.text()),'the transcript to start');
 const start=p.named('.transcription.id.action')[0];assert.equal(start.path,'/transcription/job-1/start');
 startFails=true;
 const m2=fakeMedia(),q=await capPage({respond:handler,media:m2,hash:'#/'});
 await q.open();q.tile('speak');await until(()=>m2.made.length>0,'recorder');m2.made[0].feed(500);await until(()=>q.doc.querySelector('[data-cap="stop"]'),'stop');q.press('stop');
 await until(()=>q.doc.querySelector('[data-cap="save"]'),'save');q.press('save');
 await until(()=>/could not be started/.test(q.text()),'the plain line');
 assert.match(q.text(),/The recording is saved\. The transcript could not be started: No engine\./);
});

test('Speak: no microphone or permission refused says so and offers an audio file, which goes the same way',async()=>{
 const denied=fakeMedia({denied:'NotAllowedError'});
 const p=await capPage({respond:goodSave(),media:denied});
 await p.open({id:'p1'});await settle();p.tile('speak');await until(()=>/not allowed/.test(p.text()),'the plain line');
 const input=p.doc.querySelector('[data-cap-input="audio"]');assert.equal(input.getAttribute('accept'),'audio/*');
 assert.ok([...p.sheet().querySelectorAll('button')].some(b=>/Add an audio file/.test(b.textContent)));
 const file=new p.w.File([new Uint8Array(200)],'Garden walk.m4a',{type:'audio/mp4'});
 p.pick('audio',[file]);await until(()=>p.doc.querySelector('[data-cap="save"]'),'the file to wait for Save');
 assert.match(p.text(),/Garden walk\.m4a/);
 p.press('save');await until(()=>/Recording added to/.test(p.text()),'the saved recording');
 const imp=p.named('sources.import')[0].body;assert.equal(imp.files[0].name,'Garden walk.m4a');
 const none=await capPage({respond:goodSave(),media:undefined});
 await none.open({id:'p1'});await settle();none.tile('speak');await settle(30);
 assert.match(none.text(),/cannot record from the microphone/);assert.ok(none.doc.querySelector('[data-cap-input="audio"]'));
});

test('Speak: the 8 MB limit stops the recording, keeps what was recorded and says so; a recording that fails to save stays for another try',async()=>{
 const media=fakeMedia();let fail=true;
 const p=await capPage({respond:(n,b)=>n==='sources.import'&&fail?[500,{error:'x'}]:goodSave()(n,b),media});
 await p.open({id:'p1'});await settle();p.tile('speak');await until(()=>media.made.length>0,'recorder');
 media.made[0].feed(8*1024*1024);
 await until(()=>p.doc.querySelector('[data-cap="save"]'),'the review after the limit');
 assert.match(p.text(),/8 MB limit was reached/);assert.match(p.text(),/kept here/);
 p.press('save');await until(()=>/was not saved/.test(p.text()),'the failure');
 assert.match(p.text(),/It is still here: try again\./);assert.equal(p.doc.querySelector('[data-cap="save"]').textContent,'Try again');
 p.sheet().dispatchEvent(new p.w.MouseEvent('click',{bubbles:true}));assert.ok(p.sheet(),'a press outside does not lose the recording');
 fail=false;p.press('save');await until(()=>/Recording added to/.test(p.text()),'the retry');
});

test('Photograph: a camera input and a choose input; each photograph is saved one at a time with its state; one that fails stays with Try again',async()=>{
 let failName='b.jpg',inFlight=0,most=0;
 const p=await capPage({respond:async(n,b)=>{
  if(n==='sources.import'){inFlight++;most=Math.max(most,inFlight);await settle(15);inFlight--;if(b.files[0].name===failName)return [500,{error:'x'}];return receipt(b.files[0].name,'id-'+b.files[0].name);}
  return goodSave()(n,b);}});
 await p.open({id:'p1'});await settle();p.tile('photo');
 const cam=p.doc.querySelector('[data-cap-input="camera"]'),many=p.doc.querySelector('[data-cap-input="choose"]');
 assert.equal(cam.getAttribute('accept'),'image/*');assert.equal(cam.getAttribute('capture'),'environment');assert.equal(many.hasAttribute('multiple'),true);assert.equal(many.getAttribute('accept'),'image/*');
 const file=n=>new p.w.File([new Uint8Array(30)],n,{type:'image/jpeg'});
 p.pick('choose',[file('a.jpg'),file('b.jpg'),file('c.jpg')]);
 await until(()=>/1 photograph was not saved/.test(p.text()),'the end of the run');
 assert.equal(most,1,'one at a time');
 assert.deepEqual([...p.doc.querySelectorAll('.v2-cap-photos li')].map(li=>li.dataset.state),['saved','failed','saved']);
 assert.equal(p.doc.querySelectorAll('.v2-cap-photos img').length,3,'a small preview each');
 assert.deepEqual(p.named('sources.import').map(c=>c.body.files[0].name),['a.jpg','b.jpg','c.jpg']);
 p.sheet().dispatchEvent(new p.w.Event('cancel',{cancelable:true}));assert.ok(p.sheet(),'a photograph that failed is not lost to a closed sheet');
 failName='';p.doc.querySelector('[data-cap="photo-retry"]').click();
 await until(()=>/3 photographs added to/.test(p.text()),'all three done');
 assert.equal(p.named('study.material.attach').length,3);
});

test('Photograph: removing the one that failed finishes with what was saved',async()=>{
 const p=await capPage({respond:(n,b)=>n==='sources.import'&&b.files[0].name==='bad.jpg'?[500,{error:'x'}]:goodSave()(n,b)});
 await p.open({id:'p1'});await settle();p.tile('photo');
 const f=n=>new p.w.File([new Uint8Array(5)],n,{type:'image/jpeg'});
 p.pick('camera',[f('good.jpg')]);await until(()=>/1 photograph added to/.test(p.text()),'the first');p.press('done');
 await p.open({id:'p1'});p.tile('photo');p.pick('choose',[f('bad.jpg')]);await until(()=>p.doc.querySelector('[data-cap="photo-remove"]'),'the failed one');
 p.doc.querySelector('[data-cap="photo-remove"]').click();
 p.sheet().dispatchEvent(new p.w.Event('cancel',{cancelable:true}));assert.equal(p.sheet(),null,'nothing unsaved is left, so Escape closes');
});

test('an assistant who cannot decide is told so in plain words when the app refuses',async()=>{
 const a=await capPage({respond:(n,b)=>n==='research-topics.propose'?[403,{error:'refused'}]:goodSave()(n,b),actor:'agent:claude-code'});
 await a.open({id:'p1'});a.tile('question');a.typeInto('Why?');a.press('save');
 await until(()=>/was not sent/.test(a.text()),'the message');
 assert.match(a.text(),/Only Adrian can decide this\. Claude can propose it, not do it\./);
});

test('the sheet is keyboard-friendly and honest: a dialog with a title, focus in the sheet, tiles are buttons, the new files obey the rules of the look',async()=>{
 const p=await capPage({respond:goodSave()});
 await p.open({id:'p1'});
 assert.equal(p.sheet().getAttribute('aria-label'),'Capture');assert.equal(p.doc.activeElement,p.sheet().querySelector('h2'),'focus starts inside the sheet');
 p.tile('thought');assert.equal(p.doc.activeElement,p.doc.querySelector('[data-cap-text]'),'a text tile puts the cursor in the field');
 p.press('back');assert.equal(p.doc.activeElement,p.doc.querySelector('[data-view="thought"]'),'back returns to the tile it came from');
 const js=read('public/v2/shell/capture.js'),css=read('public/v2/shell/capture.css');
 assert.doesNotMatch(js,/SpeechRecognition|webkitSpeechRecognition/,'his voice is never sent away');
 assert.doesNotMatch(js,/\bfetch\s*\(/,'a command goes through v2.call only');
 assert.doesNotMatch(js+css,/—/,'no em dash');
 for(const size of css.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)px/g)){}
 const fontSizes=[...css.matchAll(/font(?:-size)?:[^;}]*?(?:var\(--v2-t(\d+)\)|(\d+)px)/g)].map(m=>m[1]||m[2]);
 assert.ok(fontSizes.length>0);for(const s of fontSizes)assert.ok(['12','13','14','15','18','22'].includes(s),'type size '+s+' is one of the six');
 assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/,'no hard-coded colour');
});

// ---------- corrections found in review ----------
const nativeClose=p=>{p.sheet().removeAttribute('open');p.sheet().dispatchEvent(new p.w.Event('close'));};
async function recordDraft(p,media){
 p.tile('speak');await until(()=>media.made.length>0&&p.doc.querySelector('[data-cap="stop"]'),'the recording to begin');
 media.made[media.made.length-1].feed(900);p.press('stop');await until(()=>p.doc.querySelector('[data-cap="save"]'),'the review');
}

test('Done and the link do not drop what is still waiting: the done state lists it with a way back to each',async()=>{
 const media=fakeMedia();
 const p=await capPage({respond:goodSave(),media});
 await p.open({id:'p1'});await settle();
 await recordDraft(p,media);p.press('back');
 p.tile('question');p.typeInto('Does straw help?');p.press('back');
 p.tile('thought');p.typeInto('A thought to keep.');p.press('save');
 await until(()=>/Thought added to/.test(p.text()),'the done line');
 assert.match(p.text(),/Still waiting, not saved/);
 const back=[...p.sheet().querySelectorAll('[data-cap-wait] button')].map(b=>b.dataset.view);
 assert.deepEqual(back,['speak','question'],'a way back to the recording and to the question');
 p.press('done');assert.ok(p.sheet(),'Done does not close the sheet while work is waiting');
 assert.match(p.text(),/Something is still waiting, not saved/);
 const link=p.doc.querySelector('dialog.v2-capture [data-cap-link]');
 const click=new p.w.MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(click);
 await settle(20);assert.ok(p.sheet(),'the link does not close the sheet either');assert.equal(click.defaultPrevented,true,'and does not leave the page');
 p.doc.querySelector('[data-cap-wait] [data-view="question"]').click();
 assert.equal(p.doc.querySelector('[data-cap-text]').value,'Does straw help?','the question is still there');
 p.press('save');await until(()=>/Question added to Research/.test(p.text()),'the question');
 assert.match(p.text(),/Still waiting/);assert.equal(p.sheet().querySelectorAll('[data-cap-wait] button').length,1,'only the recording is left');
 p.doc.querySelector('[data-cap-wait] [data-view="speak"]').click();
 assert.ok(p.doc.querySelector('audio'),'the recording is still there');p.press('save');
 await until(()=>/Recording added to/.test(p.text()),'the recording');
 assert.doesNotMatch(p.text(),/Still waiting/);p.press('done');assert.equal(p.sheet(),null,'nothing is waiting, so Done closes');
});

test('a native close (a second Escape) keeps a live recording and the microphone; with nothing waiting it tidies up fully',async()=>{
 const media=fakeMedia();
 const p=await capPage({respond:goodSave(),media});
 await p.open({id:'p1'});await settle();p.tile('speak');
 await until(()=>media.made.length>0&&p.doc.querySelector('[data-cap="stop"]'),'recording');
 nativeClose(p);await settle(20);
 assert.ok(p.sheet()&&p.sheet().hasAttribute('open'),'the dialog is open again');
 assert.equal(media.tracks.some(t=>t.stopped),false,'the microphone is still live and still the sheet\'s');
 assert.ok(p.doc.querySelector('[data-cap="stop"]'),'still recording');
 await p.open({id:'p1'});assert.equal(p.doc.querySelectorAll('dialog.v2-capture').length,1,'Capture focuses the same open sheet');
 media.made[0].feed(700);p.press('stop');await until(()=>p.doc.querySelector('[data-cap="save"]'),'the review');
 assert.ok(media.tracks.every(t=>t.stopped),'the microphone is released when the recording ends');
 nativeClose(p);await settle(20);assert.ok(p.sheet()&&p.sheet().hasAttribute('open'),'an unsaved recording is kept too');
 p.press('discard');nativeClose(p);await settle(20);
 assert.equal(p.sheet(),null,'with nothing waiting the sheet is tidied away');
 await p.open({id:'p1'});assert.ok(p.sheet().hasAttribute('open'),'and Capture opens a new one');
});

/** A server that keeps what it is sent in a table and can lose its answer, as a network drop would. */
function lossyServer({dropFirst=true}={}){
 const files=[];let dropped=false;
 const tree=()=>({roots:[{id:'library',tree:{rel_path:'',files:[],folders:[{rel_path:'Projects',files:[],folders:[{rel_path:'Projects/proj-1',folders:[],files:files.map(f=>({rel_path:'Projects/proj-1/'+f.name,name:f.name,size_bytes:f.size,id:f.id,hash:f.hash,provenance:{capturedAt:new Date(f.at).toISOString()}}))}]}]}}]});
 const respond=(name,body)=>{
  if(name==='sources.import'){
   const f=body.files[0],id='src-'+(files.length+1);
   if(!files.some(x=>x.name===f.name)){const b=f.content!=null?Buffer.from(f.content):Buffer.from(f.base64,'base64');files.push({name:f.name,size:b.length,id,hash:createHash('sha256').update(b).digest('hex'),at:Date.now()});}
   if(dropFirst&&!dropped){dropped=true;throw new Error('connection dropped');}
   return receipt(f.name,id);
  }
  if(name==='sources.folders'||name==='sources.tree')return tree();
  return goodSave()(name,body);
 };
 return {respond,files};
}

test('an import whose answer is lost is not saved twice: the sheet says it may be saved, looks for the file by name, and goes on to the attach',async()=>{
 const srv=lossyServer();
 const p=await capPage({respond:srv.respond});
 await p.open({id:'p1'});await settle();p.tile('thought');p.typeInto('Words saved while the answer got lost.');p.press('save');
 await until(()=>/may already be saved/.test(p.text()),'the plain line');
 assert.doesNotMatch(p.text(),/Nothing was changed/);
 assert.equal(p.doc.querySelector('[data-cap-text]').value,'Words saved while the answer got lost.','the words are kept');
 p.press('save');
 await until(()=>/Thought added to/.test(p.text()),'the retry to finish');
 assert.equal(p.named('sources.import').length,1,'no second copy was sent');
 assert.equal(srv.files.length,1);
 assert.equal(p.named('study.material.attach').length,1);assert.deepEqual(p.named('study.material.attach')[0].body.sourceIds,['src-1'],'the found file is the one attached');
});

test('an import whose answer is lost and which never reached the server is sent again, under the same file name',async()=>{
 let tries=0;const names=[];
 const p=await capPage({respond:(n,b)=>{
  if(n==='sources.import'){tries++;names.push(b.files[0].name);if(tries===1)throw new Error('connection dropped');}
  return goodSave()(n,b);}});
 await p.open({id:'p1'});await settle();p.tile('thought');p.typeInto('Nothing reached the server.');p.press('save');
 await until(()=>/may already be saved/.test(p.text()),'the plain line');
 p.press('save');await until(()=>/Thought added to/.test(p.text()),'the retry');
 assert.equal(tries,2);assert.equal(names[0],names[1],'one name per capture, reused on the retry');
});

test('a question an assistant asks saves its note once: a failed proposal is retried with the note already saved',async()=>{
 let fail=true;
 const p=await capPage({actor:'agent:claude-code',respond:(n,b)=>n==='research-topics.propose'&&fail?[500,{error:'x'}]:goodSave()(n,b)});
 await p.open({id:'p1'});await settle();p.tile('question');p.typeInto('Is paper as good?');p.press('save');
 await until(()=>/was not sent/.test(p.text()),'the failure');
 fail=false;p.press('save');await until(()=>/proposed to Research/.test(p.text()),'the retry');
 assert.equal(p.named('sources.import').length,1,'the note is not saved a second time');
 assert.equal(p.named('research-topics.propose').length,2);
 assert.equal(p.named('research-topics.propose')[1].body.origin.ref.id,p.named('research-topics.propose')[0].body.origin.ref.id);
});

test('when every attach step is refused the done line says it is saved in the subject\'s folder, with the reason, not that it was added',async()=>{
 const p=await capPage({respond:(n,b)=>n==='study.material.attach'||n==='first-flow.attach'?[409,{error:'The subject is locked by someone else.'}]:goodSave()(n,b)});
 await p.open({id:'p1'});await settle();p.tile('thought');p.typeInto('Kept anyway.');p.press('save');
 await until(()=>/Thought saved/.test(p.text()),'the done line');
 assert.match(p.text(),/Thought saved in the folder of The shaded garden\./);
 assert.doesNotMatch(p.text(),/added to The shaded garden/);
 assert.match(p.text(),/could not be attached/);
 assert.match(p.text(),/This changed since it was opened here|locked/,'the reason');
});

test('the tiles and the done line keep the sample\'s measures, and the destination is set in the ink token',()=>{
 const css=read('public/v2/shell/capture.css');
 assert.doesNotMatch(css,/min-height:9[26]px/,'the tile has no taller floor than the sample');
 assert.match(css,/padding:18px 6px 14px/);
 assert.match(css,/\.v2-cap-to b\{[^}]*color:var\(--ink\)[^}]*font-weight:(600|700)/);
 assert.match(css,/\.v2-cap-done \.v2-ic\{[^}]*width:16px/);
});

/** A Library that names a second file of the same name name-2, name-3, keeps each file's SHA-256 and the time it was saved,
    and can lose the answer after the file landed (dropAfter) or before it arrived (dropBefore), and replays a repeated operationId. */
function libraryServer({older=[],dropAfter=0,dropBefore=0}={}){
 const files=older.map((f,i)=>({name:f.name,bytes:Buffer.from(f.bytes),id:'old-'+i,at:Date.now()-3600e3}));let after=dropAfter,before=dropBefore,imports=0;
 const bytesOf=f=>f.content!=null?Buffer.from(f.content):Buffer.from(f.base64,'base64');
 const tree=()=>({roots:[{id:'library',tree:{rel_path:'',files:[],folders:[{rel_path:'Projects',files:[],folders:[{rel_path:'Projects/proj-1',folders:[],files:files.map(f=>({rel_path:'Projects/proj-1/'+f.name,name:f.name,size_bytes:f.bytes.length,id:f.id,hash:createHash('sha256').update(f.bytes).digest('hex'),modified_at:new Date(f.at).toISOString(),provenance:{capturedAt:new Date(f.at).toISOString()}}))}]}]}}]});
 const respond=(name,body)=>{
  if(name==='sources.import'){
   imports++;if(before>0){before--;throw new Error('connection dropped');}
   const f=body.files[0],dot=f.name.lastIndexOf('.'),stem=dot>0?f.name.slice(0,dot):f.name,ext=dot>0?f.name.slice(dot):'';
   let n=f.name,k=2;while(files.some(x=>x.name===n))n=stem+'-'+(k++)+ext;
   const id='src-'+(files.length+1);files.push({name:n,bytes:bytesOf(f),id,at:Date.now()});
   if(after>0){after--;throw new Error('connection dropped');}
   return receipt(n,id);
  }
  if(name==='sources.folders'||name==='sources.tree')return tree();
  return goodSave()(name,body);
 };
 return {respond,files,imports:()=>imports};
}
const jpeg=bytes=>Uint8Array.from(bytes);

test('a lost answer for a photograph named like an earlier one: Try again finds this save by its content under name-2, and saves nothing twice',async()=>{
 const srv=libraryServer({older:[{name:'image.jpg',bytes:[9,9,9]}],dropAfter:1});
 const p=await capPage({respond:srv.respond});
 await p.open({id:'p1'});await settle();p.tile('photo');
 p.pick('choose',[new p.w.File([jpeg([1,2,3,4,5])],'image.jpg',{type:'image/jpeg'})]);
 await until(()=>/may already be saved/.test(p.text()),'the lost answer');
 p.doc.querySelector('[data-cap="photo-retry"]').click();
 await until(()=>/1 photograph/.test(p.text())&&/added to/.test(p.text()),'the retry to finish');
 assert.equal(srv.imports(),1,'no second copy was sent');
 assert.deepEqual(srv.files.map(f=>f.name),['image.jpg','image-2.jpg'],'no image-3');
 assert.deepEqual(p.named('study.material.attach')[0].body.sourceIds,['src-2'],'the file the app saved, not the older one');
});

test('a photograph whose request never arrived is not taken for an older file of the same name and size: it is sent again',async()=>{
 const srv=libraryServer({older:[{name:'image.jpg',bytes:[1,2,3,4,5]}],dropBefore:1});
 const p=await capPage({respond:srv.respond});
 await p.open({id:'p1'});await settle();p.tile('photo');
 p.pick('choose',[new p.w.File([jpeg([1,2,3,4,5])],'image.jpg',{type:'image/jpeg'})]);
 await until(()=>/may already be saved/.test(p.text()),'the lost answer');
 p.doc.querySelector('[data-cap="photo-retry"]').click();
 await until(()=>/added to/.test(p.text()),'the retry to finish');
 assert.equal(srv.imports(),2,'it was sent again');
 assert.deepEqual(srv.files.map(f=>f.name),['image.jpg','image-2.jpg'],'his photograph is really saved');
 assert.deepEqual(p.named('study.material.attach')[0].body.sourceIds,['src-2'],'the new file is attached, not the older one');
});

test('a thought and a recording get the same care: found by content under a numbered name, never twice',async()=>{
 const t=libraryServer({dropAfter:1});
 const p=await capPage({respond:t.respond});
 await p.open({id:'p1'});await settle();p.tile('thought');p.typeInto('Same words.');p.press('save');
 await until(()=>/may already be saved/.test(p.text()),'the lost answer');
 // an earlier file of that very name appears meanwhile, as if saved before: the content still tells them apart
 p.press('save');await until(()=>/Thought added to/.test(p.text()),'the retry');
 assert.equal(t.imports(),1);
 const r=libraryServer({older:[{name:'clip.webm',bytes:[7]}],dropAfter:1});
 const q=await capPage({respond:r.respond});
 await q.open({id:'p1'});await settle();q.tile('speak');
 q.pick('audio',[new q.w.File([jpeg([1,2,3])],'clip.webm',{type:'audio/webm'})]);
 await settle();q.press('save');await until(()=>/may already be saved/.test(q.text()),'the lost answer');
 q.press('save');await until(()=>/Recording added to/.test(q.text()),'the retry');
 assert.equal(r.imports(),1);assert.deepEqual(r.files.map(f=>f.name),['clip.webm','clip-2.webm']);
});

/** A research service that replays a repeated operationId and can lose its answer once. */
function topicServer(command,{dropFirst=true}={}){
 const made=new Map();let dropped=false;
 const respond=(name,body)=>{
  if(name===command){
   if(!made.has(body.operationId))made.set(body.operationId,{id:'topic-'+(made.size+1),revision:1,hash:'h1'});
   if(dropFirst&&!dropped){dropped=true;throw new Error('connection dropped');}
   return made.get(body.operationId);
  }
  return goodSave()(name,body);
 };
 return {respond,made};
}

test('a question whose answer was lost: Try again sends the same operationId, makes one topic, and the sheet does not claim nothing was changed',async()=>{
 for(const [actor,command,done] of [['','research-topics.start',/Question added to Research/],['agent:claude-code','research-topics.propose',/Question proposed to Research/]]){
  const srv=topicServer(command);
  const p=await capPage({respond:srv.respond,actor});
  await p.open({id:'p1'});await settle();p.tile('question');p.typeInto('Does straw help?');p.press('save');
  await until(()=>/may (already|not)/.test(p.text())&&p.named(command).length===1,'the lost answer');
  assert.doesNotMatch(p.text(),/was not sent|Nothing was changed/,'it cannot say that: the question may have arrived');
  assert.match(p.text(),/may already have been sent/);
  p.press('save');await until(()=>done.test(p.text()),'the retry');
  const sent=p.named(command);assert.equal(sent.length,2);assert.equal(sent[1].body.operationId,sent[0].body.operationId,'one operationId for these words');
  assert.equal(srv.made.size,1,'one topic');
  // new words are a new question
  const q=await capPage({respond:topicServer(command,{dropFirst:true}).respond,actor});
  await q.open({id:'p1'});await settle();q.tile('question');q.typeInto('First words');q.press('save');
  await until(()=>/may already have been sent/.test(q.text()),'lost');
  q.typeInto('Other words');q.press('save');await until(()=>q.named(command).length===2,'second');
  assert.notEqual(q.named(command)[1].body.operationId,q.named(command)[0].body.operationId,'changed words get a new operationId');
 }
});
