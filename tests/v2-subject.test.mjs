// Version two's subject page. First the pure part (records to facts, facts to forms and steps, every step and hand-off
// mapped onto the existing workspace's twelve sections, which reads a change touches), then the page itself on a real
// in-process server filled with invented subjects through the app's own commands. Invented subjects, people and words.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

const repo=path.resolve(import.meta.dirname,'..');
// The screen file, run as the browser runs it but with no shell: it hands back only its pure half.
const S=(()=>{const ctx={module:{exports:{}},Date,JSON,Object,Array,Set,Map,String,Number,Math,isNaN,console};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync(path.join(repo,'public/v2/screens/subject.js'),'utf8'),ctx);
 // Values made in another context have their own prototypes; hand them back as this context's plain values.
 const own=v=>v===undefined?v:JSON.parse(JSON.stringify(v));return Object.fromEntries(Object.entries(ctx.module.exports).map(([k,v])=>[k,typeof v==='function'?(...a)=>own(v(...a)):own(v)]));})();
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');
const plain=v=>JSON.parse(JSON.stringify(v));
const STATES=new Set(['done','now','flag','todo','wait']);

// ---------- invented facts ----------
const material=(o={})=>S.sortMaterial([...Array(o.notes??2)].map((_,i)=>({id:'n'+i,title:'Invented note '+i,kind:'note'})).concat([...Array(o.photos??0)].map((_,i)=>({id:'p'+i,title:'Invented photo '+i,kind:'image'})),[...Array(o.recordings??0)].map((_,i)=>({id:'r'+i,title:'Invented recording '+i,kind:'transcript'}))));
const facts=(o={})=>({id:'s1',title:'An invented subject',bindingId:'b1',material:material(o.material),transcript:{checks:[],flags:[],planned:false,...o.transcript},research:{step:'review',unreviewed:2,...o.research},dish:{named:false,dishes:0,...o.dish},words:{paragraphs:0,count:0,parts:[],...o.words},pending:o.pending??0,check:o.check??null,consent:o.consent===undefined?{people:[],released:false,overridden:false,ready:false,held:false,reasons:[]}:o.consent,pieces:o.pieces||[],reading:o.reading||[]});
const article={key:'out:a1',id:'a1',kind:'article',title:'An invented subject',placements:0,slides:0};
const plan=(p={},key='p1',title='Invented plan')=>({key:'ig:'+key,id:key,kind:'instagram',title,plan:{id:key,format:'carousel',stories:0,chosen:false,chosenTitle:'',frames:0,caption:false,ready:false,look:null,revision:1,...p}});
const by=(steps,id)=>steps.find(s=>s.id===id);
const rows=steps=>steps.map(s=>[s.id,s.state]);
const named={named:true,from:'direction'};

test('a brand new subject: not decided yet, one first step to gather, and naming the dish waits',()=>{
 const f=facts({material:{notes:0}});
 assert.deepEqual(S.formsOf(f),[]);
 const steps=S.stepsFor(null,f);
 assert.deepEqual(steps.map(s=>[s.id,s.state,s.note]),[['have','now','Nothing yet'],['dish','wait','When there is something to look at']]);
 assert.equal(S.firstOpen(steps),'have');
});

test('a finished Article: the words are done, Check is next, and the page opens on Check (not on research)',()=>{
 const f=facts({material:{notes:2},dish:named,words:{paragraphs:6,count:99,parts:[]},pieces:[article]});
 const steps=S.stepsFor(S.formsOf(f)[0],f);
 assert.deepEqual(rows(steps),[['have','done'],['facts','todo'],['dish','done'],['words','done'],['photos','wait'],['check','now'],['yes','todo'],['publish','wait']]);
 assert.equal(by(steps,'words').note,'99 words');
 assert.equal(by(steps,'facts').note,'2 sources not looked at yet','sources not looked at do not stop the work');
 assert.equal(S.firstOpen(steps),'check');
});

test('a half-written Article with a suggestion waiting: the words need him, Check and Publish wait for them',()=>{
 const f=facts({material:{notes:2,recordings:1},dish:{named:true,from:'board',at:'2026-11-08T10:00:00Z'},words:{paragraphs:2,count:40,parts:[]},pending:1,pieces:[article]});
 const [form]=S.formsOf(f);assert.deepEqual([form.name,form.to],['Article','the magazine']);
 const steps=S.stepsFor(form,f);
 assert.deepEqual(steps.map(s=>s.group),['Gather','Gather','Research','Simmer','Create','Create','Create','Share','Share']);
 assert.deepEqual(rows(steps),[['have','done'],['transcript','todo'],['facts','todo'],['dish','done'],['words','flag'],['photos','wait'],['check','wait'],['yes','now'],['publish','wait']]);
 assert.equal(by(steps,'dish').note,'Named on the board, 8 Nov');
 assert.equal(by(steps,'words').note,'1 suggestion waiting');
 assert.deepEqual(by(steps,'check').waits,['words']);
 assert.deepEqual(by(steps,'publish').waits,['words','check','yes']);
 assert.equal(by(steps,'publish').note,'Waits for the words, the check and your yes');
 assert.equal(S.firstOpen(steps),'words');
 assert.ok(steps.every(s=>STATES.has(s.state)));
 assert.equal(steps.filter(s=>s.state==='now').length,1,'one next thing to make');
 assert.deepEqual(plain(S.progress(steps)),{done:2,total:9,p:2/9,label:'2/9'});
});

test('photographs that are missing say so and lead to where they are added, not to a step that is done',()=>{
 const f=facts({material:{notes:1},dish:named,words:{paragraphs:1,count:5},pieces:[article]});
 const s=by(S.stepsFor(S.formsOf(f)[0],f),'photos');
 assert.deepEqual([s.state,s.note,s.missing,s.waits],['wait','No photographs added yet','addPhotos',undefined]);
 assert.equal(S.HANDOFFS[s.missing].section,'material');
 const placed=facts({material:{notes:1,photos:2},pieces:[{...article,placements:2}]});
 assert.deepEqual(plain(by(S.stepsFor(S.formsOf(placed)[0],placed),'photos')).note,'2 placed');
});

test('naming the dish says where it was named: on the Simmer board, from his direction, or not yet',()=>{
 const at=dish=>by(S.stepsFor(null,facts({material:{notes:1},dish})),'dish');
 assert.deepEqual([at({named:true,from:'board',at:'2026-11-08T10:00:00Z'}).note,at(named).note,at({named:false,dishes:0}).note,at({named:false,dishes:2}).note],['Named on the board, 8 Nov','From your direction','Not named yet','2 possible dishes']);
 // From the records: the board's named dish wins over the direction; with neither it is not named.
 const rec=(board,direction)=>S.factsFrom('s1',{board:{forming:board},direction:{body:direction,updatedAt:'2026-11-09T00:00:00Z'}}).dish;
 assert.deepEqual([rec({named:'An invented dish',sentAt:'2026-11-08T00:00:00Z'},'').from,rec({},'An invented direction.').from,rec({},'').named],['board','direction',false]);
});

test('every one of the twelve sections is reachable from a real step of every form, a Carousel alone included',()=>{
 const f=facts({material:{notes:1,recordings:1}});
 for(const form of [{kind:'article',piece:article},{kind:'post',piece:{...article,kind:'post'}},{kind:'product-listing',piece:{...article,kind:'product-listing'}},{kind:'instagram',piece:plan()}]){
  assert.deepEqual(S.reached(S.stepsFor(form,f)),S.TWELVE,form.kind+' reaches all twelve');
 }
});

test('a Carousel (an Instagram plan): the story, the slides, the post text, words to confirm, and Post waiting',()=>{
 let f=facts({material:{notes:1,photos:4},transcript:{flags:[{id:'F1',heard:'twenty'}],planned:true},pieces:[plan()]});
 let [form]=S.formsOf(f);assert.deepEqual([form.kind,form.name,form.to],['instagram','Carousel','Instagram']);
 let steps=S.stepsFor(form,f);
 assert.deepEqual(plain(steps.filter(s=>s.group!=='Research').map(s=>[s.id,s.state,s.note])),[['have','done','1 note · 4 photographs'],['transcript','flag','1 word to confirm'],['dish','todo','Not named yet'],['story','wait','Waits for stories to be proposed'],['slides','wait','Waits for the story'],['posttext','wait','Waits for the slides'],['yes','todo','Not answered yet'],['publish','wait','Waits for the words to confirm, the slides, the post text and your yes']]);
 f=facts({material:{notes:1},transcript:{planned:true},consent:{people:[],released:true,reasons:[]},pieces:[plan({stories:1,chosen:true,chosenTitle:'Invented story',frames:6,caption:true,ready:true})]});
 steps=S.stepsFor(S.formsOf(f)[0],f);
 assert.deepEqual(plain(['transcript','story','slides','posttext','yes','publish'].map(id=>[by(steps,id).state,by(steps,id).note])),[['done','Every word confirmed'],['done','Invented story'],['done','6 slides'],['done','Written'],['done','Given'],['done','Ready to post']]);
});

test('forms of the same name are told apart by the piece\'s own name; a Post goes to Instagram',()=>{
 const forms=S.formsOf(facts({pieces:[plan({},'p1','Spring rows'),plan({},'p2','Autumn rows'),{...article,key:'out:x',id:'x',kind:'post'}]}));
 assert.deepEqual(forms.map(f=>[f.name,f.alike,f.piece.title]),[['Carousel',true,'Spring rows'],['Carousel',true,'Autumn rows'],['Post',false,'An invented subject']]);
 assert.equal(forms[2].to,'Instagram');
});

test('what is still being read says Reading, and the page opens no step until everything it rests on is known',()=>{
 const f=facts({material:{notes:2},dish:named,words:{paragraphs:3,count:60},pieces:[article],reading:['research','check']});
 const steps=S.stepsFor(S.formsOf(f)[0],f);
 assert.deepEqual([by(steps,'facts').state,by(steps,'facts').note,by(steps,'check').state,by(steps,'publish').state],['reading','Reading','reading','reading']);
 assert.equal(S.firstOpen(steps),null,'nothing is chosen while anything is being read');
 assert.equal(S.firstOpen(steps,{settle:false}),'yes','only when told to settle: the first known step that needs him');
 // From records: nothing arrived yet is all Reading; one record arriving fills only what rests on it.
 const none=S.factsFrom('s1',{});
 assert.deepEqual(none.reading.sort(),['check','consent','dish','material','pieces','research','transcript','words']);
 const some=S.factsFrom('s1',{catalog:{collections:[{parentStudyId:'s1',bindingId:'b1',title:'Invented'}]},desk:{people:[],release:{}}});
 assert.equal(some.title,'Invented');assert.ok(!some.reading.includes('consent'));assert.ok(some.reading.includes('words'));
});

test('a change re-asks only the reads its kind touches',()=>{
 assert.deepEqual(S.touched('consent.people.record'),['desk']);
 assert.deepEqual(S.touched('study-draft.check.post'),['check']);
 assert.deepEqual(S.touched('study-draft.save'),['read','check','requests']);
 assert.deepEqual(S.touched('instagram.plan.post'),['plans']);
 assert.deepEqual(S.touched('study.outputs.create'),['outputs']);
 assert.deepEqual(S.touched('needs-you.raise'),[],'a kind this page does not read touches nothing');
 assert.deepEqual(S.touched('study.human-direction.write'),['direction','board']);
 for(const [,keys] of [['x',S.touched('sources.import')]])for(const k of keys)assert.ok(S.READS.includes(k));
});

test('every hand-off names the section its label says, pinned',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(S.HANDOFFS).map(([k,v])=>[k,[v.label,v.section]])),{
  directionChange:['Change','direction'],directionWrite:['Write it','direction'],
  addMaterial:['Add it in Advanced','material'],readSources:['Read them in Advanced','source'],readTranscript:['Read the transcript in Advanced','source'],
  research:['Open Research in Advanced','research'],researchLook:['Look at them in Advanced','research'],
  board:['Open the board in Advanced','subjects'],dishChange:['Change it in Advanced','direction'],dishWrite:['Write it in Advanced','direction'],
  write:['Write','write'],read:['Read it through','read'],
  media:['Choose photographs in Advanced','media'],arrange:['Place them in Advanced','arrange'],addPhotos:['Add photographs in Advanced','material'],
  checkRun:['Run the check in Advanced','check'],checkOpen:['Open the check in Advanced','check'],
  slides:['Open the slides in Advanced','arrange'],desk:['Open the desk in Advanced','share'],
  outputs:['Open Outputs in Advanced','outputs'],audience:['See it as readers will, in Advanced','audience'],
  postWrite:['Write in Advanced','write'],postRead:['Read in Advanced','read'],postCheck:['Check in Advanced','check'],
 });
 // Where a label names a section of the workspace, that is the section it lands on.
 for(const {label,section} of Object.values(S.HANDOFFS)){const m=label.match(/^(Write|Read|Check) in Advanced$|^Open (Research|Outputs) in Advanced$/);if(m)assert.equal(section,(m[1]||m[2]).toLowerCase(),label);if(/the check/.test(label))assert.equal(section,'check',label);}
 // Each step reaches the sections of its own hand-offs.
 assert.deepEqual(plain(S.SECTIONS.words),['write','read']);assert.deepEqual(plain(S.SECTIONS.check),['check']);assert.deepEqual(plain(S.SECTIONS.posttext),['write','read','check']);
});

test('check and the words: never checked, checked clean, something to look at, a stale check',()=>{
 const at=c=>{const f=facts({material:{notes:1},dish:named,words:{paragraphs:3,count:60,parts:[]},check:c}),steps=S.stepsFor({kind:'article',piece:article},f);return [by(steps,'words').state,by(steps,'check').state,by(steps,'check').note];};
 assert.deepEqual(at(null),['done','now','Not checked yet']);
 assert.deepEqual(at({status:'checked',issues:0}),['done','done','Checked']);
 assert.deepEqual(at({status:'checked',issues:2}),['done','flag','2 things to look at']);
 assert.deepEqual(at({status:'stale',issues:0}),['done','flag','Check again']);
 assert.deepEqual(at({status:'running',issues:0}),['done','wait','Checking']);
});

test('her yes, from the consent desk: who is asked, who said no, and the wait',()=>{
 const person=(state,request=null)=>({id:'x',name:'Mrs. Invented',appears:['named'],state,request});
 const yes=consent=>by(S.stepsFor({kind:'article',piece:article},facts({material:{notes:1},consent})),'yes');
 const one=yes({people:[person('not-asked')],reasons:[]});
 assert.deepEqual([one.name,one.state,one.note],['Mrs. Invented’s yes','todo','Not asked yet']);
 assert.equal(yes({people:[person('not-asked',{text:'Invented'})],reasons:[]}).note,'Request drafted, not sent');
 assert.deepEqual([yes({people:[person('asked')],reasons:[]}).state,yes({people:[person('asked')],reasons:[]}).note],['wait','Asked, no answer yet']);
 assert.deepEqual([yes({people:[person('no')],reasons:[]}).state,yes({people:[person('no')],reasons:[]}).note],['flag','Mrs. Invented said no']);
 assert.equal(yes({people:[person('yes'),{...person('yes'),name:'Another'}],ready:true,held:false,reasons:[]}).name,'Their yes');
 assert.equal(yes({people:[],overridden:true,reasons:[]}).state,'done');
 assert.equal(yes(null).note,'Could not be read');
});

test('Add a form offers only what the app can make, each saying what it needs and why it cannot be made yet',()=>{
 const none=S.addable(facts({material:{notes:0}}));
 assert.deepEqual(plain(none.map(k=>[k.kind,k.ready,k.why])),[['article',false,'Write a few words first.'],['carousel',false,'Add a recording or a note first.'],['post',true,''],['product-listing',true,'']]);
 assert.ok(S.addable(facts({material:{notes:1},words:{paragraphs:1,count:5,parts:[]}})).every(k=>k.ready&&k.needs));
 assert.ok(S.addable({...facts({material:{notes:1},words:{paragraphs:1}}),bindingId:null}).filter(k=>k.kind!=='carousel').every(k=>!k.ready),'no saved writing place: nothing made from it');
});

test('material is sorted into recordings, notes, links and photographs',()=>{
 const m=S.sortMaterial([{id:'1',kind:'image'},{id:'2',kind:'audio'},{id:'3',kind:'note'},{id:'4',kind:'',url:'https://example.invalid/x'},{id:'5',kind:'note',transcriptState:{jobId:'j'}},{id:'6',rel_path:'Projects/x/a.JPG'}]);
 assert.deepEqual([m.total,m.recordings,m.notes,m.links,m.photos],[6,2,1,1,2]);
});

test('no em dash, only the six sizes, no hard-coded colour, every rule under the screen\'s own class',()=>{
 for(const file of ['public/v2/screens/subject.js','public/v2/screens/subject.css']){const text=fs.readFileSync(path.join(repo,file),'utf8');assert.doesNotMatch(text,/—/,file);}
 const css=fs.readFileSync(path.join(repo,'public/v2/screens/subject.css'),'utf8');
 assert.deepEqual([...new Set([...css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)].map(m=>m[1]))],[],'sizes come from the six size tokens only');
 assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b/i,'no hard-coded colour');
 const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes subj-[\w-]+\{[^{}]*\{[^{}]*\}\}/g,'').split('}').map(r=>r.replace(/^(\s*@[^{]*\{)+/,'').trim()).filter(r=>r.includes('{'));
 for(const r of rules)assert.match(r,/^(?:html\[data-brand\] )?(?:\.subj\b|\.subj-sheetdlg\b|dialog\.subj-sheetdlg\b)/,'every rule starts with the screen\'s own class: '+r.slice(0,60));
});

// ---------- the page, on a real server with invented subjects ----------
const windows=[];after(()=>{for(const w of windows)w.close();});
async function server(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 return 'http://127.0.0.1:'+s.address().port;
}
async function page(base,hash){
 const html=fs.readFileSync(path.join(repo,'public/v2/index.html'),'utf8');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,sources=[],calls=[];windows.push(w);
 w.EventSource=class{constructor(u){this.url=u;this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push(u.pathname);const r=await fetch(base+u.pathname+u.search,{method:options.method||'GET',headers:{...options.headers,...(options.method&&options.method!=='GET'?{Origin:base}:{})},body:options.body});return {ok:r.ok,status:r.status,text:()=>r.text()};};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(repo,'public/v2',src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,doc:w.document,sources,calls};
}
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await new Promise(r=>setTimeout(r,25));}};
const sectionOf=href=>new URL(href,'http://x').searchParams.get('section');

test('the page on real records: Reading first, one step chosen once, hand-offs named right, live changes re-ask only what they touch',{timeout:300000},async t=>{
 const base=await server(t);
 await fillDemo(base,{only:['questions-for-the-grower','shade-and-patience','the-first-cup']});
 // A brand new subject.
 {const {doc}=await page(base,'#/subject/demo-questions-for-the-grower');
  await until(()=>doc.querySelector('[data-subj-panel]:not([hidden]) h2'));
  assert.equal(doc.querySelector('.subj-head h1').textContent,'Questions for the grower');
  assert.equal(doc.querySelector('.subj-path').textContent,'Tea / Gardens');
  assert.match(doc.querySelector('.subj-form.none').textContent,/Not decided yet/);
  assert.deepEqual([...doc.querySelectorAll('.subj-row')].map(r=>[r.querySelector('b').textContent,r.dataset.state]),[['What you have','now'],['Name the dish','wait']]);
  assert.equal(doc.querySelector('[data-subj-panel] h2').textContent,'What you have');
  assert.equal(doc.querySelectorAll('.subj-ways a').length,3,'the ways to add material');
  assert.equal(doc.querySelectorAll('.subj-ways a svg').length,6,'each with its icon');
  assert.deepEqual([...doc.querySelectorAll('.subj-all a')].map(a=>[a.textContent,sectionOf(a.getAttribute('href'))]),S.TWELVE.map(s=>[S.SECTION_LABEL[s],s]),'all twelve sections, each to its own');}
 // A finished Article: never a state not yet known; the page opens on Check, once.
 {const {doc}=await page(base,'#/subject/demo-the-first-cup');
  const seen=[];await until(()=>{const r=doc.querySelector('.subj-row[data-step="facts"]');if(r)seen.push(r.dataset.state+'|'+doc.querySelector('[data-subj-panel]').hidden);return doc.querySelector('[data-subj-panel]:not([hidden]) h2');});
  assert.ok(seen.every(x=>!x.startsWith('flag')),'research is never shown as needing him before it is read');
  assert.equal(doc.querySelector('[data-subj-panel] h2').textContent,'Check');
  assert.equal(doc.querySelector('.subj-row[data-step="words"]').dataset.state,'done');}
 // An Article half written, with a suggestion waiting.
 const {w,doc,sources,calls}=await page(base,'#/subject/demo-shade-and-patience');
 await until(()=>doc.querySelector('[data-subj-panel]:not([hidden]) h2'));
 assert.equal(doc.querySelector('[data-subj-panel] h2').textContent,'The words','while a suggestion waits, the words are the step: '+JSON.stringify([...doc.querySelectorAll('.subj-row')].map(r=>r.dataset.step+':'+r.dataset.state+':'+r.querySelector('small').textContent)));
 assert.equal(doc.querySelector('.subj-head h1').textContent,'Shade and patience');
 const pill=doc.querySelector('button.subj-form[data-subj-form]');assert.match(pill.getAttribute('aria-label'),/^First: Article for the magazine, \d of \d steps done$/);assert.ok(pill.querySelector('.v2-ring'));
 const state=()=>Object.fromEntries([...doc.querySelectorAll('.subj-row')].map(r=>[r.dataset.step,r.dataset.state]));
 assert.deepEqual(Object.keys(state()),['have','facts','dish','words','photos','check','yes','publish']);
 assert.deepEqual([state().words,state().check,state().publish],['flag','wait','wait']);
 // Every hand-off on every step lands on the section its label says (and, for a piece, on that piece).
 const piece=pill.dataset.subjForm.slice(4),handoffs=new Set();
 for(const id of Object.keys(state())){
  doc.querySelector(`.subj-row[data-step="${id}"]>[data-subj-step]`).click();
  for(const a of doc.querySelectorAll('[data-subj-panel] [data-subj-handoff],.subj-head [data-subj-handoff]')){
   const key=a.dataset.subjHandoff,href=a.getAttribute('href');handoffs.add(key);
   assert.equal(sectionOf(href),S.HANDOFFS[key].section,key+': '+href);
   assert.equal(new URL(href,'http://x').searchParams.get('subject'),'demo-shade-and-patience');
   if(['write','read','checkRun','checkOpen','outputs','audience','media','arrange'].includes(key))assert.equal(new URL(href,'http://x').searchParams.get('piece'),piece,key+' keeps the piece');
  }
 }
 assert.ok(['write','read','checkRun','outputs','audience','addPhotos','board','dishChange','researchLook','desk','directionChange'].every(k=>handoffs.has(k)),[...handoffs].join());
 // Whatever he opens stays open while records arrive; a change re-asks only what it touches.
 doc.querySelector('.subj-row[data-step="yes"]>[data-subj-step]').click();
 await new Promise(r=>setTimeout(r,300));
 const desk=await (await fetch(base+'/api/consent/desk?parentStudyId=demo-shade-and-patience')).json();
 const r=await fetch(base+'/api/consent/people/record',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'agent:claude-code','X-AR-Client':'http',Origin:base},body:JSON.stringify({parentStudyId:'demo-shade-and-patience',expectedRevision:desk.revision,expectedHash:desk.hash,operationId:crypto.randomUUID(),person:{name:'Mrs. Invented',appears:['named','quoted']}})});
 assert.equal(r.status,200,await r.clone().text());
 const before=calls.length;
 const es=sources[0];es.emit('hello',{bootId:'b',cursor:1});es.emit('change',{cursor:2,bootId:'b',kind:'consent.people.record',scope:{kind:'project',id:'demo-shade-and-patience'}});
 await until(()=>doc.querySelector('.subj-row[data-step="yes"] b')?.textContent==='Mrs. Invented’s yes');
 assert.deepEqual(calls.slice(before).filter(p=>p.startsWith('/api/')&&p!=='/api/needs-you'),['/api/consent/desk'],'only the desk is asked again');
 assert.equal(doc.querySelector('[data-subj-panel] h2').textContent,'Mrs. Invented’s yes','the open step stays where he put it');
 // A change about another subject asks nothing.
 const mark=calls.length;es.emit('change',{cursor:3,bootId:'b',kind:'consent.people.record',scope:{kind:'project',id:'demo-the-first-cup'}});
 await new Promise(r=>setTimeout(r,500));assert.deepEqual(calls.slice(mark).filter(p=>p.startsWith('/api/')&&p!=='/api/needs-you'),[]);
 // Drafting her request is allowed here; recording that it was sent and her answer are his, at the desk.
 const area=doc.querySelector('[data-subj-draft]');area.value='An invented request.';area.dispatchEvent(new w.Event('input',{bubbles:true}));
 area.closest('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>doc.querySelector('.subj-row[data-step="yes"] small')?.firstChild?.textContent==='Request drafted, not sent');
 const desk2=await (await fetch(base+'/api/consent/desk?parentStudyId=demo-shade-and-patience')).json();
 assert.equal(desk2.people[0].request.text,'An invented request.');assert.equal(desk2.people[0].consent.state,'not-asked','asking is still his');
 // Add a form: what the app can make, nothing it cannot.
 doc.querySelector('[data-subj-add]').click();
 assert.deepEqual([...doc.querySelectorAll('.subj-kinds button')].map(b=>[b.querySelector('b').textContent,b.disabled]),[['Article',false],['Carousel',false],['Post',false],['Product listing',false]]);
});
