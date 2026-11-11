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
const S=(()=>{const ctx={module:{exports:{}},Date,JSON,Object,Array,Set,Map,String,Number,Math,isNaN,console};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync(path.join(repo,'public/v2/screens/subject.js'),'utf8'),ctx);
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
 assert.deepEqual(S.pillView(standing.forms[0],0),{key:'out:1',name:'Article',line:'the magazine',ring:.125,count:'1/8',say:'First: Article for the magazine, 1 of 8 steps done'});
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
  for(const [row,s] of steps.map((s,i)=>[rowsOf(doc)[i],s]))assert.equal(row[2],s.state==='done'?'':s.state==='unknown'?'Not known':s.note,id+' '+s.id+' note');
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
