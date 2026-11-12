// Version two's subject page. First the pure half (how an answer of `subject.standing` is shown, the hand-off table
// pinned against the standing rule, which change concerns the subject, what Add a form can make), then the page itself
// on a real in-process server filled with invented subjects through the app's own commands: each subject shows exactly
// what the command says. Invented subjects, people and words only.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';
import {seedInstagramDemo} from '../scripts/demo-instagram.mjs';
import * as RULE from '../runtime/standing-rule.mjs';

const repo=path.resolve(import.meta.dirname,'..');
// The screen file, run as the browser runs it but with no shell: it hands back only its pure half.
const S=(()=>{const ctx={module:{exports:{}},URLSearchParams,Date,JSON,Object,Array,Set,Map,String,Number,Math,isNaN,console};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync(path.join(repo,'public/v2/screens/subject.js'),'utf8'),ctx);
 const own=v=>v===undefined?v:JSON.parse(JSON.stringify(v));return Object.fromEntries(Object.entries(ctx.module.exports).map(([k,v])=>[k,typeof v==='function'?(...a)=>own(v(...a)):own(v)]));})();
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');

// ---------- the pure half ----------
const step=(id,state,extra={})=>({id,group:'Create',name:id,state,note:'a note',section:'write',sections:['write'],...extra});

test('every hand-off names the section its label says, pinned',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(S.HANDOFFS).map(([k,v])=>[k,[v.label,v.section]])),{
  directionChange:['Change','direction'],directionWrite:['Write it','direction'],
  addMaterial:['Add it in Advanced','material'],readSources:['Read them in Advanced','source'],readTranscript:['Read the transcript in Advanced','source'],
  research:['Open Research in Advanced','research'],researchLook:['Look at them in Advanced','research'],
  board:['Open the Simmer board in Advanced','direction'],dishChange:['Change it in Advanced','direction'],dishWrite:['Write it in Advanced','direction'],
  write:['Write','write'],read:['Read it through','read'],
  media:['Choose photographs in Advanced','media'],arrange:['Place them in Advanced','arrange'],addPhotos:['Add photographs in Advanced','material'],
  checkRun:['Run the check in Advanced','check'],checkOpen:['Open the check in Advanced','check'],
  story:['Open the story in Advanced','arrange'],slides:['Open the slides in Advanced','arrange'],desk:['Open the desk in Advanced','share'],
  outputs:['Open Outputs in Advanced','outputs'],audience:['See it as readers will, in Advanced','audience'],
  postWrite:['Write in Advanced','write'],postRead:['Read in Advanced','read'],postCheck:['Check in Advanced','check'],
 });
 for(const {label,section} of Object.values(S.HANDOFFS)){
  const m=label.match(/^(Write|Read|Check) in Advanced$|^Open (Research|Outputs) in Advanced$/);if(m)assert.equal(section,(m[1]||m[2]).toLowerCase(),label);
 }
});

test('the hand-offs of each step agree with the sections the standing rule names for that step, and together reach all twelve',()=>{
 for(const [id,list] of Object.entries(RULE.SECTIONS)){
  const keys=S.STEP_OUT[id];assert.ok(keys,id+' has hand-offs');
  assert.equal(S.HANDOFFS[keys[0]].section,list[0],id+': the first hand-off lands on the step\'s own section');
  for(const k of keys)assert.ok(list.includes(S.HANDOFFS[k].section),id+' '+k+' stays within '+list.join());
  assert.deepEqual(S.ownHandoff({id,section:list[0]}).section,list[0]);
 }
 assert.deepEqual(S.TWELVE,[...RULE.TWELVE]);
 const reached=new Set(Object.values(S.STEP_OUT).flat().map(k=>S.HANDOFFS[k].section));
 for(const s of S.TWELVE)assert.ok(reached.has(s),s+' is reachable from some step');
 // A section the table has no label for still gets a plain one that lands where the command says.
 assert.deepEqual(S.ownHandoff({id:'x',section:'audience'}),{key:null,label:'Open Audience in Advanced',section:'audience'});
});

test('a step is shown as the command says: done carries no note, not known says so and is never chosen',()=>{
 assert.deepEqual([S.stepView(step('words','done')).note,S.stepView(step('words','todo')).note],['','a note']);
 const u=S.stepView(step('check','unknown',{note:'whatever'}));
 assert.deepEqual([u.state,u.note,u.openable,u.mark],['unknown','Not known',false,null]);
 assert.equal(S.stepView(step('check','next')).mark,'now');
 assert.equal(S.stepView(step('check','strange')).state,'unknown','a state nobody knows is not made up');
 const steps=[step('have','done'),step('words','unknown'),step('check','unknown'),step('publish','wait')];
 assert.equal(S.firstOpen(steps),'publish','only a step that is known can open');
 assert.equal(S.firstOpen([step('a','unknown')]),null);
 assert.equal(S.firstOpen([step('a','todo'),step('b','flag'),step('c','next')]),'b');
 assert.equal(S.firstOpen([step('a','todo'),step('b','flag')],{next:{step:'a'}}),'a','the command\'s own next step wins when it can be opened');
 assert.equal(S.firstOpen([step('a','unknown'),step('b','todo')],{next:{step:'a'}}),'b');
});

test('the form shown first holds the next step; pills say where each goes and tell alike names apart',()=>{
 const standing={next:{form:'ig:2'},forms:[{key:'out:1',name:'Article',to:'the magazine',title:'T',alike:false,done:1,total:8,ring:.125,steps:[]},{key:'ig:2',name:'Carousel',to:'Instagram',title:'Spring',alike:true,done:3,total:9,ring:.33,steps:[]}]};
 assert.equal(S.chooseForm(standing).key,'ig:2');assert.equal(S.chooseForm(standing,'out:1').key,'out:1');assert.equal(S.chooseForm({forms:[],steps:[1]}),null);
 assert.deepEqual(S.pillView(standing.forms[0],0),{key:'out:1',name:'Article',line:'the magazine',lead:'',tell:'',ring:.125,count:'1/8',say:'First: Article for the magazine, 1 of 8 steps done'});
 assert.equal(S.pillView(standing.forms[1],1).line,'Instagram · Spring');
 assert.equal(S.pillView({...standing.forms[1],name:'Post',alike:false},1).line,'Instagram','a Post shows where it goes');
 assert.deepEqual([S.pieceOf({key:'out:1',id:'1'}),S.pieceOf({key:'ig:2',id:'2'}),S.pieceOf({key:'draft:x',id:'x'})],['1',undefined,undefined]);
 assert.deepEqual(S.stepsOfForm({steps:['top']},null),['top']);
});

test('a change concerns this subject when it names it, its records, or nothing; not another subject, not presence',()=>{
 const standing={id:'s1',facts:{bindingId:'b1',projectId:'p1'},forms:[{id:'o1'}]};
 const c=(kind,id,k='project')=>S.concerns({kind,scope:id?{kind:k,id}:undefined},standing);
 assert.deepEqual([c('consent.people.record','s1'),c('study.outputs.create','o1','output'),c('study-draft.save','b1','binding'),c('first-flow.x','p1')],[true,true,true,true]);
 assert.equal(c('consent.people.record','other'),false);
 assert.equal(c('sources.import','source-9','source'),true,'a Library change might touch its material');
 assert.equal(c('words.decide'),true);assert.equal(c('presence.update'),false);assert.equal(c('leases.acquire','s1'),false);
 assert.equal(S.concerns({reset:true},standing),true);assert.equal(S.concerns(null,standing),false);
});

test('which tool reads a change touches',()=>{
 assert.deepEqual(S.touched('consent.people.record'),['desk']);
 assert.deepEqual(S.touched('study-draft.check.post'),['check']);
 assert.deepEqual(S.touched('study-draft.save'),['read','check']);
 assert.deepEqual(S.touched('instagram.plan.post'),['planRecords']);
 assert.deepEqual(S.touched('needs-you.raise'),[]);
 assert.ok(S.READS.includes('recordings')&&S.STEP_READS.have.includes('recordings'));
 for(const keys of Object.values(S.STEP_READS))for(const k of keys)assert.ok(S.READS.includes(k)||k==='topics');
});

test('Add a form offers only what the app can make, from the command\'s own facts, each saying what it needs and why not yet',()=>{
 const none=S.addable({bindingId:'b',material:{total:0,recordings:0,notes:0},words:{paragraphs:0}});
 assert.deepEqual(none.map(k=>[k.kind,k.ready,k.why]),[['post',true,''],['story',false,'Not built yet.'],['video',false,'Not built yet.'],['product-listing',true,''],['newsletter',false,'Not built yet.'],['shared-notes',false,'Not built yet.'],['article',false,'Write a few words first.'],['carousel',false,'Add a recording or a note first.']]);
 assert.ok(S.addable({bindingId:'b',material:{notes:1,recordings:0},words:{paragraphs:2}}).filter(k=>!k.unbuilt).every(k=>k.ready&&k.needs));
 assert.ok(S.addable({bindingId:null,material:{notes:1},words:{paragraphs:1}}).filter(k=>k.kind!=='carousel'&&!k.unbuilt).every(k=>!k.ready));
 assert.equal(S.addable({bindingId:'b'}).find(k=>k.kind==='article').why,'Not known yet.');
});

test('material is sorted from what the records hold: folder, research sources, plans',()=>{
 const tree={sources:[{id:'a',title:'A note',kind:'note'},{id:'b',title:'A recording',kind:'audio'},{id:'c',title:'Photo',kind:'image'}],roots:[{id:'library',tree:{rel_path:'',folders:[{rel_path:'Projects/p1',files:[{id:'a',name:'A note'}],folders:[]}],files:[]}}]};
 const m=S.materialFrom({tree,brief:{materials:[{sourceId:'b',title:'A recording',kind:'audio',hash:'h'}],sourceIds:[]},planRecords:[{material:{photos:[{sourceId:'c',caption:'Photo'}]}},{__error:{}}]},'p1');
 assert.deepEqual([m.total,m.recordings,m.notes,m.photos,m.items.map(x=>x.kind)],[3,1,1,1,['recordings','notes','photos']]);
 assert.deepEqual(S.materialFrom({tree:{__error:{}}}).total,0);
 assert.deepEqual(S.partsOf([{blockKind:'paragraph',words:'x'},{blockKind:'heading',words:'Part'},{blockKind:'paragraph',words:'y'},{blockKind:'paragraph',words:'z'}]),[{name:'Opening',paragraphs:1},{name:'Part',paragraphs:2}]);
});

test('a recording says where it is: saved, transcript being made, ready, or not set up on this machine',()=>{
 const job=state=>({id:'j1',sourceId:'a',state,transcriptReady:state==='done'});
 const v=(state,ready,registered)=>S.recordingView(job(state),{ready},registered);
 assert.deepEqual(v('saved',false),{say:'Saved. Transcription is not set up on this machine.',act:null});
 assert.deepEqual(v('saved',true),{say:'Saved. The transcript has not been started.',act:'start'},'where transcription is ready but not started, one button starts it');
 assert.deepEqual([v('queued',true).act,v('running',true).say],[null,'Making the transcript.']);
 assert.deepEqual(v('failed',true),{say:'The transcript could not be made. The recording is kept.',act:'retry'});
 assert.equal(v('failed',false).act,null,'no retry where transcription is not set up');
 assert.deepEqual(v('done',true,false),{say:'Transcript ready.',act:'use'});
 assert.deepEqual(v('done',true,true),{say:'Transcript ready, and kept as a source.',act:null});
 assert.equal(S.recordingView({id:'j',state:'done',transcriptReady:false},{ready:true}).act,null);
 assert.equal(S.recordingView(null,{ready:true}),null,'a recording with no job claims nothing');
 assert.equal(S.recordingView({id:'j',state:'whatever'},{ready:true}),null);
 assert.deepEqual([...S.registeredJobs({sources:[{id:'t',kind:'transcript',recordingId:'j1'},{id:'x',kind:'transcript',transcriptState:{jobId:'j2'}},{id:'a',kind:'audio'}]})].sort(),['j1','j2']);
 assert.deepEqual(S.registeredJobs({__error:{}}),[]);
 assert.deepEqual(S.touched('sources.import'),['tree','brief','recordings'],'a capture re-reads the recordings');
 assert.deepEqual(S.touched('transcription.id.action'),['recordings']);
 assert.deepEqual(S.touched('research-topics.start'),['topics'],'a question started from the sheet shows without a reload');
});

test('no em dash, only the six sizes, no hard-coded colour, every rule under the screen\'s own class, no own rules for step states, no every-subject read',()=>{
 for(const file of ['public/v2/screens/subject.js','public/v2/screens/subject.css']){const text=fs.readFileSync(path.join(repo,file),'utf8');assert.doesNotMatch(text,/—/,file);}
 const css=fs.readFileSync(path.join(repo,'public/v2/screens/subject.css'),'utf8');
 assert.deepEqual([...new Set([...css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)].map(m=>m[1]))],[],'sizes come from the six size tokens only');
 assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b/i,'no hard-coded colour');
 const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes subj-[\w-]+\{[^{}]*\{[^{}]*\}\}/g,'').split('}').map(r=>r.replace(/^(\s*@[^{]*\{)+/,'').trim()).filter(r=>r.includes('{'));
 for(const r of rules)assert.match(r,/^(?:html\[data-(?:brand|theme)(?:="dark")?\] )?(?:\.subj\b|\.subj-sheetdlg\b|dialog\.subj-sheetdlg\b)/,'every rule starts with the screen\'s own class: '+r.slice(0,60));
 const js=fs.readFileSync(path.join(repo,'public/v2/screens/subject.js'),'utf8');
 for(const banned of ['subject-places','study-draft.catalog','inquiries.projects','subjects.standing','stepsFor','factsFrom'])assert.ok(!js.includes("'"+banned),banned+' is not read or decided here');
assert.match(js,/named\?\.text/,'the dish he named is the board\'s text');
 assert.match(js,/gather=subject=>v2\.call\('subject\.standing'/);
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
async function page(base,hash,{patch=t=>t}={}){
 const html=fs.readFileSync(path.join(repo,'public/v2/index.html'),'utf8');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,sources=[],calls=[];windows.push(w);
 w.EventSource=class{constructor(u){this.url=u;this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.stub={};
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push(u.pathname);if(w.stub[u.pathname]){const v=w.stub[u.pathname];const r=typeof v==='function'?v(options):v;return {ok:r.status<400,status:r.status,text:async()=>JSON.stringify(r.body)};}const r=await fetch(base+u.pathname+u.search,{method:options.method||'GET',headers:{...options.headers,...(options.method&&options.method!=='GET'?{Origin:base}:{})},body:options.body});return {ok:r.ok,status:r.status,text:()=>r.text()};};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(patch(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(repo,'public/v2',src),'utf8'),src));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,doc:w.document,sources,calls};
}
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await new Promise(r=>setTimeout(r,25));}};
// An Article's Write, Read and Check open version two's own screens; every other hand-off opens a section of Advanced.
const sectionOf=href=>/^#\/(write|read|check)\//.test(href)?href.match(/^#\/(\w+)\//)[1]:new URL(href,'http://x').searchParams.get('section');


const get=async(base,p)=>(await fetch(base+p)).json();
const standingOf=(base,id)=>get(base,'/api/subject/standing?parentStudyId='+encodeURIComponent(id));
const rowsOf=doc=>[...doc.querySelectorAll('.subj-row')].map(r=>[r.dataset.step,r.dataset.state,r.querySelector('small')?.textContent||'']);
const mine=calls=>calls.filter(p=>p.startsWith('/api/')&&!['/api/needs-you','/api/subject-places','/api/study-draft/catalog','/api/capabilities','/api/events','/api/look'].includes(p));

test('six invented subjects at different stages each show exactly what subject.standing says',{timeout:300000},async t=>{
 const base=await server(t);
 await fillDemo(base,{only:['leaving-and-returning','a-single-line','shade-and-patience','the-first-cup','straw-over-the-rows']});
 await seedInstagramDemo(base);
 const ids=['demo-leaving-and-returning','demo-a-single-line','demo-shade-and-patience','demo-the-first-cup','demo-straw-over-the-rows'];
 const seen=[];
 for(const id of ids){
  const standing=await standingOf(base,id);
  const {doc,calls}=await page(base,'#/subject/'+id);
  await until(()=>doc.querySelector('.subj-row')&&doc.querySelector('[data-subj-panel]:not([hidden]) h2'));
  assert.equal(doc.querySelector('.subj-head h1').textContent,standing.title);
  assert.equal(doc.querySelector('.subj-where span').textContent,standing.stationName,'the station is the command\'s');
  assert.equal(doc.querySelector('.subj-where .v2-ring').style.getPropertyValue('--p'),Math.max(0,Math.min(1,standing.ring)).toFixed(2),'the ring is the command\'s');
  // The forms, in the command's order, each with its own n/m.
  assert.deepEqual([...doc.querySelectorAll('button.subj-form[data-subj-form]')].map(b=>[b.dataset.subjForm,b.querySelector('em').textContent]),standing.forms.map(f=>[f.key,f.done+'/'+f.total]));
  // The steps of the form shown, every one with the state the command gave (never a state of its own).
  const form=S.chooseForm(standing),steps=form?form.steps:standing.steps.filter(x=>['Gather','Research','Simmer'].includes(x.group)),all=form?form.steps:standing.steps;
  assert.deepEqual(rowsOf(doc).map(r=>[r[0],r[1]]),steps.map(s=>[s.id,s.state]),id);
  {const facts=rowsOf(doc).find(r=>r[0]==='facts');if(facts)assert.doesNotMatch(facts[2],/research topic/,id+': no topic count before the panel has read its topics');}
 for(const [row,s] of steps.map((s,i)=>[rowsOf(doc)[i],s]))assert.equal(row[2],s.state==='done'?'':s.state==='unknown'?'Not known':s.id==='facts'?s.note.replace(/( · )?\d+ research topics? on this material/,''):s.note,id+' '+s.id+' note (the topic count waits until the panel has read its topics)');
  // Opened on the step the command calls next, or the first that needs him; never a step not known.
  const open=doc.querySelector('.subj-row[data-open]')?.dataset.step;
  assert.equal(open,S.firstOpen(steps,form));
  assert.notEqual(steps.find(s=>s.id===open)?.state,'unknown');
  assert.equal(calls.filter(p=>p==='/api/subject/standing').length,1,'the standing is asked once');
  assert.ok(!calls.includes('/api/inquiries/projects'),'no read of every subject');
  seen.push([id,standing.forms.map(f=>f.name).join('+')||'no form',steps.find(s=>s.id===open).name]);
 }
 assert.deepEqual(seen.map(x=>x[1]),['no form','no form','Article','Article','Article+Carousel']);
 // Nothing yet: one first step, the dish waits, a form is not decided.
 {const {doc}=await page(base,'#/subject/demo-leaving-and-returning');await until(()=>doc.querySelector('.subj-row'));
  assert.match(doc.querySelector('.subj-form.none').textContent,/Not decided yet/);
  assert.deepEqual(rowsOf(doc).map(r=>[r[0],r[1]]),[['have','next'],['dish','wait']]);}
 // A suggestion waiting: the words need him, Check and Publish wait.
 {const {w,doc}=await page(base,'#/subject/demo-shade-and-patience');await until(()=>doc.querySelector('[data-subj-panel]:not([hidden]) h2'));
  const st=Object.fromEntries(rowsOf(doc).map(r=>[r[0],r[1]])),said=Object.fromEntries(S.stepsOfForm(await standingOf(base,'demo-shade-and-patience'),S.chooseForm(await standingOf(base,'demo-shade-and-patience'))).map(x=>[x.id,x.state]));
  assert.deepEqual([st.words,st.check],['flag','wait']);assert.equal(st.publish,said.publish,'Publish is whatever the command says');
  assert.equal(doc.querySelector('[data-subj-panel] h2').textContent,'The words');
  // A step that is not known is never opened by the page, but he can always open it, and it offers its ways into Advanced.
  const unknown=rowsOf(doc).filter(r=>r[1]==='unknown');assert.ok(unknown.length,'this subject has a step the command does not know');
  for(const [sid] of unknown){assert.notEqual(doc.querySelector('.subj-row[data-open]').dataset.step,sid,'not chosen to open');
   const btn=doc.querySelector(`.subj-row[data-step="${sid}"]>[data-subj-step]`);assert.ok(!btn.disabled&&btn.getAttribute('aria-disabled')!=='true','it can be opened');btn.click();
   assert.match(doc.querySelector('[data-subj-panel] .subj-note').textContent,/Not known/);
   const secs=[...doc.querySelectorAll('[data-subj-panel] [data-subj-handoff]')].map(a=>sectionOf(a.getAttribute('href')));
   assert.deepEqual(secs,S.STEP_OUT[sid].map(k=>S.HANDOFFS[k].section),sid+' offers all its hand-offs');
   if(sid==='publish')assert.ok(secs.includes('outputs')&&secs.includes('audience'));}
  // Pressing a step keeps focus on it, and the form and step are kept in the address.
  doc.querySelector('.subj-row[data-step="have"]>[data-subj-step]').focus();doc.querySelector('.subj-row[data-step="have"]>[data-subj-step]').click();
  await new Promise(r=>setTimeout(r,200));assert.equal(doc.activeElement?.dataset?.subjStep,'have','focus stays on the step');
  assert.match(decodeURIComponent(w.location.hash),/step=have/);assert.match(decodeURIComponent(w.location.hash),/form=out:/);}
});

test('the page: opens a step on demand, every hand-off lands on its section with the subject and piece, a Carousel step opens the slide studio, changes re-ask only what they touch',{timeout:300000},async t=>{
 const base=await server(t);
 await fillDemo(base,{only:['shade-and-patience','straw-over-the-rows']});
 const plan=(await seedInstagramDemo(base));
 const id='demo-straw-over-the-rows',standing=await standingOf(base,id);
 const {w,doc,sources,calls}=await page(base,'#/subject/'+id);
 await until(()=>doc.querySelector('[data-subj-panel]:not([hidden]) h2'));
 const pill=doc.querySelector('button.subj-form[data-subj-form^="out:"]'),carousel=doc.querySelector('button.subj-form[data-subj-form^="ig:"]');
 assert.match(pill.getAttribute('aria-label'),/^First: Article for the magazine, \d of \d steps done$/);
 const handoffs=new Set(),visit=()=>{
  for(const sid of rowsOf(doc).map(r=>r[0])){
   doc.querySelector(`.subj-row[data-step="${sid}"]>[data-subj-step]`).click();
   for(const a of doc.querySelectorAll('[data-subj-panel] [data-subj-handoff],.subj-head [data-subj-handoff]')){
    const key=a.dataset.subjHandoff,href=a.getAttribute('href'),q=new URL(href,'http://x').searchParams;
    if(key!=='own')handoffs.add(key);
    const screen=/^#\/(write|read|check)\//.exec(href)?.[1];
    if(screen){const allowed={write:['write','own'],read:['read','own'],check:['checkRun','checkOpen','own']}[screen];assert.ok(allowed.includes(key),key+' opens '+screen+' only from its own step');assert.equal(href,`#/${screen}/${id}?piece=${pill.dataset.subjForm.slice(4)}`,screen+' opens for this subject and piece');
     if(screen==='check'&&key!=='own'){assert.ok(!/in Advanced/.test(a.textContent),'a link to version two\'s Check does not say Advanced: '+a.textContent);assert.equal(a.textContent.trim(),'Open Check','the link only opens Check, so it says so (it does not run the check)');}continue;}
    assert.equal(q.get('section'),key==='own'?q.get('section'):S.HANDOFFS[key].section,key+': '+href);
    assert.equal(q.get('subject'),id);
    if(key!=='directionChange'&&key!=='directionWrite'&&key!=='addMaterial'&&doc.querySelector('.subj-form.on').dataset.subjForm.startsWith('out:'))assert.equal(q.get('piece'),pill.dataset.subjForm.slice(4),key+' keeps the piece');
   }
  }
 };
 visit();
 // The step's own hand-off is the section the command named for it.
 for(const s of standing.forms[0].steps){doc.querySelector(`.subj-row[data-step="${s.id}"]>[data-subj-step]`).click();
  const own=[...doc.querySelectorAll('[data-subj-panel] [data-subj-handoff]')].map(a=>sectionOf(a.getAttribute('href')));
  if(s.state!=='unknown'&&!['yes','photos','posttext','slides','story','form'].includes(s.id)||s.id==='yes'||s.id==='photos')assert.ok(own.includes(s.section),s.id+' hands off to '+s.section+' among '+own);}
 assert.ok(['write','checkRun','outputs','audience','addMaterial','board','research','desk','media'].every(k=>handoffs.has(k)),[...handoffs].join());
 await until(()=>doc.querySelector('.subj-head [data-subj-step="dish"]'));
 assert.equal(doc.querySelector('.subj-head .subj-look')?.getAttribute('href'),'#/looks?look=teajia','the look chip opens Looks');
 // The Carousel: its pill opens its own steps; the slide studio opens from the slides step.
 carousel.click();
 assert.equal(doc.querySelector('.subj-form.on').dataset.subjForm,carousel.dataset.subjForm);
 doc.querySelector('.subj-row[data-step="slides"]>[data-subj-step]').click();
 await until(()=>doc.querySelector('[data-subj-panel] .subj-strip li'));
 assert.equal(doc.querySelectorAll('[data-subj-panel] .subj-strip li').length,standing.forms[1].steps.find(s=>s.id==='slides').note.match(/\d+/)[0]*1);
 const studio=[...doc.querySelectorAll('[data-subj-panel] a')].find(a=>/Open the slide studio$/.test(a.textContent));
 assert.equal(studio.getAttribute('href'),'#/slides/'+standing.forms[1].id);
 doc.querySelector('.subj-row[data-step="posttext"]>[data-subj-step]').click();
 const post=[...doc.querySelectorAll('[data-subj-panel] [data-subj-handoff]')].map(a=>[a.textContent,sectionOf(a.getAttribute('href'))]);
 assert.deepEqual(post,[['Write in Advanced','write'],['Read in Advanced','read'],['Check in Advanced','check']],'a Carousel reaches Write, Read and Check from a real step');
 // The open step never moves by itself: a change arrives, the standing is asked again, the open step stays.
 doc.querySelector('.subj-row[data-step="yes"]>[data-subj-step]').click();
 await new Promise(r=>setTimeout(r,300));
 const before=calls.length,es=sources[0];
 es.emit('hello',{bootId:'b',cursor:1});
 es.emit('change',{cursor:2,bootId:'b',kind:'consent.people.record',scope:{kind:'project',id}});
 await until(()=>mine(calls.slice(before)).includes('/api/subject/standing'));
 await new Promise(r=>setTimeout(r,400));
 assert.deepEqual(mine(calls.slice(before)).sort(),['/api/consent/desk','/api/subject/standing'],'the standing and the desk only');
 assert.equal(doc.querySelector('[data-subj-panel] h2').textContent,'Your yes','the open step stays where he put it');
 const mark=calls.length;es.emit('change',{cursor:3,bootId:'b',kind:'consent.people.record',scope:{kind:'project',id:'demo-shade-and-patience'}});
 es.emit('change',{cursor:4,bootId:'b',kind:'presence.update'});
 await new Promise(r=>setTimeout(r,500));assert.deepEqual(mine(calls.slice(mark)),[],'another subject, and presence, ask nothing');
 // Add a form: what the app can make, nothing it cannot.
 doc.querySelector('[data-subj-add]').click();
 assert.deepEqual([...doc.querySelectorAll('.subj-kinds b')].map(b=>b.textContent),['Post','Story','Video','Product listing','Newsletter','Shared notes','Article','Carousel']);
 assert.ok(plan);
});

test('an unknown subject says so and offers Home; a missing step state is never guessed',{timeout:120000},async t=>{
 const base=await server(t);
 const {doc}=await page(base,'#/subject/not-a-subject');
 await until(()=>/could not be found/.test(doc.querySelector('.subj h1')?.textContent||''));
 assert.ok(doc.querySelector('.subj a[href="#/"]'));
});

test('the subject shows where a recording is, from the real recordings; its ways in open the Capture sheet when there is one and Material in Advanced when there is not',{timeout:300000},async t=>{
 const base=await server(t);
 await fillDemo(base,{only:['shade-and-patience']});
 const id='demo-shade-and-patience',facts=(await standingOf(base,id)).facts;
 // A real recording, brought in as the workspace does: into the subject's Library folder, then attached to it.
 const wav=Buffer.alloc(44+800,128);wav.write('RIFF',0);wav.writeUInt32LE(36+800,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(800,40);
 const post=async(p,body)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-AR-Actor':'human:adrian','X-AR-Client':'ui'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const folder='Projects/'+facts.projectId;
 assert.equal((await post('/api/sources/folders',{rootId:'library',folder})).status,200);
 const imp=await post('/api/sources/import',{rootId:'library',folder,files:[{name:'Microphone-2026-11-11 09.30.wav',base64:wav.toString('base64')}]});
 assert.equal(imp.status,200,JSON.stringify(imp.body));
 const sourceId=imp.body.receipts[0].source.id;
 assert.equal((await post('/api/study/material/attach',{bindingId:facts.bindingId,parentStudyId:id,sourceIds:[sourceId],operationId:'11111111-1111-4111-8111-111111111111'})).status,200);
 const rows=doc=>[...doc.querySelectorAll('.subj-have li')].map(l=>[l.querySelector('b').textContent,l.querySelector('small').textContent,l.querySelector('[data-subj-where]')?.textContent||'',l.querySelector('[data-subj-rec]')?.textContent||'']);

 // 1. The real demo server: transcription is not set up here, so the recording says it is saved only.
 {
  // The shell now has a Capture sheet of its own; this part takes it out to see the page without one.
  const {w,doc,calls}=await page(base,'#/subject/'+id+'?step=have',{patch:(text,src)=>/shell\/shell\.js$/.test(src)?text.replace('capture:options=>openCapture(options),',''):text});
  await until(()=>doc.querySelector('.subj-have [data-subj-where]'));
  assert.deepEqual(rows(doc).filter(r=>r[1]==='Recording'),[['Microphone-2026-11-11 09.30','Recording','Saved. Transcription is not set up on this machine.','']]);
  assert.ok(calls.includes('/api/recordings'));
  // With no Capture sheet the ways in keep today's behaviour: they open Material in Advanced.
  const ways=[...doc.querySelectorAll('[data-subj-capture]')];assert.ok(ways.length>=1);
  for(const a of ways){assert.equal(new URL(a.getAttribute('href'),'http://x').searchParams.get('section'),'material');assert.equal(a.getAttribute('title'),'Opens Material in Advanced','with no sheet the tooltip says where it goes');}
  assert.equal(typeof w.v2.capture,'undefined');
  let held=null;doc.addEventListener('click',e=>{held=e.defaultPrevented;e.preventDefault();},{once:true});
  ways[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  assert.equal(held,false,'nothing is held back from the link when there is no sheet');
 }
 // 2. A stand-in for Capture (its real one is built elsewhere): the ways in open it for this subject and keep the page.
 {
  const {w,doc}=await page(base,'#/subject/'+id+'?step=have',{patch:(text,src)=>/shell\/shell\.js$/.test(src)?text.replace('ui:Object.freeze({','capture:o=>{window.__cap=o;},ui:Object.freeze({'):text});
  await until(()=>doc.querySelector('.subj-have [data-subj-where]'));
  const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});doc.querySelector('.subj-drop[data-subj-capture]').dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);
  for(const a of doc.querySelectorAll('[data-subj-capture]'))assert.equal(a.getAttribute('title'),'Opens the Capture sheet','with the sheet the tooltip says so');
  assert.equal(w.__cap.subject.id,id);assert.equal(w.__cap.subject.name,'Shade and patience');assert.equal(w.__cap.subject.projectId,facts.projectId);
 }
 // 3. Stand-ins for the states the demo cannot make (it has no transcription tools). Only the answers are invented.
 {
  const {w,doc,calls,sources}=await page(base,'#/subject/'+id+'?step=have');
  await until(()=>doc.querySelector('.subj-have [data-subj-where]'));
  const job=(await (await fetch(base+'/api/recordings')).json()).jobs[0];
  let n=0;
  const show=async(state,ready,extra={})=>{
   w.stub['/api/recordings']={status:200,body:{capability:{ready},jobs:[{...job,state,transcriptReady:state==='done',...extra}]}};
   const es=sources[0];es.emit('hello',{bootId:'b',cursor:1});es.emit('change',{cursor:++n+1,bootId:'b',kind:'transcription.id.action',scope:{kind:'project',id}});
   await new Promise(r=>setTimeout(r,600));
   return rows(doc).find(r=>r[1]==='Recording');
  };
  assert.deepEqual(await show('saved',true),['Microphone-2026-11-11 09.30','Recording','Saved. The transcript has not been started.','Make the transcript']);
  // The one button starts it, through the command, and the answer is read again.
  w.stub['/transcription/'+job.id+'/start']={status:200,body:{job:{id:job.id,state:'running'}}};
  const before=calls.length;doc.querySelector('[data-subj-rec="start"]').click();
  await until(()=>calls.slice(before).includes('/transcription/'+job.id+'/start'));
  assert.deepEqual((await show('running',true)).slice(2),['Making the transcript.','']);
  assert.deepEqual((await show('failed',true)).slice(2),['The transcript could not be made. The recording is kept.','Try the transcript again']);
  assert.deepEqual((await show('done',true)).slice(2),['Transcript ready.','Use the transcript']);
  // A ready transcript that is not yet a source: one button, and Open in Advanced stays beside it as a quiet link.
  const useBtn=doc.querySelector('[data-subj-rec="use"]');assert.ok(useBtn,'a ready transcript has its one button');
  assert.equal(useBtn.textContent.trim(),'Use the transcript');
  const quiet=doc.querySelector('.subj-have [data-subj-handoff="readTranscript"]');assert.ok(quiet,'checking its words still lives in Advanced');
  assert.equal(quiet.textContent.trim(),'Open in Advanced');assert.equal(new URL(quiet.getAttribute('href'),'http://x').searchParams.get('section'),'source');
  assert.ok(!quiet.classList.contains('subj-btn'),'the link is the quiet one');
  // An assistant (or anyone) refused by recordings.source sees the plain message and the button stays.
  w.stub['/api/transcript-check/'+job.id]={status:200,body:{expected:{jobId:job.id,markdownHash:'h1'}}};
  w.stub['/api/recordings/source']={status:403,body:{error:'Using a recording transcript as Source requires the author.'}};
  doc.querySelector('[data-subj-rec="use"]').click();
  await until(()=>/requires the author/.test(doc.getElementById('v2-messages')?.textContent||''));
  assert.ok(doc.querySelector('[data-subj-rec="use"]'),'nothing changed, the button stays');
  // Adrian presses it: the proof is read once (a read that holds nothing afterwards), then sent with the job; the new source shows without a reload.
  let sent=null;const tree=await (await fetch(base+'/api/sources/tree')).json();
  w.stub['/api/recordings/source']=o=>{sent=JSON.parse(o.body);return {status:200,body:{source:{id:'11111111-aaaa-4aaa-8aaa-111111111111'},jobId:job.id}};};
  w.stub['/api/sources/tree']=()=>({status:200,body:{...tree,sources:[...(tree.sources||[]),...(sent?[{id:'11111111-aaaa-4aaa-8aaa-111111111111',kind:'transcript',recordingId:job.id,title:'Transcript of the shade talk',hash:'h1',rel_path:'x/transcript.md'}]:[])]}});
  const before2=calls.length;doc.querySelector('[data-subj-rec="use"]').click();
  await until(()=>[...doc.querySelectorAll('.subj-have li')].some(l=>/Transcript of the shade talk/.test(l.textContent)));
  assert.deepEqual([sent.jobId,sent.expected],[job.id,{jobId:job.id,markdownHash:'h1'}]);assert.match(sent.operationId,/^[0-9a-f-]{36}$/);
  assert.equal(calls.slice(before2).indexOf('/api/transcript-check/'+job.id)<calls.slice(before2).indexOf('/api/recordings/source'),true,'read first, then use');
  assert.equal(doc.querySelector('[data-subj-rec="use"]'),null,'once it is a source the button is gone');
  delete w.stub['/api/sources/tree'];
  assert.deepEqual((await show('saved',false)).slice(2),['Saved. Transcription is not set up on this machine.','']);
  // A refusal reaches him in plain words and nothing is lost.
  await show('saved',true);
  await until(()=>doc.querySelector('[data-subj-rec="start"]'));
  w.stub['/transcription/'+job.id+'/start']={status:503,body:{error:'An isolated transcription interpreter is not configured.'}};
  doc.querySelector('[data-subj-rec="start"]').click();
  await until(()=>/interpreter is not configured/.test(doc.getElementById('v2-messages')?.textContent||''));
  assert.ok(doc.querySelector('[data-subj-rec="start"]'),'the recording and its button stay');
 }
 // 4. A question started from the sheet is a research topic linked to the subject, and the Facts step lists it.
 {
  const r=await fetch(base+'/api/research-topics/start',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-AR-Actor':'human:adrian','X-AR-Client':'ui'},body:JSON.stringify({operationId:'22222222-2222-4222-8222-222222222222',name:'Why does shade slow the leaf?',subjects:[id]})});
  assert.equal(r.status,200);const topic=await r.json();
  const {doc}=await page(base,'#/subject/'+id+'?step=facts');
  const link=await until(()=>[...doc.querySelectorAll('[data-subj-panel] a.subj-link')].find(a=>a.getAttribute('href')==='#/research/topic/'+topic.id),60000);
  // 3. He started it himself (kept): never "Suggested". 4. A question is shown as his own words, unchanged.
  assert.equal(link.textContent,'Why does shade slow the leaf?');
  // 5. The summary counts what the panel lists.
  const listed=doc.querySelectorAll('[data-subj-panel] a.subj-link[href^="#/research/topic/"]').length;
  assert.ok(listed>=1);
  const note=doc.querySelector('.subj-row[data-step="facts"] small')?.textContent||'';
  if(/research topic/.test(note))assert.match(note,new RegExp('(^|\\D)'+listed+' research topics?\\b'));
 }
});

test('topic wording: a question stays his own words, others keep the prefix; kept is never Suggested; the summary count is the listed count',()=>{
 assert.equal(S.topicLine({name:'Why does shade slow the leaf?',status:'kept'}),'Why does shade slow the leaf?');
 assert.equal(S.topicLine({name:'Why does shade slow the leaf?',status:'proposed'}),'Suggested: Why does shade slow the leaf?');
 assert.equal(S.topicLine({name:'Shade and tea',status:'kept'}),'Learn more about shade and tea');
 assert.equal(S.topicLine({name:'Shade and tea',status:'proposed'}),'Suggested: shade and tea');
 assert.deepEqual(S.topicStatus({id:'a',name:'x',status:'proposed'}),'proposed');
 assert.deepEqual(S.topicStatus({id:'a',name:'x',status:'kept',proposedBy:'agent:claude-code'}),'accepted','an assistant started it and Adrian kept it');
 assert.equal(S.topicNote('3 of 5 things looked at · 1 research topic on this material',{list:[1,2,3,4]}),'3 of 5 things looked at · 4 research topics on this material');
 assert.equal(S.topicNote('1 research topic on this material',{list:[{}]}),'1 research topic on this material');
 assert.equal(S.topicNote('2 sources · 1 research topic on this material',{list:[]}),'2 sources');
 assert.equal(S.topicNote('1 research topic on this material',undefined),'','the panel has not read its topics: no count from the first paint');
 assert.equal(S.topicNote('2 sources not looked at yet · 1 research topic on this material',undefined),'2 sources not looked at yet');
 assert.equal(S.topicNote('1 research topic on this material',{error:true,list:[]}),'','topics that could not be read: no count');
});

// ---------- the small fixes of 11 November: the header sentence, and a Carousel that is not yet laid out ----------
const CONCEPT=(adopted,thoughts='')=>'# Concept\n\n## Author thoughts \u2014 supplied verbatim\n\n'+thoughts+(adopted?'\n\n## Adopted human direction \u2014 explicit\n\n'+adopted:'')+'\n\n## AI interpretation \u2014 provisional\n\nA provisional reading.\n\n## Suggestions \u2014 unadopted\n\nTry another angle.\n\n## Selected Library passages \u2014 references, not approval\n\n';

test('the sentence beside a subject\'s name is only his: the dish he named, else the words he adopted, whatever shape the record has',()=>{
 // The whole concept record: only the adopted words come out, never the headings or the provisional parts.
 assert.equal(S.adoptedWords(CONCEPT('One line, drawn slowly.','My own thoughts.')),'One line, drawn slowly.');
 assert.equal(S.adoptedWords(CONCEPT('One line.\n\nAnd then another, kept.')),'One line. And then another, kept.','whitespace is laid flat for the line, nothing is cut');
 // No adopted words yet: nothing, and never his thoughts or an assistant's reading.
 assert.equal(S.adoptedWords(CONCEPT('','Only my thoughts.')),'');
 assert.equal(S.adoptedWords(CONCEPT('')),'');
 // An empty record and a missing one.
 for(const none of ['',null,undefined,'   \n '])assert.equal(S.adoptedWords(none),'');
 // An old or hand-written record that is one plain paragraph is his sentence as it stands.
 assert.equal(S.adoptedWords('A short piece about tea.\nCalm and exact.'),'A short piece about tea. Calm and exact.');
 // Markers the app keeps in a record are not words.
 assert.equal(S.adoptedWords('<!-- ar-create:direction-choices:v1 {"a":1} -->\nA plain direction.'),'A plain direction.');
 assert.equal(S.adoptedWords(CONCEPT('Kept.')+'\n\n<!-- ar-create:direction-plan:v1 -->\n## Planning intent\n```json\n{"title":"x"}\n```\n<!-- /ar-create:direction-plan:v1 -->'),'Kept.');
 // The real blocks the app appends (choices, planning intent) are data, wrapped in markers: none of it is words.
 const BLOCK='\n\n<!-- ar-create:direction-choices:v1 -->\n```json\n{"schema":1,"events":[]}\n```\n<!-- /ar-create:direction-choices:v1 -->';
 assert.equal(S.adoptedWords('Tea at dawn, slowly.'+BLOCK),'Tea at dawn, slowly.');
 assert.equal(S.adoptedWords(CONCEPT('Kept.')+BLOCK),'Kept.');
 assert.equal(S.adoptedWords('Tea.\n\n<!-- ar-create:direction-plan:v1 -->\n## Planning intent\n```json\n{"title":"x"}\n```\n<!-- /ar-create:direction-plan:v1 -->'),'Tea.');
 // His own headings are his words, in a plain paragraph and inside the adopted section.
 assert.equal(S.adoptedWords('Tea, #1 of the morning {slowly}, kept whole.'),'Tea, #1 of the morning {slowly}, kept whole.','a # or braces inside his sentence stay');
 assert.equal(S.adoptedWords(CONCEPT('Slowly, #1 {kept}.')),'Slowly, #1 {kept}.');
 // A heading of any kind ends the adopted section, and a plain record that holds headings is not a shape we read.
 assert.equal(S.adoptedWords(CONCEPT('Slowly.\n\n# My line\n\nNot part of it.')),'Slowly.');
 assert.equal(S.adoptedWords('Suggestions about tea\n\n## Notes, mine\n\nShade first.'),'');
 // Edit starts from his paragraphs as they were.
 assert.equal(S.adoptedRaw(CONCEPT('One.\n\nTwo.')),'One.\n\nTwo.');
 // A hand-written record with the headings in another order still gives only the adopted section.
 assert.equal(S.adoptedWords('# Concept\n\n## Author thoughts \u2014 supplied verbatim\n\nNot this.\n\n## Adopted human direction \u2014 explicit\n\nFirst.\n\n## AI interpretation \u2014 provisional\n\nNor this.'),'First.');
 // The dish he named wins; it is his exact sentence.
 assert.equal(S.sentenceOf({forming:{named:{text:'  The dish, as said.  '}}},{body:CONCEPT('Other words.')}),'The dish, as said.');
 assert.equal(S.sentenceOf({forming:{named:'A string dish.'}},{body:''}),'A string dish.');
 assert.equal(S.sentenceOf({forming:{named:null}},{body:CONCEPT('From the direction.')}),'From the direction.');
 assert.equal(S.sentenceOf(null,{body:CONCEPT('')}),'');
 assert.equal(S.sentenceOf(null,null),'');
 // The line never says a heading word of the record.
 assert.doesNotMatch(S.sentenceOf(null,{body:CONCEPT('Words.','Thought.')}),/Concept|Author thoughts|AI interpretation|Suggestions/);
});

test('a subject whose dish is named shows his sentence in the header, never the stored record; a new Carousel says what each waiting step waits for and offers Advanced',{timeout:300000},async t=>{
 const base=await server(t);
 await fillDemo(base,{only:['a-single-line','the-first-cup']});
 const id='demo-a-single-line',actor={'Content-Type':'application/json','X-AR-Actor':'agent:claude-code','X-AR-Client':'http'},uuid=()=>crypto.randomUUID();
 const post=async(p,b)=>{const r=await fetch(base+p,{method:'POST',headers:actor,body:JSON.stringify({operationId:uuid(),...b})});const v=await r.json();assert.ok(r.ok,p+' '+JSON.stringify(v));return v;};
 const board=await get(base,'/api/simmer/board?subject='+id);
 await post('/api/simmer/dish',{subject:id,sentence:'One line, drawn slowly, and what it asks of the hand.',said:'typed',expectedRevision:board.revision,expectedHash:board.hash});
 const stored=(await get(base,'/api/study/human-direction?parentStudyId='+id)).body;
 assert.match(stored,/^# Concept/,'the stored record is the whole concept record');
 const plan=await post('/api/instagram/plan',{subject:id,title:'A single line',material:{transcripts:[],photos:[]}});
 {const {doc}=await page(base,'#/subject/'+id);
  await until(()=>doc.querySelector('.subj-dir span')&&doc.querySelector('.subj-row'));
  assert.equal(doc.querySelector('.subj-dir span').textContent,'One line, drawn slowly, and what it asks of the hand.');
  assert.doesNotMatch(doc.querySelector('.subj-head').textContent,/# Concept|Author thoughts|Adopted human direction/);
  // The record itself is untouched by showing it.
  assert.equal((await get(base,'/api/study/human-direction?parentStudyId='+id)).body,stored);
  // The step he is asked to open shows the same words in the dish step, and Edit starts from them.
  doc.querySelector('.subj-row[data-step="dish"]>[data-subj-step]').click();
  await until(()=>doc.querySelector('.subj-quote.big'));
  assert.equal(doc.querySelector('.subj-quote.big').textContent,'One line, drawn slowly, and what it asks of the hand.');
  doc.querySelector('[data-subj-dishedit]').click();
  assert.equal(doc.querySelector('[data-subj-dishtext]').value,'One line, drawn slowly, and what it asks of the hand.');}
 // The Carousel: nothing waits without saying what for, and no step opens the bare studio.
 {const {doc}=await page(base,'#/subject/'+id+'?form=ig:'+plan.id+'&step=story');
  await until(()=>doc.querySelector('[data-subj-panel] [data-subj-waiting]'));
  const panel=doc.querySelector('[data-subj-panel]');
  assert.match(panel.querySelector('[data-subj-waiting]').textContent,/^An assistant proposes the stories from your words and photographs\. You choose one\.$/);
  assert.equal(sectionOf(panel.querySelector('a[data-subj-handoff="story"]').getAttribute('href')),'arrange','the way forward that exists');
  assert.equal(panel.querySelector('a[href*="slides/"]'),null,'no slide studio before there are slides');
  doc.querySelector('.subj-row[data-step="slides"]>[data-subj-step]').click();
  await until(()=>doc.querySelector('[data-subj-panel] [data-subj-waiting]')?.textContent.startsWith('The slides wait'));
  assert.ok(doc.querySelector('[data-subj-panel] [data-subj-step="story"]'),'it still offers Go to the story');
  assert.equal(sectionOf(doc.querySelector('[data-subj-panel] a[data-subj-handoff="slides"]').getAttribute('href')),'arrange');
  assert.equal(doc.querySelector('[data-subj-panel] a[href*="slides/"]'),null);
  doc.querySelector('.subj-row[data-step="posttext"]>[data-subj-step]').click();
  await until(()=>doc.querySelector('[data-subj-panel] h2')?.textContent==='The post text');
  assert.equal(doc.querySelector('[data-subj-panel] a[href*="slides/"]'),null,'the post text step does not open the studio either');
  assert.ok(doc.querySelector('[data-subj-panel] [data-subj-step="slides"]'),'it says what it waits for with a way there');}
});

test('a stored direction that is only the app\'s direction-choices block, however it is written, gives no header sentence and no raw text',()=>{
 const JSON_BLOCK='{"schema":1,"events":[{"action":"select","angle":"Slow tea"}]}';
 const shapes=[
  '<!-- ar-create:direction-choices:v1 -->\n```json\n'+JSON_BLOCK+'\n```\n<!-- /ar-create:direction-choices:v1 -->',
  '<!-- ar-create:direction-choices:v1 -->\n'+JSON_BLOCK,
  '<!-- ar-create:direction-choices:v1 -->\n```json\n'+JSON_BLOCK+'\n```\n',
  '\n\n<!-- ar-create:direction-choices:v1 -->'+JSON_BLOCK+'\n<!-- /ar-create:direction-choices:v1 -->\n',
 ];
 for(const body of shapes){
  assert.equal(S.adoptedWords(body),'',body);
  assert.equal(S.sentenceOf(null,{body}),'');
  assert.equal(S.sentenceOf({forming:{named:{text:'The dish he named.'}}},{body}),'The dish he named.','his named dish still wins');
 }
 // His own sentence next to the block is kept, and only it.
 const mixed='Tea at dawn.\n\n'+shapes[0];
 assert.equal(S.sentenceOf(null,{body:mixed}),'Tea at dawn.');
 assert.doesNotMatch(S.sentenceOf(null,{body:mixed}),/<!--|\{|json/);
});

test('a stored concept record with headings and thoughts but no adopted words gives no header sentence and no heading marks',()=>{
 const full='# Concept\n\n## Author thoughts — supplied verbatim\n\nI keep thinking about the steam.\n\n## AI interpretation — provisional\n\nA reading.\n\n## Suggestions — unadopted\n\nAn idea.\n\n## Selected Library passages — references, not approval\n\n';
 const bare='# Concept\n\n## Author thoughts\n\nI keep thinking about the steam.\n\n## AI interpretation\n\nA reading.\n';
 const choices='\n\n<!-- ar-create:direction-choices:v1 -->\n```json\n{"schema":1,"events":[]}\n```\n<!-- /ar-create:direction-choices:v1 -->';
 for(const body of [full,bare,full+choices,'# Concept\n\n## Author thoughts - supplied verbatim\n\nSteam.\n']){
  const line=S.sentenceOf(null,{body});
  assert.equal(line,'',JSON.stringify(body));
  assert.doesNotMatch(line,/^#|<!--|\{/);
 }
 // With his adopted words the line is those words alone, in either heading style.
 assert.equal(S.sentenceOf(null,{body:'# Concept\n\n## Author thoughts\n\nSteam.\n\n## Adopted human direction\n\nSlow tea, said plainly.\n\n## AI interpretation\n\nA reading.'}),'Slow tea, said plainly.');
 assert.equal(S.sentenceOf(null,{body:full.replace('## AI interpretation','## Adopted human direction — explicit\n\nSlow tea.\n\n## AI interpretation')+choices}),'Slow tea.');
});

test('every header reads his sentence through the one reader and shows no stored record text',{timeout:300000},async t=>{
 const base=await server(t);
 await fillDemo(base,{only:['a-single-line']});
 const id='demo-a-single-line';
 // Stand in for the two stored shapes: the screen reads the direction record through the same command it always used.
 const src=fs.readFileSync(path.join(repo,'public/v2/screens/subject.js'),'utf8');
 assert.match(src,/sentenceOf\(ok\(st\.rec\.board\)\?st\.rec\.board:null,d\)/,'the header goes through the one sentence reader');
 assert.doesNotMatch(src,/String\(d\.body\|\|''\)/,'no place shows a stored body as it is');
 const {doc}=await page(base,'#/subject/'+id);
 await until(()=>doc.querySelector('.subj-head'));
 assert.doesNotMatch(doc.querySelector('.subj-head').textContent,/<!--|"schema"|^#|# Concept|Author thoughts/);
});

// ---------- real records on the subject page (First look, 12 November) ----------
const car=(key,over={})=>({key,kind:'slides',name:'Carousel',to:'Instagram',title:'',alike:true,done:1,total:5,ring:.2,id:key.slice(4),slides:5,words:41,createdAt:'2026-10-03T12:00:00Z',updatedAt:null,steps:[],...over});

test('two forms of one name are told apart by real fields only: the slide count and the date made, never an invented name',()=>{
 const forms=[car('out:c1'),car('out:c2',{slides:7,createdAt:'2026-10-09T12:00:00Z'}),{...car('out:a1'),kind:'article',name:'Article',to:'the magazine',alike:false,slides:0}];
 const d=S.tellApart(forms);
 assert.equal(d.length,3);
 assert.equal(d[0],'5 slides · made 3 Oct');assert.equal(d[1],'7 slides · made 9 Oct');assert.equal(d[2],'','a form with a name of its own needs nothing added');
 assert.equal(S.pillView(forms[0],0,d[0]).line,'Instagram · 5 slides · made 3 Oct');
 assert.deepEqual([S.pillView(forms[0],0,d[0]).lead,S.pillView(forms[0],0,d[0]).tell],['Instagram · ','5 slides · made 3 Oct'],'a phone drops where it goes and keeps what tells them apart');
 assert.match(S.pillView(forms[1],1,d[1]).say,/Carousel for Instagram, 7 slides · made 9 Oct, /);
 // The piece's own title, when it has one, comes first.
 assert.equal(S.tellApart([car('out:c1',{title:'Spring'}),car('out:c2')])[0],'Spring · 5 slides · made 3 Oct');
 // A title they all share tells nothing apart, so it is left out.
 assert.equal(S.tellApart([car('out:c1',{title:'Spring'}),car('out:c2',{title:'Spring',slides:7})])[1],'7 slides · made 3 Oct');
 // Two Instagram plans with one title: the frame count and the day each was last changed (a plan keeps no date made).
 const plans=[car('ig:p1',{kind:'instagram',createdAt:null,updatedAt:'2026-11-02T12:00:00Z',slides:3,title:'Same'}),car('ig:p2',{kind:'instagram',createdAt:null,updatedAt:'2026-11-04T12:00:00Z',slides:5,title:'Same'})];
 assert.deepEqual(S.tellApart(plans),['3 slides · changed 2 Nov','5 slides · changed 4 Nov']);
 // No record of a slide count or a date: nothing is invented, and the old line is unchanged.
 const bare=[car('out:c1',{slides:0,createdAt:null}),car('out:c2',{slides:0,createdAt:null,title:'Autumn'})];
 assert.deepEqual(S.tellApart(bare),['','Autumn']);
 assert.equal(S.pillView(bare[0],0,'').line,'Instagram');
 // Same slides, same day: the time made tells them apart.
 const same=S.tellApart([car('out:c1',{createdAt:'2026-10-03T08:15:00Z'}),car('out:c2',{createdAt:'2026-10-03T16:40:00Z'})]);
 assert.notEqual(same[0],same[1]);assert.match(same[0],/^5 slides · made 3 Oct, \d\d:\d\d$/);
 // The same minute: the second.
 const close=S.tellApart([car('out:c1',{createdAt:'2026-10-03T08:15:10Z'}),car('out:c2',{createdAt:'2026-10-03T08:15:40Z'})]);
 assert.notEqual(close[0],close[1]);assert.match(close[0],/, \d\d:\d\d:\d\d$/);
});

test('an Outputs carousel opens in version two\'s studio, read only; a plan keeps the studio it had',()=>{
 assert.equal(S.outputStudio({key:'out:c1',id:'c1',kind:'slides'}),'c1');
 assert.equal(S.outputStudio({key:'out:a1',id:'a1',kind:'article'}),null);
 assert.equal(S.outputStudio({key:'ig:p1',id:'p1',kind:'instagram'}),null);
 assert.equal(S.outputStudio(null),null);
});

test('the Facts step says findings only when they are there; a result with none says what is there',()=>{
 const rule=(over={})=>({id:'facts',name:'The facts',group:'Research',state:'flag',note:'Research came back',why:'research-result',...over});
 const full={step:'directions',research:{question:'Why?',body:'Some findings.'}};
 assert.equal(S.findingsOf(full),1);
 assert.equal(S.findingsOf({research:{question:'Why?',body:'  '},directions:[]}),0);
 assert.equal(S.findingsOf({research:{body:'x',brief:'y'},directions:[{},{}]}),4);
 assert.equal(S.findingsOf(null),null);assert.equal(S.findingsOf({__error:true}),null);assert.equal(S.findingsOf(undefined),null);
 // Before the brief is read, the rule's own words stand (they do not claim findings).
 assert.equal(S.factsView(rule(),undefined).note,'Research came back');
 const some=S.factsView(rule(),full);assert.deepEqual([some.state,some.note],['flag','Findings to read']);
 const none=S.factsView(rule(),{step:'directions',research:{question:'Why?'}});
 assert.deepEqual([none.state,none.note],['wait','The question is asked, waiting for findings']);
 assert.ok(!JSON.stringify(none).includes('Findings to read'));
 // Another state of the step is left alone.
 const other={id:'facts',state:'todo',note:'Ready to look into'};assert.deepEqual(S.factsView(other,full),other);
});

test('an assistant is not offered what only Adrian can do; a refusal says what happened',()=>{
 assert.equal(S.transcriptAct('use',true),'use');assert.equal(S.transcriptAct('use',false),'owner');
 assert.equal(S.transcriptAct('start',false),'start','making a transcript is the assistants\' to do as well');assert.equal(S.transcriptAct(null,false),null);
 const stale=Object.assign(new Error('This changed since it was opened here. Read it again before saving.'),{status:409,command:'recordings.source',body:{error:'Recording transcript or audio changed. Open its current Source before using it.'}});
 assert.equal(S.sourceRefusal(stale),'Recording transcript or audio changed. Open its current Source before using it.');
 assert.match(S.sourceRefusal(Object.assign(new Error('x'),{status:409,command:'recordings.source',body:{}})),/transcript or the recording changed/);
 assert.equal(S.sourceRefusal(Object.assign(new Error('Only Adrian can decide this.'),{status:403})),'Only Adrian can decide this.');
 assert.equal(S.sourceRefusal(new Error('')),'That could not be done. Nothing was changed.');
});

test('private or machine text never reaches the header, whatever suffix a heading has or however a marker is broken',()=>{
 const J='{"schema":1,"events":[{"action":"select"}]}';
 const ADOPT='## Adopted human direction \u2014 explicit\n\nHis line, kept.';
 // A heading whose suffix is not a dash is still the concept record: his private thoughts stay out.
 assert.equal(S.adoptedWords('# Concept: tea\n\n## Author thoughts (verbatim)\n\nPrivate thought.\n\n'+ADOPT),'His line, kept.');
 assert.equal(S.adoptedWords('# Concept: tea\n\n## Author thoughts (verbatim)\n\nPrivate thought.'),'');
 assert.equal(S.adoptedWords('## Author thoughts (verbatim)\n\nPrivate thought.'),'');
 assert.equal(S.adoptedWords('# Concept\n\n## Adopted human direction: mine\n\nHis line.\n\n## AI interpretation (provisional)\n\nNot his.'),'His line.');
 // An unknown section after his words is not his words.
 assert.equal(S.adoptedWords('# Concept\n\n'+ADOPT+'\n\n## Something new\n\nAn assistant\'s text.'),'His line, kept.');
 assert.equal(S.adoptedWords('# Concept\n\n'+ADOPT+'\n\n### Deeper\n\nMore.'),'His line, kept.','a heading of any level ends it');
 // A closing marker with no opening one: what is before it is data.
 assert.equal(S.adoptedWords(J+'\n<!-- /ar-create:direction-choices:v1 -->\nA plain direction.'),'A plain direction.');
 assert.equal(S.adoptedWords('```json\n'+J+'\n```\n<!-- /ar-create:direction-choices:v1 -->'),'');
 // A comment left open: what is after it is data.
 assert.equal(S.adoptedWords('A plain direction.\n<!-- '+J),'A plain direction.');
 assert.equal(S.adoptedWords('<!-- '+J),'');
 // A record that is only data, and a shape that is not recognised, give nothing.
 assert.equal(S.adoptedWords(J),'');
 assert.equal(S.adoptedWords('## Notes\n\nSomething.'),'');
});

// ---------- a Magazine story as a subject ----------
test('a Magazine story leads to the workspace itself, never to an address it does not know', () => {
 const piece = 'mag-x:article';
 assert.equal(S.magazineHref('mag-x', {}), '/document-study/index.html', 'no ?subject= and no story address: either would open another project');
 assert.equal(S.magazineHref('mag-x', {actor: 'agent:claude-code'}), '/document-study/index.html?reviewActor=agent%3Aclaude-code');
 assert.equal(S.isMagazine({origin: {kind: 'magazine', storyId: 'mag-x'}}), true); assert.equal(S.isMagazine({}), false);
 assert.equal(S.pieceFor({key: 'mag:' + piece, id: piece, owner: {kind: 'magazine'}}), piece); assert.equal(S.pieceFor({key: 'out:a1', id: 'a1'}), 'a1');
 assert.equal(S.inMagazine('Choose photographs in Advanced'), 'Open the Magazine in Advanced'); assert.equal(S.inMagazine('Write'), 'Write');
 // The rule may name a step not known as the one to open; only then is it opened by the page.
 const steps = [step('words', 'done'), step('check', 'unknown')];
 assert.equal(S.firstOpen(steps, {next: {step: 'check', state: 'unknown'}}), 'check'); assert.equal(S.firstOpen(steps, {next: {step: 'check', state: 'next'}}), 'words');
});

test('a Magazine story\'s page: a direction is chosen in the Magazine and not shown as his words, every link leads somewhere that exists, nothing it cannot do is offered', {timeout: 300000}, async t => {
 const {addMagazineToSyntheticHome} = await import('../scripts/demo-magazine.mjs');
 const fixture = syntheticHome(); t.after(() => fs.rmSync(fixture.dir, {recursive: true, force: true}));
 await addMagazineToSyntheticHome(fixture);
 const config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const s = await createServer({dataDir: config.dataDir, publicDir: path.join(repo, 'public'), studyOriginalRoots: config.studyOriginalRoots, researchEnabled: false, packageView: {syntheticFixtures: true}});
 await new Promise(r => s.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => {s.closeAllConnections?.(); s.close(r);}));
 const base = 'http://127.0.0.1:' + s.address().port;
 for (const [id, said, next] of [['mag-kiln-keeper', /A direction is chosen in the Magazine, the dish is not named/, 'check'], ['mag-salt-lake-weaver', /No direction yet/, 'check'], ['mag-bamboo-carver', /No direction yet/, 'facts']]) {
  const standing = await standingOf(base, id);
  assert.equal(standing.next.step, next, id + ': a true next step');
  const {doc} = await page(base, '#/subject/' + id);
  await until(() => doc.querySelector('.subj-row') && doc.querySelector('[data-subj-panel]:not([hidden]) h2'));
  const dir = doc.querySelector('.subj-dir');
  assert.match(dir.textContent, said, id); assert.doesNotMatch(dir.textContent, /fire's handwriting|Waiting as craft/, 'the picked option is never shown as his words');
  assert.equal(doc.querySelector('.subj-form.add'), null, 'a story cannot add a form here');
  assert.deepEqual(rowsOf(doc).map(r => [r[0], r[1]]), (standing.forms[0].steps).map(x => [x.id, x.state]));
  // Open every step; every link on the page is version two's own screen or the story's place in the Magazine.
  const hrefs = new Set();
  for (const row of [...doc.querySelectorAll('.subj-row')]) {
   row.querySelector('[data-subj-step]').click(); await new Promise(r => setTimeout(r, 60));
   for (const a of doc.querySelectorAll('[data-subj-panel] a, .subj-head a[data-subj-handoff]')) hrefs.add(a.getAttribute('href'));
   assert.equal(doc.querySelector('[data-subj-panel] [data-subj-capture], [data-subj-panel] [data-subj-add]'), null, 'no way to attach material or add a form here');
  }
  for (const href of hrefs) {
   if (/^#\//.test(href)) assert.match(href, new RegExp('^#/(write|read|check|research)/' + id + '(\\?piece=' + encodeURIComponent(id + ':article') + ')?$'));
   else assert.match(href, /^\/document-study\/index\.html(\?reviewActor=[^&]*)?$/, href);
  }
  assert.ok([...hrefs].some(h => h.startsWith('#/write/' + id + '?piece=')), 'Write is version two\'s own screen');
  assert.doesNotMatch(doc.querySelector('[data-v2-advanced]').getAttribute('href'), /subject=/, 'the bar never names a story it cannot open');
 }
});
