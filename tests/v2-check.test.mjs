import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo,CHECKED} from '../scripts/demo-fill.mjs';

// Version two's Check: the pure steps, the screen in a page on stubs, and the same commands (study-draft.check.get and
// .post, current-work.read, study-ai.read) against the real in-process server, with the demo's invented subject whose
// Article quotes its captured source once exactly and once altered. Invented words only.
//
// Write's shared helpers v2.shared.write.locate and .bar come from the Read builder. Where they are not loaded yet, a small
// stand-in with the same signatures is used here; where they are, the real ones are.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const plain=value=>JSON.parse(JSON.stringify(value));
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await settle(25);}};

const STAND_IN=`(function(v2){
 if(typeof v2.shared.write?.locate==='function'&&typeof v2.shared.write?.bar==='function')return;
 const {esc,icon}=v2.ui;
 async function locate(id,pieceId){
  const s=await v2.call('subject.standing',{parentStudyId:id});const forms=s.forms||[],articles=forms.filter(f=>f.kind==='article');
  const form=pieceId?articles.find(f=>f.id===pieceId)||null:articles[0]||null;let bindingId=s.facts?.bindingId||null,native=true;
  const piece=form&&/^out:/.test(form.key||'')?form.id:null;
  if(piece&&bindingId){try{const outs=await v2.call('study.outputs',{rootBindingId:bindingId,parentStudyId:id,selectedOutputId:piece});
   const owner=(outs?.outputBindings||[]).find(b=>b.outputId===piece)?.wordOwner;
   if(owner&&owner.kind==='native'&&owner.bindingId)bindingId=owner.bindingId;else if(owner&&owner.kind!=='native'){bindingId=null;native=false;}}catch{}}
  return {standing:s,forms,form,piece,bindingId,native};
 }
 function bar({id,forms,form,piece,mode,right}){
  const q=piece?'?piece='+encodeURIComponent(piece):'';
  const seg=['write','read','check'].map(m=>m===mode?'<span aria-current="true">'+m+'</span>':'<a href="#/'+m+'/'+esc(id)+q+'">'+m+'</a>').join('');
  return '<div class="wr-bar" data-wr-bar><a class="wr-back" href="'+esc(v2.href('subject/:id',{id}))+'">'+icon('back')+'<span>The subject</span></a><div class="wr-seg">'+seg+'</div><span class="wr-sp"></span>'+(right||'')+'</div>';
 }
 v2.shared.write=Object.freeze({...v2.shared.write,locate,bar});
})(window.v2);`;
const COVERAGE_URL=pathToFileURL(path.join(repo,'public/lib/decision-coverage.js')).href;

const COMMANDS=[['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],['look','GET','/api/look',true],
 ['subject.standing','GET','/api/subject/standing',true],['study.outputs','GET','/api/study/outputs',true],['study-draft.read','GET','/api/study-draft/read',true],['study-draft.save','POST','/api/study-draft/save',false],
 ['study-draft.check.get','GET','/api/study-draft/check',true],['study-draft.check.post','POST','/api/study-draft/check',false],['current-work.read','POST','/api/current-work/read',true],['study-ai.read','GET','/api/study-ai/read',true],['presence.post','POST','/api/presence',false],['consent.desk','GET','/api/consent/desk',true],
 ['study-draft.capture-sources.list','GET','/api/study-draft/capture-sources/list',true],['study-draft.capture-sources','POST','/api/study-draft/capture-sources',false],['study-draft.capture-sources.stop','POST','/api/study-draft/capture-sources/stop',false]]
 .map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));

/** Loads the page's scripts, then Check (and the stand-in for Write's helpers when they are missing). */
function boot(w,{coverage=true}={}){
 const html=read('public/v2/index.html');
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.EventSource=class{constructor(){this.l={};w.__sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){if(/screens\/check\.js$/.test(src))continue;w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));}
 w.eval(STAND_IN);
 // jsdom cannot load an ES module with import(): the page's one import of the app's own module is answered from node.
 w.__coverage=()=>import(COVERAGE_URL);
 w.eval(read('public/v2/screens/check.js').replace("import('/lib/decision-coverage.js')",coverage?'window.__coverage()':"Promise.reject(Error('no module'))"));
}

// ---- a page whose commands are answered from a table: route -> body, [status, body] or function(url, body) ----
async function page({hash='',answers={},search='',cover=null,storage={}}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html'+search+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);w.__sources=[];
 for(const [key,value] of Object.entries(storage))w.localStorage.setItem(key,value);
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href),body=options.body?JSON.parse(options.body):null;calls.push({path:u.pathname,method:options.method||'GET',body,search:u.search});
  let answer=u.pathname==='/api/capabilities'?{commands:COMMANDS}:answers[u.pathname]??{};if(typeof answer==='function')answer=answer(u,body);
  const [status,out]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(out)};};
 boot(w);
 if(cover)w.__coverage=async()=>({projectDecisionCoverage:cover});
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await settle(60);
 return {w,calls,doc:w.document,sources:w.__sources};
}
const row=(id,words,extra={})=>({id,words,blockKind:'paragraph',safe:true,blockHash:id.padEnd(64,'0'),...extra});
const EXPECTED={workflow:{draft:'d1',edits:'e1'},bindingHash:'b1',correspondenceHash:'c1'};
const standing={title:'The green gate',look:null,facts:{bindingId:'root1'},forms:[{id:'o1',key:'out:o1',kind:'article',name:'Article',title:'The green gate'}]};
const outputs={outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'root1',parentStudyId:'s1'}}]};
const draft=(words,expected=EXPECTED)=>({raw:'x',projection:words.map((w,i)=>row('p'+(i+1),w)),expected,history:[]});
const receipt=(extra={})=>({schema:'ar-create.study-draft-check.v1',checkId:'11111111-2222-3333-4444-555555555555',bindingId:'root1',parentStudyId:'s1',status:'needs-review',proof:{expected:EXPECTED,draftHash:'d1'},
 quote:{status:'failed',output:'NOT FOUND: "Altered words."\n1 of 2 quoted passages found in the transcript.\n'},split:{status:'not-applicable'},createdAt:new Date().toISOString(),finishedAt:new Date().toISOString(),
 issues:[{id:'quote-1',type:'quote',severity:'review',message:'NOT FOUND: "Altered words."',locator:{kind:'native-paragraph',nativeId:'p2',passage:'Altered words.'}}],...extra});
const base=(over={})=>({'/api/subject/standing':standing,'/api/study/outputs':outputs,'/api/study-draft/read':draft(['First, with "Exact words." in it.','Second, with "Altered words." in it.']),'/api/study-draft/check':[200,null],
 '/api/current-work/read':[409,{error:'not here'}],'/api/study-ai/read':{projection:[]},...over});
const ready=doc=>until(()=>doc.querySelector('.ck .ck-work')||doc.querySelector('.ck .ck-none'));

// ---------- the pure half ----------
test('state, outcome, reason, counts and findings say what the existing workspace says',async()=>{
 const {w}=await page(),C=w.v2.shared.check;
 assert.equal(C.stateOf(null,false).label,'No saved check');
 assert.equal(C.stateOf({status:'checked'},false).label,'Outdated check');
 assert.equal(C.stateOf({status:'checked'},true).label,'Mechanical checks complete');
 assert.equal(C.stateOf({status:'needs-review'},true).label,'Review needed');
 assert.equal(C.stateOf({status:'held'},true).label,'Checks held');
 assert.equal(C.stateOf({status:'running'},true).label,'Check unfinished');
 assert.equal(C.stateOf({status:'failed'},true).label,'Check did not finish');
 assert.equal(C.outcome({status:'checked-pass'},'quote'),'Matched captured source');
 assert.equal(C.outcome({status:'not-applicable'},'split'),'No quote pairs to compare');
 assert.equal(C.outcome({status:'unsupported'},'quote'),'Held, needs manual review');
 assert.equal(C.reason({reason:'No captured SRC available.'}),'Capture the source transcript before checking.');
 assert.equal(C.heldWhy({status:'held',quote:{status:'held',reason:'No captured SRC available.'},split:{status:'held',reason:'No captured SRC available.'}}),'Capture the source transcript before checking.','each reason once');
 assert.equal(C.heldWhy({status:'needs-review'}),'');
 assert.deepEqual(plain(C.quoteCounts({output:'NOT FOUND: "x"\n1 of 2 quoted passages found in the transcript.'})),{found:1,of:2});
 assert.equal(C.quoteCounts({output:'nothing'}),null);
 assert.deepEqual(plain(C.finding({message:'NOT FOUND: "Some words."',locator:{passage:'Some words.'}})),{title:'Quote needs review',action:'Compare these words with the captured source.',words:'Some words.'});
 assert.equal(C.finding({message:'SPLIT (a)'}).title,'Possible quote split');
 assert.equal(C.finding({message:'UNSUPPORTED: x',severity:'held'}).title,'Passage held');
 assert.equal(C.passageMarkup('One <b>two</b> three','<b>two</b>'),'One <mark class="ck-mark">&lt;b&gt;two&lt;/b&gt;</mark> three','the passage is marked and every word escaped');
 assert.equal(C.passageMarkup('One two','three'),null);
 assert.equal(C.whenLabel('2026-11-10T13:52:00',new Date('2026-11-11T09:00:00')),'10 Nov, 13:52');
 assert.equal(C.whenLabel('2026-11-11T13:52:00',new Date('2026-11-11T20:00:00')),'13:52');
});

test('a saved check is current only for this piece and the very revision he reads',async()=>{
 const {w}=await page(),C=w.v2.shared.check,ids={bindingId:'root1',parentStudyId:'s1'},rd={expected:EXPECTED};
 assert.equal(C.receiptCurrent(receipt(),rd,ids),true);
 assert.equal(C.receiptCurrent(receipt({proof:{expected:{...EXPECTED,workflow:{draft:'d2',edits:'e1'}}}}),rd,ids),false,'other words');
 assert.equal(C.receiptCurrent(receipt({status:'stale'}),rd,ids),false);
 assert.equal(C.receiptCurrent(receipt({bindingId:'other'}),rd,ids),false);
 assert.equal(C.receiptCurrent(receipt({proof:{expected:{correspondenceHash:'c1',bindingHash:'b1',workflow:{edits:'e1',draft:'d1'}}}}),rd,ids),true,'key order does not matter');
 assert.equal(C.receiptCurrent(null,rd,ids),false);
});

// ---------- the screen, on stubs ----------
test('Check opens the saved words read only and, with no saved check, offers to check them',async()=>{
 const {w,doc,calls}=await page({hash:'#/check/s1?piece=o1',answers:base()});await ready(doc);
 assert.equal(doc.querySelector('.v2-page.wr.ck')!==null,true,'it wears Write\'s page frame');
 assert.equal(doc.querySelector('.wr-bar [aria-current="true"]').textContent.trim().toLowerCase(),'check','the sub bar says Check is open');
 assert.deepEqual([...doc.querySelectorAll('.ck-text .ck-p')].map(p=>p.textContent),['First, with "Exact words." in it.','Second, with "Altered words." in it.']);
 assert.equal(doc.querySelector('.ck-text [contenteditable],.ck-text textarea,.ck-text input'),null,'nothing to edit');
 assert.match(doc.querySelector('.ck-state').textContent,/No saved check/);
 assert.equal(doc.querySelector('[data-ck="run"]').textContent,'Check saved draft');
 assert.ok(calls.some(c=>c.path==='/api/study-draft/read'&&/bindingId=root1/.test(c.search)),'the owner of the words is read');
 assert.ok(!calls.some(c=>c.method==='POST'&&/study-draft\/save/.test(c.path)),'Check never changes the draft');
 assert.match(doc.querySelector('.ck-more').textContent,/Not built yet/,'comparing versions says it is not built');
 assert.ok([...doc.querySelectorAll('.ck-more a')].some(a=>/section=check/.test(a.getAttribute('href'))),'with Open in Advanced');
});

test('Check identifies unsaved version three words in another tab without changing the saved draft',async()=>{
 const key='ar-v3-write:root1:1',kept=JSON.stringify({v:2,edits:[['p1','Newer words.','First, with "Exact words." in it.']],added:[]});
 const {w,doc,calls}=await page({hash:'#/check/s1?piece=o1',answers:base(),storage:{[key]:kept}});await ready(doc);
 assert.match(doc.querySelector('.ck-note').textContent,/unsaved words in Write/);
 assert.match(doc.querySelector('.ck-text').textContent,/First, with "Exact words."/);
 assert.ok(!calls.some(c=>c.method==='POST'&&/study-draft\/save/.test(c.path)));
 w.localStorage.removeItem(key);w.dispatchEvent(new w.StorageEvent('storage',{key}));
 assert.equal(doc.querySelector('.ck-note'),null);
});

test('pressing Check saved draft posts the revision he read with an operation id, then shows the finding and brings its words into view',async()=>{
 const answers=base({'/api/study-draft/check':(u,body)=>body?receipt():null});
 const {w,doc,calls}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 doc.querySelector('[data-ck="run"]').click();
 await until(()=>doc.querySelector('.ck-find'));
 const post=calls.find(c=>c.method==='POST'&&c.path==='/api/study-draft/check');
 assert.deepEqual(plain(post.body.expected),EXPECTED,'the expected revision is the one study-draft.read gave');
 assert.match(post.body.operationId,/^[0-9a-f-]{36}$/);assert.equal(post.body.bindingId,'root1');assert.equal(post.body.parentStudyId,'s1');
 assert.match(doc.querySelector('.ck-state').textContent,/Review needed/);
 assert.match(doc.querySelector('.ck-results').textContent,/1 of 2 quoted passages matched the captured source/,'a pass and a finding together');
 const find=doc.querySelector('.ck-find');
 assert.match(find.textContent,/Quote needs review/);assert.match(find.textContent,/Altered words\./);assert.match(find.textContent,/Compare these words with the captured source/);
 assert.match(doc.querySelector('.ck-src').textContent,/Not built yet/,'View source has no command');
 assert.equal(doc.querySelector('[data-ck-p="p2"]').dataset.flag,'true','the paragraph the check pointed at is flagged in the margin');
 doc.querySelector('[data-ck="go"]').click();
 const p2=doc.querySelector('[data-ck-p="p2"]');
 assert.equal(p2.dataset.hit,'true');assert.equal(p2.querySelector('mark').textContent,'Altered words.');assert.equal(doc.activeElement,p2,'focus follows to the words');
 assert.equal(doc.querySelector('[data-ck-p="p1"]').dataset.hit,undefined);
 assert.equal(doc.querySelector('.wr-bar .ck-bar').textContent,'Review needed','the bar says the state');
});

test('an outdated check, a held check with its reason, and a refusal are each said plainly',async()=>{
 const old=receipt({proof:{expected:{...EXPECTED,workflow:{draft:'older',edits:'e1'}}}});
 let pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,old]})});await ready(pg.doc);
 assert.match(pg.doc.querySelector('.ck-state').textContent,/Outdated check/);
 assert.equal(pg.doc.querySelector('[data-ck="run"]').textContent,'Check saved draft again');
 assert.ok(pg.doc.querySelector('.ck-find[data-old="true"]'),'an old finding is still listed, marked as from the older check');
 assert.equal(pg.doc.querySelector('[data-ck="go"]'),null,'but never pointed at the new words');
 assert.ok(pg.doc.querySelector('[data-ck="reload"]'),'Load current saved draft');
 const held=receipt({status:'held',issues:[],quote:{status:'held',reason:'No captured SRC available.'},split:{status:'held',reason:'No captured SRC available.'}});
 pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,held]})});await ready(pg.doc);
 assert.match(pg.doc.querySelector('.ck-state').textContent,/Checks held/);assert.match(pg.doc.querySelector('.ck-why').textContent,/Capture the source transcript before checking/);
 pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':(u,body)=>body?[500,{error:'The check could not start.'}]:null})});await ready(pg.doc);
 pg.doc.querySelector('[data-ck="run"]').click();await until(()=>pg.doc.querySelector('[data-ck-run] .ck-bad'));
 assert.match(pg.doc.querySelector('[data-ck-run] .ck-bad').textContent,/The app could not answer\. Nothing was changed/);assert.equal(pg.doc.querySelector('[data-ck="run"]').disabled,false,'he can try again');
});

test('an outdated check still lists its findings as older, a held check with none says so, and a stand-in decision is called synthetic',async()=>{
 const old=receipt({proof:{expected:{...EXPECTED,workflow:{draft:'older',edits:'e1'}},draftHash:'a'.repeat(64),sources:[{role:'src',id:'s-1',hash:'b'.repeat(64)}]},quote:{status:'failed',output:'NOT FOUND: "Altered words."\n1 paragraphs with no quotation marks left unchecked\n'}});
 let pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,old]})});await ready(pg.doc);
 const find=pg.doc.querySelector('.ck-find[data-old="true"]');
 assert.match(find.textContent,/From the older check/);assert.match(find.textContent,/Quote needs review/);assert.match(find.textContent,/Altered words\./);
 assert.match(find.textContent,/Recheck the current revision to locate this finding\./);
 assert.equal(pg.doc.querySelector('[data-flag]'),null);
 const proof=pg.doc.querySelector('.ck-proof');assert.equal(proof.open,false,'the fold stays closed');
 assert.match(proof.textContent,new RegExp('Draft SHA-256: a{64}'));assert.match(proof.textContent,new RegExp('src s-1 · SHA-256 b{64}'));
 assert.match(proof.textContent,/Quote output/);assert.match(proof.textContent,/1 paragraphs with no quotation marks left unchecked/);assert.match(proof.textContent,/Split output/);
 const held=receipt({status:'held',issues:[],quote:{status:'held',reason:'No captured SRC available.'},split:{status:'held',reason:'No captured SRC available.'}});
 pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,held]})});await ready(pg.doc);
 assert.equal(pg.doc.querySelector('[data-ck-empty]').textContent,'No current findings to show. Run or recheck the saved revision before treating the manuscript as checked.');
 const packet={fingerprint:'f1',piece:{wordOwner:{kind:'native',bindingId:'root1'},words:{hash:'d1'}}};
 const report=role=>({status:'partial',findings:[{id:'f-1',code:'protected-paragraph-unassessed',assessment:'unassessed',message:'Protected wording was recorded.',evidence:{record:{text:'Invented words.',reason:'An invented reason.',...(role?{decisionRole:role}:{})}},navigation:{}}]});
 pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/current-work/read':[200,packet]}),cover:()=>report('stand-in')});await ready(pg.doc);
 await until(()=>pg.doc.querySelector('.ck-dec[data-finding]'));
 assert.equal(pg.doc.querySelector('[data-ck-standin]').textContent,'Synthetic test decision','a stand-in is called what it is');
 pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/current-work/read':[200,packet]}),cover:()=>report(null)});await ready(pg.doc);
 await until(()=>pg.doc.querySelector('.ck-dec[data-finding]'));
 assert.equal(pg.doc.querySelector('[data-ck-standin]'),null,'a real decision is not marked');
});

test('a changed draft arriving from the stream is shown, and the saved check no longer covers it',async()=>{
 let words=['One.'],exp=EXPECTED;
 const answers=base({'/api/study-draft/read':()=>draft(words,exp),'/api/study-draft/check':[200,receipt({quote:{status:'checked-pass'},issues:[],status:'checked'})]});
 const {doc,sources}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 assert.match(doc.querySelector('.ck-state').textContent,/Mechanical checks complete/);
 words=['One, and now two.'];exp={...EXPECTED,workflow:{draft:'d2',edits:'e1'}};
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:9,bootId:'b',scope:{kind:'draft',id:'root1'},operationId:'elsewhere'});
 await until(()=>doc.querySelector('.ck-p')?.textContent==='One, and now two.');
 assert.match(doc.querySelector('.ck-state').textContent,/Outdated check/);
});

test('a missing piece, another subject\'s piece and words kept elsewhere are said plainly; no Article leads to Write',async()=>{
 let pg=await page({hash:'#/check/s1?piece=nope',answers:base()});await ready(pg.doc);
 assert.match(pg.doc.querySelector('.ck-none').textContent,/not one of this subject’s Articles/);
 pg=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'magazine'}}]}})});await ready(pg.doc);
 assert.match(pg.doc.querySelector('.ck-none').textContent,/not kept where Check can open them/);assert.ok(pg.doc.querySelector('.ck-none a[href*="section=check"]'),'Open in Advanced');
 pg=await page({hash:'#/check/s1',answers:base({'/api/subject/standing':{...standing,forms:[]}})});await ready(pg.doc);
 assert.match(pg.doc.querySelector('.ck-none').textContent,/no Article yet/);
 pg=await page({hash:'#/check/nobody?piece=o1',answers:base({'/api/subject/standing':[404,{error:'No such subject.'}]})});await ready(pg.doc);
 assert.ok(pg.doc.querySelector('.ck-none a[href="#/"]'),'an unknown subject offers Home');assert.doesNotMatch(pg.doc.querySelector('.ck-none').textContent,/Back to the subject/);
});

test('without Write\'s shared helpers, Check says so plainly and does not fail',async()=>{
 const html=read('public/v2/index.html'),dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html#/check/s1?piece=o1',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;windows.push(w);w.__sources=[];
 w.fetch=async input=>{const u=new URL(String(input),w.location.href);return {ok:true,status:200,text:async()=>JSON.stringify(u.pathname==='/api/capabilities'?{commands:COMMANDS}:{})};};
 w.CSS={escape:v=>v};w.EventSource=class{addEventListener(){}close(){}};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){if(/screens\/(check|read)\.js$/.test(src))continue;w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));}
 w.v2.shared.write=Object.freeze({});// the helpers are not there
 w.eval(read('public/v2/screens/check.js'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('.ck-none'));
 assert.match(w.document.querySelector('.ck-none').textContent,/not loaded/);assert.ok(w.document.querySelector('.ck-none a[href*="section=check"]'),'it still opens in Advanced');
});

// ---------- the real server ----------
let worldPromise=null,closeWorld=null;
async function theWorld(){
 // Cache initialization itself: a timed-out caller must not start a second fixture and lose the first server.
 if(!worldPromise)worldPromise=(async()=>{
  const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
  let s=null;
  closeWorld=async()=>{if(s?.listening){const closed=new Promise((resolve,reject)=>s.close(error=>error?reject(error):resolve()));s.closeAllConnections();await closed;}fs.rmSync(fixture.dir,{recursive:true,force:true});};
  try{
   s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
   await new Promise(r=>s.listen(0,'127.0.0.1',r));
   const url='http://127.0.0.1:'+s.address().port;
   const filled=await fillDemo(url,{only:[CHECKED.slug,'the-first-cup']});
   return {base:url,filled};
  }catch(error){await closeWorld();throw error;}
 })();
 return worldPromise;
}
after(async()=>{if(worldPromise)await worldPromise.catch(()=>{});await closeWorld?.();});
const getJSON=async(b,p,actor='agent:claude-code')=>{const r=await fetch(b+p,{headers:{'X-AR-Actor':actor,'X-AR-Client':'http'}});return r.json();};
const postJSON=async(b,p,body,actor='agent:claude-code')=>{const r=await fetch(b+p,{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'http',Origin:b},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
const subjectOf=async(b,slug)=>{const st=await getJSON(b,'/api/subject/standing?parentStudyId=demo-'+slug);return {id:'demo-'+slug,root:st.facts.bindingId,piece:st.forms.find(f=>f.kind==='article').id,title:st.title};};

test('the demo has one invented subject whose Article quotes its captured source once exactly and once altered',{timeout:240000},async()=>{
 const {base:b,filled}=await theWorld();
 assert.equal(filled.checkedSubject,'demo-'+CHECKED.slug);assert.deepEqual(filled.unreached,[]);
 const sub=await subjectOf(b,CHECKED.slug);
 const q=`?bindingId=${sub.root}&parentStudyId=${sub.id}`;
 const d=await getJSON(b,'/api/study-draft/read'+q);
 assert.ok(d.context.records.some(r=>r.role==='source'&&!r.missing),'a captured source');
 assert.equal(await getJSON(b,'/api/study-draft/check'+q),null,'no saved check yet');
 const run=await postJSON(b,'/api/study-draft/check',{bindingId:sub.root,parentStudyId:sub.id,expected:d.expected,operationId:crypto.randomUUID()});
 assert.equal(run.status,200);const c=run.body;
 assert.equal(c.status,'needs-review');assert.equal(c.issues.length,1,'one real finding');
 assert.match(c.issues[0].message,/Entirely invented source fixtures\. Nobody ever interviewed anyone\./);assert.equal(c.issues[0].locator.kind,'native-paragraph');
 assert.match(c.quote.output,/1 of 2 quoted passages found/,'and one real pass');
 assert.deepEqual(plain(c.proof.expected),plain(d.expected),'it covers the revision that was read');
 const again=await getJSON(b,'/api/study-draft/check'+q);assert.equal(again.checkId,c.checkId,'the saved check is read back');
 // a second fill changes nothing
 await fillDemo(b,{only:[CHECKED.slug]});
 assert.deepEqual(plain((await getJSON(b,'/api/study-draft/read'+q)).expected),plain(d.expected),'a second fill leaves the words alone');
});

test('a subject with no captured source is held, and says why',{timeout:120000},async()=>{
 const {base:b}=await theWorld(),sub=await subjectOf(b,'the-first-cup'),q=`?bindingId=${sub.root}&parentStudyId=${sub.id}`;
 const d=await getJSON(b,'/api/study-draft/read'+q);
 const run=await postJSON(b,'/api/study-draft/check',{bindingId:sub.root,parentStudyId:sub.id,expected:d.expected,operationId:crypto.randomUUID()});
 assert.equal(run.body.status,'held');assert.equal(run.body.quote.reason,'No captured SRC available.');
});

/** The real screen on the real server. */
async function live(b,sub,{search='',tab='check'}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:b+'/v2/index.html'+search+'#/'+tab+'/'+sub.id+'?piece='+sub.piece,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);w.__sources=[];
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  const r=await fetch(b+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:b}:{})},body:options.body});const text=await r.text();entry.status=r.status;return {ok:r.ok,status:r.status,text:async()=>text};};
 boot(w);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('.ck .ck-work')||w.document.querySelector('.ck .ck-none'));
 return {w,doc:w.document,calls,sources:w.__sources};
}

test('real server: Check shows the words, runs the check, points at the altered quote, and reads the decisions in the piece',{timeout:240000},async()=>{
 const {base:b}=await theWorld(),sub=await subjectOf(b,CHECKED.slug);
 const {doc,calls}=await live(b,sub);
 assert.deepEqual([...doc.querySelectorAll('.ck-text .ck-p')].map(p=>p.textContent).length,3);
 assert.match(doc.querySelector('.ck-state').textContent,/Review needed|No saved check/,'a check saved by the earlier test is current, or none yet');
 doc.querySelector('[data-ck="run"]').click();
 await until(()=>doc.querySelector('.ck-find')&&/Review needed/.test(doc.querySelector('.ck-state').textContent));
 const post=calls.filter(c=>c.method==='POST'&&c.path==='/api/study-draft/check').at(-1);
 assert.equal(post.status,200);assert.ok(post.body.operationId&&post.body.expected.workflow.draft);
 assert.equal(doc.querySelectorAll('.ck-find').length,1);assert.match(doc.querySelector('.ck-results').textContent,/1 of 2 quoted passages matched/);
 doc.querySelector('[data-ck="go"]').click();
 assert.match(doc.querySelector('[data-hit="true"] mark').textContent,/^Entirely invented source fixtures/);
 // decisions in this piece, over current-work.read and the app's own coverage projection
 await until(()=>doc.querySelector('.ck-dec'),30000);
 assert.ok(calls.some(c=>c.path==='/api/current-work/read'&&c.status===200),'current-work.read');
 assert.match(doc.querySelector('[data-ck-dec]').textContent,/Literal comparison complete|Decision coverage/);
 assert.match(doc.querySelector('[data-ck-dec]').textContent,/Source support/);
 await until(()=>/Truth and consent/.test(doc.querySelector('[data-ck-truth]').textContent)&&!/Reading the claims/.test(doc.querySelector('[data-ck-truth]').textContent));
 assert.ok(calls.some(c=>c.path==='/api/consent/desk'&&c.status===200),'consent.desk is read');
 assert.equal(doc.querySelector('[data-ck-truth] [data-cd-answer],[data-ck-truth] select,[data-ck-truth] input'),null,'read only: no answer is offered');
 assert.ok(calls.every(c=>!(c.method==='POST'&&/study-draft\/save|study-ai\/(accept|reject|finish)/.test(c.path))),'only the check is ever written');
 assert.equal(calls.filter(c=>c.status>=400).map(c=>c.path+' '+c.status).join(),'','nothing was refused');
});

test('real server: a held check on a subject with no source says why; an assistant\'s page can read and check but never writes words',{timeout:240000},async()=>{
 const {base:b}=await theWorld(),sub=await subjectOf(b,'the-first-cup');
 const {doc,calls,w}=await live(b,sub,{search:'?reviewActor=agent:claude-code'});
 assert.match(doc.querySelector('.ck-ro').textContent,/Check only reads the saved words/);
 doc.querySelector('[data-ck="run"]').click();
 await until(()=>/Checks held/.test(doc.querySelector('.ck-state').textContent));
 assert.match(doc.querySelector('.ck-why').textContent,/Capture the source transcript before checking/);
 assert.equal(doc.querySelector('.ck-find'),null);
 assert.ok(calls.every(c=>!(c.method==='POST'&&!/study-draft\/check|presence|current-work\/read/.test(c.path))),'an assistant\'s page writes only a check receipt');
 assert.equal(w.localStorage.length,0,'nothing is kept on the device');
});

test('real server: a save made elsewhere arrives from the stream and the saved check is outdated', {timeout:240000},async()=>{
 const {base:b}=await theWorld(),sub=await subjectOf(b,CHECKED.slug),q=`?bindingId=${sub.root}&parentStudyId=${sub.id}`;
 const {doc,sources}=await live(b,sub);
 doc.querySelector('[data-ck="run"]').click();await until(()=>/Review needed/.test(doc.querySelector('.ck-state').textContent));
 const d=await getJSON(b,'/api/study-draft/read'+q);
 const saved=await postJSON(b,'/api/study-draft/save',{bindingId:sub.root,parentStudyId:sub.id,operationId:crypto.randomUUID(),expected:d.expected,operations:[{kind:'insert',id:crypto.randomUUID(),beforeId:null,raw:'One more line.'}]},'human:adrian');
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:99999,bootId:'b',scope:{kind:'draft',id:sub.root},operationId:'elsewhere'});
 await until(()=>/Outdated check/.test(doc.querySelector('.ck-state').textContent));
 assert.match(doc.querySelector('.ck-text').textContent,/One more line\./,'the new words are shown');
 assert.equal(doc.querySelector('[data-ck="go"]'),null,'the old finding is not pointed at the new words');
 assert.equal(doc.querySelector('[data-flag]'),null,'and no paragraph is flagged for it');
});

test('Check follows the house rules: six sizes, no em dash, no fetch, escaped records, no speech, nothing written but the check',()=>{
 const css=read('public/v2/screens/check.css'),js=read('public/v2/screens/check.js');
 for(const m of css.matchAll(/font-size:\s*([^;}]+)/g))assert.match(m[1],/^var\(--(?:v2-t(12|13|14|15|18|22)|size-(caption|detail|button|table|ui|nav|body|card-title|page-title))\)$/,m[0]);
 for(const m of css.matchAll(/font:[^;}]*?(var\(--v2-t\d+\))/g))assert.match(m[1],/--v2-t(12|13|14|15|18|22)\)/);
 assert.deepEqual([...css.matchAll(/font:\s*(?:italic\s+)?\d{3}\s+(\d+(?:\.\d+)?px)/g)].map(m=>m[1]),[],'every size is a --v2-t token');
 assert.doesNotMatch(css+js,/\u2014/,'no em dash');
 assert.doesNotMatch(js,/\bfetch\s*\(/,'a command is never fetched');
 assert.doesNotMatch(js,/SpeechRecognition|webkitSpeech|getUserMedia/,'no speech');
 assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'only the app\'s colour tokens');
 assert.doesNotMatch(js,/study-draft\.save|study-ai\.(accept|reject|finish)|localStorage\.(set|remove)Item|document-study/,'it writes no words and keeps no record');
 // every rule, including each one inside an @media block (the first rule after an @media's brace is a rule too)
 const selectors=[];{const text=css.replace(/\/\*[\s\S]*?\*\//g,'');let depth=0,start=0;
  for(let i=0;i<text.length;i++){const ch=text[i];
   if(ch==='{'){const prelude=text.slice(start,i).trim();if(prelude.startsWith('@'))start=i+1;else{for(const sel of prelude.split(','))selectors.push(sel.trim());depth++;start=-1;}}
   else if(ch==='}'){if(start===-1){depth--;start=i+1;}else start=i+1;}}}
 assert.ok(selectors.length>40,'the sheet was read: '+selectors.length);
 for(const sel of selectors)assert.match(sel,/^\.ck[\s\[:.]|^\.ck$/,'every rule starts with .ck: '+sel);
 assert.ok(selectors.includes('.ck .ck-sheet{padding:56px'.split('{')[0]),'rules outside @media are read');
 assert.doesNotMatch(css,/white-space:\s*nowrap/,'long words and labels break instead of cutting the card off');
 assert.match(js,/import\('\/lib\/decision-coverage\.js'\)/,'decisions use the app\'s own coverage projection');
});

// ---- small corrections after the last review ----
test('a refused consent.desk read says it could not be read, not that only Adrian can decide; People adds no sentence the existing Check lacks',async()=>{
 const {doc}=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/consent/desk':[403,{error:'Only a person can do this.'}]})});await ready(doc);
 await until(()=>doc.querySelector('[data-ck-truth] .ck-bad'));
 const said=doc.querySelector('[data-ck-truth] .ck-bad').textContent;
 assert.match(said,/could not be read/);assert.doesNotMatch(said,/Only Adrian|decide|human|person can/i);
 const ok=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/consent/desk':{claims:[],people:[{id:'x1',name:'Invented Person',appears:['One'],consent:{state:'not asked'}}],summary:{claims:0},release:{blockers:[]}}})});await ready(ok.doc);
 await until(()=>/Invented Person/.test(ok.doc.querySelector('[data-ck-truth]').textContent));
 assert.doesNotMatch(ok.doc.querySelector('[data-ck-truth]').textContent,/to give/);
});

// ---- capture sources: the held state offers the list and the one button (piece B) ----
const HELD=receipt({status:'held',issues:[],quote:{status:'held',reason:'No captured SRC available.'},split:{status:'held',reason:'No captured SRC available.'}});
const PASSED=receipt({status:'checked',issues:[],quote:{status:'checked',output:'1 of 1 quoted passages found in the transcript.\n'},split:{status:'checked'}});
const LIST='/api/study-draft/capture-sources/list',CAPTURE='/api/study-draft/capture-sources';
const src=(extra={})=>({id:'src-1',title:'Interview transcript',kind:'transcript',hash:'a'.repeat(64),eligible:true,confirmedByYou:true,reviewed:true,captured:false,...extra});
const listOf=(sources,extra={})=>({bindingId:'root1',parentStudyId:'s1',canCapture:true,sourcesHash:null,hasQuoteSource:false,sources,...extra});

test('a check held for want of a source lists what Check can read, and one button captures exactly those; Check then runs again by itself', async()=>{
 let captured=false;
 const answers=base({'/api/study-draft/check':(u,body)=>body?PASSED:HELD,[LIST]:()=>listOf([src(),src({id:'src-2',title:'Studio note',kind:'markdown',eligible:false,confirmedByYou:false,reason:'Not confirmed by you yet. Confirm this material yourself before using it for Check.'})]),[CAPTURE]:()=>{captured=true;return {captured:[{sourceId:'src-1'}],sourcesHash:'f'.repeat(64)};}});
 const {doc,calls}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 await until(()=>doc.querySelector('[data-ck-run] [data-cs-block] [data-cs=capture]'));
 assert.match(doc.querySelector('.ck-why').textContent,/Capture the source transcript before checking/);
 const items=[...doc.querySelectorAll('[data-cs-block] li')];
 assert.equal(items.length,2);
 assert.match(items[0].textContent,/Interview transcript/);assert.match(items[0].textContent,/Transcript/);assert.match(items[0].textContent,/Confirmed by you/);
 assert.match(items[1].textContent,/Studio note/);assert.match(items[1].textContent,/Not confirmed by you yet/,'what is not eligible says why, in the list\'s own words');
 assert.equal(doc.querySelectorAll('[data-cs=capture]').length,1,'one button');assert.equal(doc.querySelector('[data-cs=capture]').textContent,'Use it for Check');
 assert.ok(!doc.querySelector('[data-cs=capture]').classList.contains('pri'),'it is a plain button: the card\'s own Check saved draft stays its one primary');
 assert.equal(doc.querySelectorAll('[data-ck-run] button.pri').length,1,'one primary in the card');
 assert.equal(doc.querySelector('[data-cs-block] .subj-cs-h h3').textContent,'Sources');
 assert.ok(calls.some(c=>c.path===LIST&&/bindingId=root1/.test(c.search)&&/parentStudyId=s1/.test(c.search)),'the list is asked for this subject\'s draft');
 const before=calls.filter(c=>c.method==='POST'&&c.path==='/api/study-draft/check').length;
 doc.querySelector('[data-cs=capture]').click();
 await until(()=>captured);
 const post=calls.find(c=>c.method==='POST'&&c.path===CAPTURE);
 assert.deepEqual(plain(post.body.sources),[{sourceId:'src-1',sourceHash:'a'.repeat(64)}],'exactly the eligible ones shown');
 assert.equal(post.body.expectedSourcesHash,null);assert.equal(post.body.bindingId,'root1');assert.equal(post.body.parentStudyId,'s1');assert.match(post.body.operationId,/^[0-9a-f-]{36}$/);
 await until(()=>doc.querySelector('.ck-state[data-kind="ok"]'));
 assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/study-draft/check').length,before+1,'Check ran again by itself, with no press on Check saved draft');
 assert.match(doc.querySelector('.ck-state').textContent,/Mechanical checks complete/,'the real result, not held');
 assert.equal(doc.querySelector('[data-cs-block]'),null,'the list leaves once Check has what it needs');
 assert.match(doc.getElementById('v2-messages').textContent,/Check can now read this/);
});

test('with nothing eligible the held Check gives the list\'s reasons and a way back to the subject, and no button', async()=>{
 const answers=base({'/api/study-draft/check':[200,HELD],[LIST]:listOf([src({eligible:false,confirmedByYou:false,reviewed:false,reason:'Not reviewed yet. Review it before using it for Check.'}),src({id:'src-2',title:'Studio note',kind:'markdown',eligible:false,captured:true,reason:'Already used for Check.'})])});
 const {doc}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 await until(()=>doc.querySelector('[data-cs-block] li'));
 assert.equal(doc.querySelector('[data-cs=capture]'),null);
 assert.match(doc.querySelector('[data-cs-block]').textContent,/Not reviewed yet\. Review it before using it for Check\./);assert.match(doc.querySelector('[data-cs-block]').textContent,/Used for Check/);assert.doesNotMatch(doc.querySelector('[data-cs-block]').textContent,/Already used/);
 assert.equal(doc.querySelector('[data-cs-block] a').getAttribute('href'),'#/subject/s1');assert.equal(doc.querySelector('[data-cs-block] a').textContent,'Back to the subject');
 const none=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,HELD],[LIST]:listOf([])})});await ready(none.doc);
 await until(()=>none.doc.querySelector('[data-cs-block]'));
 assert.match(none.doc.querySelector('[data-cs-block]').textContent,/Nothing is attached to this subject yet/);assert.equal(none.doc.querySelector('[data-cs=capture]'),null);
});

test('a damaged record shows the list\'s sentence and no button', async()=>{
 const sentence='The record of the sources added for Check is damaged, so nothing can be added until it is restored.';
 const {doc}=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,HELD],[LIST]:listOf([],{canCapture:false,damaged:true,reason:sentence})})});await ready(doc);
 await until(()=>doc.querySelector('[data-cs-sentence]'));
 assert.equal(doc.querySelector('[data-cs-sentence]').textContent.trim(),sentence);assert.equal(doc.querySelector('[data-cs=capture]'),null);
});

test('only held-for-want-of-a-source checks offer it: no list is read for a check with no receipt, a finished one or a check held for another reason', async()=>{
 for(const rec of [null,PASSED,receipt({status:'held',issues:[],quote:{status:'held',reason:'Some quotations use marks this check cannot read.'},split:{status:'checked'},proof:{expected:EXPECTED,draftHash:'d1',sources:[{role:'source',id:'x'}]}})]){
  const {doc,calls}=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,rec],[LIST]:listOf([src()])})});await ready(doc);await settle(150);
  assert.equal(doc.querySelector('[data-cs-block]'),null);assert.ok(!calls.some(c=>c.path===LIST),'the list is read only when it is shown');
 }
});

test('on an assistant\'s page the list and button are there, and pressing shows the refusal; nothing is hidden or faked', async()=>{
 const answers=base({'/api/study-draft/check':[200,HELD],[LIST]:listOf([src()]),[CAPTURE]:[403,{error:'Only a human can decide this.'}]});
 const {doc,calls}=await page({hash:'#/check/s1?piece=o1',search:'?reviewActor=agent:codex',answers});await ready(doc);
 await until(()=>doc.querySelector('[data-cs=capture]'));
 doc.querySelector('[data-cs=capture]').click();
 await until(()=>/Only Adrian can decide this/.test(doc.getElementById('v2-messages').textContent));
 assert.match(doc.getElementById('v2-messages').textContent,/Codex can propose it, not do it/);
 assert.ok(doc.querySelector('[data-cs=capture]'),'the button is still there');assert.equal(doc.querySelector('[data-cs-done]'),null,'it does not say Check can read anything');
 assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/study-draft/check').length,0,'a refused capture does not run Check');
});

test('a stale capture is said once and the list is read again', async()=>{
 let n=0;const answers=base({'/api/study-draft/check':[200,HELD],[LIST]:()=>{n++;return listOf([src()]);},[CAPTURE]:[409,{error:'stale'}]});
 const {doc}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 await until(()=>doc.querySelector('[data-cs=capture]'));
 doc.querySelector('[data-cs=capture]').click();
 await until(()=>/changed since it was opened here/.test(doc.getElementById('v2-messages').textContent));
 await until(()=>n>=2&&doc.querySelector('[data-cs=capture]'));
 assert.equal(doc.getElementById('v2-messages').textContent.match(/changed since it was opened here/g).length,1,'said once');
});


// ---- capture sources: Stop using a source, from Check's details and from its held state (stage 7) ----
const STOP='/api/study-draft/capture-sources/stop',HASH='c'.repeat(64);
const used=(extra={})=>src({eligible:false,captured:true,capturedCurrent:true,capturedHash:HASH,reason:'Already used for Check.',...extra});
const stoppedRow=()=>src({eligible:false,captured:false,stopped:true,stoppedAt:'2026-11-12T10:00:00.000Z',reason:'You stopped using this for Check.'});
const STALE=receipt({status:'stale',staleReason:'The source changed.',issues:[]});
const openDetails=async doc=>{const d=await until(()=>doc.querySelector('details.ck-proof'));d.open=true;d.dispatchEvent(new doc.defaultView.Event('toggle'));return d;};

test('Check\'s details carry the Sources block without the capture button, so Stop is reachable when Check is not held; nothing is read until the details are opened', async()=>{
 const answers=base({'/api/study-draft/check':[200,PASSED],[LIST]:listOf([used(),src({id:'src-2',title:'Studio note',kind:'markdown'})],{sourcesHash:'e'.repeat(64),hasQuoteSource:true})});
 const {doc,calls}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);await settle(100);
 assert.equal(doc.querySelector('[data-cs-block]'),null);assert.ok(!calls.some(c=>c.path===LIST),'the list is read only once the details are opened');
 assert.equal(doc.querySelector('details.ck-proof summary').textContent,'Check details and saved proof');
 await openDetails(doc);
 await until(()=>doc.querySelector('details.ck-proof [data-cs-block] [data-cs=stop]'));
 assert.equal(doc.querySelectorAll('[data-cs-block]').length,1);assert.equal(doc.querySelector('[data-cs=capture]'),null,'no capture button inside the details, even with an eligible source');
 const stop=doc.querySelector('[data-cs=stop]');assert.equal(stop.textContent.trim(),'Stop using for Check');assert.ok(stop.classList.contains('v2-ghost'));
 assert.equal(doc.querySelectorAll('[data-cs=stop]').length,1);assert.match(doc.querySelector('[data-cs-block]').textContent,/Used for Check/);
 assert.ok(doc.querySelector('details.ck-proof').open,'the details stay open through repaints');
 assert.equal(doc.querySelector('[data-ck-run] > .subj-cs-block'),null,'one block only, and not in the main area');
});

test('stopping the only source from the details: the press sends what the list read, Check does not run by itself, and Check shows the held state with the block and Use for Check again', async()=>{
 let stopped=false;
 const answers=base({'/api/study-draft/check':(u,body)=>body?PASSED:stopped?STALE:PASSED,[LIST]:()=>listOf([stopped?stoppedRow():used()],{sourcesHash:stopped?'f'.repeat(64):'e'.repeat(64),hasQuoteSource:!stopped}),[STOP]:()=>{stopped=true;return {stopped:[{sourceId:'src-1',copiedHash:HASH}],sourcesHash:'f'.repeat(64)};}});
 const {doc,calls}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 await openDetails(doc);
 const stop=await until(()=>doc.querySelector('[data-cs=stop]'));stop.focus();stop.click();
 await until(()=>stopped);
 const post=calls.find(c=>c.method==='POST'&&c.path===STOP);
 assert.deepEqual(plain({...post.body,operationId:'x'}),{bindingId:'root1',parentStudyId:'s1',expectedSourcesHash:'e'.repeat(64),sourceId:'src-1',copiedHash:HASH,operationId:'x'});assert.match(post.body.operationId,/^[0-9a-f-]{36}$/);
 await until(()=>/Check no longer reads this\./.test(doc.getElementById('v2-messages').textContent));
 await until(()=>/No source to check against yet/.test(doc.querySelector('.ck-state')?.textContent||''));
 assert.match(doc.querySelector('.ck-state').textContent,/Checks held/);assert.doesNotMatch(doc.querySelector('.ck-state').textContent,/Outdated|out of date|changed/i);
 assert.equal(doc.querySelector('.ck-state').dataset.kind,'held');assert.match(doc.querySelector('[data-ck-bar]').textContent,/Checks held/,'the bar agrees');
 const again=await until(()=>doc.querySelector('[data-ck-run] [data-cs-block] [data-cs=again]'));
 assert.equal(again.textContent.trim(),'Use for Check again');assert.match(doc.querySelector('[data-cs-src]').textContent,/Not used for Check\. You stopped it\./);
 assert.equal(doc.querySelector('details.ck-proof [data-cs-block]'),null,'the block is not drawn twice');
 assert.equal(doc.activeElement,again,'focus is not lost');
 assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/study-draft/check').length,0,'a stop does not run Check');
 assert.equal(doc.querySelector('[data-cs=capture]'),null,'the stopped source is not in the bulk press');
});

test('a stop that leaves a source for quotes leaves Check out of date, not held', async()=>{
 let stopped=false;
 const answers=base({'/api/study-draft/check':(u,body)=>body?PASSED:stopped?STALE:PASSED,[LIST]:()=>listOf([stopped?stoppedRow():used(),used({id:'src-2',title:'Studio note',kind:'markdown',capturedHash:'d'.repeat(64)})],{sourcesHash:'e'.repeat(64),hasQuoteSource:true}),[STOP]:()=>{stopped=true;return {sourcesHash:'f'.repeat(64)};}});
 const {doc}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 await openDetails(doc);
 const stop=await until(()=>doc.querySelector('[data-cs=stop]'));stop.click();
 await until(()=>stopped);await until(()=>/Outdated check/.test(doc.querySelector('.ck-state')?.textContent||''));
 assert.doesNotMatch(doc.querySelector('.ck-state').textContent,/No source to check against yet/);
 await until(()=>doc.querySelector('details.ck-proof [data-cs=again]'));assert.equal(doc.querySelectorAll('[data-cs=stop]').length,1,'the other source can still be stopped');
});

test('a check left out of date by a stop made elsewhere opens held when no source is left, and says out of date when one is', async()=>{
 const none=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,STALE],[LIST]:listOf([stoppedRow()],{sourcesHash:'f'.repeat(64),hasQuoteSource:false})})});await ready(none.doc);
 await until(()=>/No source to check against yet/.test(none.doc.querySelector('.ck-state')?.textContent||''));
 assert.ok(none.doc.querySelector('[data-ck-run] [data-cs=again]'));assert.equal(none.doc.querySelector('[data-ck=reload]'),null);
 const some=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,STALE],[LIST]:listOf([used()],{sourcesHash:'e'.repeat(64),hasQuoteSource:true})})});await ready(some.doc);await settle(150);
 assert.match(some.doc.querySelector('.ck-state').textContent,/Outdated check/);
 const damaged=await page({hash:'#/check/s1?piece=o1',answers:base({'/api/study-draft/check':[200,STALE],[LIST]:listOf([],{canCapture:false,damaged:true,reason:'The record is damaged.',hasQuoteSource:false})})});await ready(damaged.doc);await settle(150);
 assert.match(damaged.doc.querySelector('.ck-state').textContent,/Outdated check/,'a damaged record is not "no source"');
});

test('on an assistant\'s page Stop is shown; pressing it shows the server\'s refusal once, the list is not read again and Check does not move', async()=>{
 let lists=0;
 const answers=base({'/api/study-draft/check':[200,PASSED],[LIST]:()=>{lists++;return listOf([used()],{sourcesHash:'e'.repeat(64),hasQuoteSource:true});},[STOP]:[403,{error:'refused'}]});
 const {doc,calls}=await page({hash:'#/check/s1?piece=o1',search:'?reviewActor=agent:codex',answers});await ready(doc);
 await openDetails(doc);
 const stop=await until(()=>doc.querySelector('[data-cs=stop]'));stop.focus();stop.click();
 await until(()=>/Only Adrian can decide this/.test(doc.getElementById('v2-messages').textContent));
 assert.match(doc.getElementById('v2-messages').textContent,/Codex can propose it, not do it/);assert.equal(doc.getElementById('v2-messages').textContent.match(/Only Adrian can decide this/g).length,1);
 await settle(150);assert.equal(lists,1,'the list is read once');assert.ok(doc.querySelector('[data-cs=stop]'),'the control stays');
 assert.match(doc.querySelector('.ck-state').textContent,/Mechanical checks complete/);assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/study-draft/check').length,0);
 assert.equal(doc.activeElement.dataset.cs,'stop','focus stays on the control');
});

test('Use for Check again then Stop: "Check can now read this" is gone from Check after the stop', async()=>{
 let phase='stopped';
 const answers=base({'/api/study-draft/check':(u,body)=>body?PASSED:phase==='used'?PASSED:STALE,[LIST]:()=>listOf([phase==='used'?used():stoppedRow()],{sourcesHash:'e'.repeat(64),hasQuoteSource:phase==='used'}),[STOP]:()=>{phase='stopped';return {stopped:[{sourceId:'src-1',copiedHash:HASH}],sourcesHash:'f'.repeat(64)};},'/api/study-draft/capture-sources':()=>{phase='used';return {captured:[{sourceId:'src-1'}],sourcesHash:'e'.repeat(64)};}});
 const {doc}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 const again=await until(()=>doc.querySelector('[data-ck-run] [data-cs=again]'));again.click();
 await until(()=>phase==='used');await settle(100);await openDetails(doc);
 await until(()=>doc.querySelector('details.ck-proof [data-cs-done]'));
 const stop=await until(()=>doc.querySelector('[data-cs=stop]'));stop.click();
 await until(()=>doc.querySelector('[data-cs=again]')&&/Checks held/.test(doc.querySelector('.ck-state')?.textContent||''));await settle(150);
 assert.equal(doc.querySelector('[data-cs-done]'),null,'nothing says Check can read this after a stop');
});

test('another tab\'s stop reaches Check\'s list through the change stream', async()=>{
 let stopped=false;
 const answers=base({'/api/study-draft/check':[200,STALE],[LIST]:()=>listOf([stopped?stoppedRow():used()],{sourcesHash:'e'.repeat(64),hasQuoteSource:!stopped})});
 const {doc,sources}=await page({hash:'#/check/s1?piece=o1',answers});await ready(doc);
 await openDetails(doc);await until(()=>doc.querySelector('[data-cs=stop]'));
 stopped=true;for(const s of sources)s.emit('change',{kind:'study-draft.capture-sources.stop',cursor:5,bootId:'b',scope:{kind:'draft',id:'root1'}});
 await until(()=>doc.querySelector('[data-cs=again]'));
 assert.match(doc.querySelector('[data-cs-src]').textContent,/Not used for Check\. You stopped it\./);
 await until(()=>/No source to check against yet/.test(doc.querySelector('.ck-state')?.textContent||''));
});
