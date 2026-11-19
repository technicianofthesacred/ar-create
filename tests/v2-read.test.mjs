import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

// Version two's Read: the pure helpers, the screen in a page on stand-in answers, and the same commands against the real
// in-process server (the saved words, a change while open, unsaved words on this device). Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const plain=value=>JSON.parse(JSON.stringify(value));
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await settle(25);}};

const COMMANDS=[['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],['look','GET','/api/look',true],
 ['subject.standing','GET','/api/subject/standing',true],['study.outputs','GET','/api/study/outputs',true],['study-draft.read','GET','/api/study-draft/read',true],['study-draft.save','POST','/api/study-draft/save',false]]
 .map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));
/** The page with every script; fetch answered from a table (route -> body or [status, body]). */
async function page({hash='',answers={},search='',storage={}}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html'+search+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 w.EventSource=class{constructor(){sources.push(this);this.l={};}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push({path:u.pathname,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  const answer=u.pathname==='/api/capabilities'?{commands:COMMANDS}:answers[u.pathname]??{};const [status,body]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){const file=src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src);w.eval(fs.readFileSync(file,'utf8'));}
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await settle(40);
 return {w,calls,sources,doc:w.document};
}
const row=(id,words,extra={})=>({id,blockKind:'paragraph',words,safe:true,blockHash:id.padEnd(64,'0'),...extra});
const window_changes=()=>{const src=read('public/v2/screens/read.js'),m=src.match(/const changesWords=([^\n]*)\n/);return new Function('return '+m[1].replace(/;$/,''))();};
const standing={title:'Invented piece',look:null,forms:[{key:'out:o1',kind:'article',name:'Article',id:'o1',title:'Invented piece'},{key:'ig:p1',kind:'instagram',name:'Carousel',id:'p1',title:'Slides'}],facts:{bindingId:'b1'}};
const draft=(rows,hash='h1')=>({binding:{id:'b1',parentStudyId:'s1'},projection:rows,expected:{workflow:{draft:hash}},history:[]});
const owned={'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]}};

test('the shared helpers Write leaves for Read and Check: locate and bar',async()=>{
 const {w}=await page({answers:{'/api/subject/standing':standing,...owned}});
 const {locate,bar}=w.v2.shared.write;
 assert.equal(typeof locate,'function');assert.equal(typeof bar,'function');
 const found=plain(await locate('s1','o1'));
 assert.deepEqual(Object.keys(found).sort(),['bindingId','form','forms','native','piece','standing','story']);
 assert.equal(found.bindingId,'b1');assert.equal(found.native,true);assert.equal(found.piece,'o1');assert.equal(found.form.key,'out:o1');
 assert.equal(plain(await locate('s1',undefined)).form.id,'o1','no piece named opens the first Article');
 assert.equal(plain(await locate('s1','nope')).form,null,'a piece that is not an Article of the subject is not opened');
});
test('locate says native is false when the words are owned elsewhere',async()=>{
 const {w}=await page({answers:{'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'magazine'}}]}}});
 const found=await w.v2.shared.write.locate('s1','o1');
 assert.equal(found.native,false);assert.equal(found.bindingId,null);
});
test('the bar marks the open mode, links the other two, and keeps the piece tabs in the same mode',async()=>{
 const {w}=await page();
 const forms=standing.forms,form=forms[0];
 for(const mode of ['write','read','check']){
  const html=w.v2.shared.write.bar({id:'s1',forms,form,piece:'o1',mode,right:'<b data-right>R</b>'});
  const host=w.document.createElement('div');host.innerHTML=html;
  assert.equal(host.querySelector('.wr-seg [aria-current]').tagName,'SPAN');assert.equal(host.querySelector('.wr-seg [aria-current]').textContent.toLowerCase(),mode);
  const links=[...host.querySelectorAll('.wr-seg a')].map(a=>a.getAttribute('href')).sort();
  assert.deepEqual(links,['write','read','check'].filter(m=>m!==mode).map(m=>`#/${m}/s1?piece=o1`).sort());
  assert.equal(host.querySelector('.wr-tabs a[aria-current]').getAttribute('href'),`#/${mode}/s1?piece=o1`,'the piece tab keeps him in the same mode');
  assert.match(host.querySelector('.wr-tabs').innerHTML,/#\/subject\/s1\?form=ig%3Ap1/);
  assert.ok(host.querySelector('[data-right]'),'the right side is his to fill');
 }
});

test('pure helpers: the word count and what counts as unsaved words',async()=>{
 const {w}=await page(),{wordCount,countLabel,unsavedIn}=w.v2.shared.read,{rowsOf}=w.v2.shared.write;
 assert.equal(wordCount([{words:'One two  three.'},{words:' '},{words:'Four'}]),4);
 assert.equal(countLabel(1),'1 word');assert.equal(countLabel(1234),'1,234 words');
 const rows=rowsOf({projection:[row('a','One.'),row('b','Two.')]});
 const stash=o=>JSON.stringify({v:2,at:1,draft:'h1',edits:[],added:[],sent:[],base:[],...o});
 assert.equal(unsavedIn(null,rows),false);assert.equal(unsavedIn('not json',rows),false);
 assert.equal(unsavedIn(stash({}),rows),false);
 assert.equal(unsavedIn(stash({edits:[['a','One.','One.']]}),rows),false,'an edit that is what is saved is not unsaved');
 assert.equal(unsavedIn(stash({edits:[['a','One, more.','One.']]}),rows),true);
 assert.equal(unsavedIn(stash({added:[{id:'n',afterId:'b',text:'  '}]}),rows),false);
 assert.equal(unsavedIn(stash({added:[{id:'n',afterId:'b',text:'New.'}]}),rows),true);
});

test('Read shows the saved words as text, with nothing to edit, a word count, and the way back to Write and on to Check',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','First <b>words</b>.'),row('r1','Heading here',{blockKind:'heading',level:2}),row('r2','Second words.')])};
 const {w,doc,calls}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 assert.equal(w.v2.route().id,'read');
 assert.ok(doc.querySelector('.v2-page.wr.rd'),'Read wears Write\'s frame');
 assert.equal(doc.querySelectorAll('textarea,input,[contenteditable]').length,0,'nothing to edit');
 assert.deepEqual([...doc.querySelectorAll('.rd-text > *')].map(n=>n.tagName+':'+n.textContent),['P:First <b>words</b>.','H2:Heading here','P:Second words.']);
 assert.equal(doc.querySelector('.rd-text b'),null,'his words are text, never markup');
 assert.equal(doc.querySelector('.wr-bar .rd-count').textContent,'6 words');
 assert.equal(doc.querySelector('.wr-seg [aria-current]').textContent,'Read');
 assert.equal(doc.querySelector('.rd-edit').getAttribute('href'),'#/write/s1?piece=o1');
 assert.ok([...doc.querySelectorAll('.rd-foot a')].some(a=>a.getAttribute('href')==='#/check/s1?piece=o1'),'on to Check');
 assert.equal(doc.querySelector('.wr-margin,.wr-draft,[data-act]'),null,'no margin, no suggestions, no Undo');
 assert.match(doc.querySelector('.wr-title').textContent,/Invented piece/);
 assert.equal(doc.querySelector('[data-rd-earlier]'),null,'the existing workspace shows no earlier original draft for a piece like this, so Read leaves it out');
 assert.match(doc.querySelector('[data-v2-advanced]').getAttribute('href'),/section=read/);
 assert.deepEqual(calls.filter(c=>c.method!=='GET'&&!/capabilities/.test(c.path)),[],'Read never writes');
});

test('an empty draft says so and leads to Write; a protected placeholder is not counted',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('x','',{safe:false})])};
 const {doc}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 assert.match(doc.querySelector('.rd-empty').textContent,/no saved words yet/);
 assert.equal(doc.querySelector('.rd-foot a').getAttribute('href'),'#/write/s1?piece=o1');
 assert.equal(doc.querySelector('.rd-count').textContent,'');
});

test('words kept in Write on this device are said plainly; Read keeps showing the saved ones',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Saved words.')])};
 const kept=JSON.stringify({v:2,at:1,draft:'h1',edits:[['r0','Saved words, more.','Saved words.']],added:[],sent:[],base:[]});
 const {doc}=await page({hash:'#/read/s1?piece=o1',answers,storage:{'ar-v2-write:b1':kept}});await settle(150);
 assert.equal(doc.querySelector('[data-rd-unsaved]').hidden,false);
 assert.match(doc.querySelector('[data-rd-unsaved]').textContent,/unsaved words in Write on this device/);
 assert.equal(doc.querySelector('.rd-p').textContent,'Saved words.');
 assert.equal(doc.querySelector('[data-rd-unsaved] a').getAttribute('href'),'#/write/s1?piece=o1');
 // an assistant's page never reads his unsaved words as its own
 const asst=await page({hash:'#/read/s1?piece=o1',answers,search:'?reviewActor=agent:claude-code',storage:{'ar-v2-write:b1':kept}});await settle(150);
 assert.equal(asst.doc.querySelector('[data-rd-unsaved]').hidden,true);
});

test('Read sees every version three tab slot for this exact piece and updates after another tab types',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Saved words.')])};
 const {w,doc}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 const key='ar-v3-write:b1:1',kept=JSON.stringify({v:2,edits:[['r0','Newer words.','Saved words.']],added:[]});
 assert.equal(doc.querySelector('[data-rd-unsaved]').hidden,true);
 w.localStorage.setItem('ar-v3-write:another:1',kept);
 w.dispatchEvent(new w.StorageEvent('storage',{key:'ar-v3-write:another:1'}));
 assert.equal(doc.querySelector('[data-rd-unsaved]').hidden,true,'another piece cannot affect this one');
 w.localStorage.setItem(key,kept);
 w.dispatchEvent(new w.StorageEvent('storage',{key}));
 assert.equal(doc.querySelector('[data-rd-unsaved]').hidden,false);
 assert.equal(doc.querySelector('.rd-p').textContent,'Saved words.');
 w.localStorage.removeItem(key);
 w.dispatchEvent(new w.StorageEvent('storage',{key}));
 assert.equal(doc.querySelector('[data-rd-unsaved]').hidden,true);
});

test('when the saved draft changes while Read is open, the new words are shown',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Before.')])};
 const {doc,sources}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 assert.equal(doc.querySelector('.rd-p').textContent,'Before.');
 answers['/api/study-draft/read']=draft([row('r0','After.'),row('r1','And more.')],'h2');
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:9000,bootId:'b',scope:{kind:'draft',id:'b1'},operationId:'elsewhere'});
 await until(()=>doc.querySelectorAll('.rd-p').length===2,3000);
 assert.deepEqual([...doc.querySelectorAll('.rd-p')].map(p=>p.textContent),['After.','And more.']);
 assert.equal(doc.querySelector('.rd-count').textContent,'3 words');
});

test('a change to another piece\'s draft does not make Read read again; a change to this one does',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Before.')])};
 const {doc,sources,calls}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 const reads=()=>calls.filter(c=>c.path==='/api/study-draft/read').length;
 const before=reads();
 answers['/api/study-draft/read']=draft([row('r0','After.')],'h2');
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:9100,bootId:'b',scope:{kind:'draft',id:'other-binding'},operationId:'elsewhere'});
 await settle(600);
 assert.equal(reads(),before,'another draft\'s change is not read');
 assert.equal(doc.querySelector('.rd-p').textContent,'Before.');
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:9101,bootId:'b',scope:{kind:'draft',id:'b1'},operationId:'elsewhere2'});
 await until(()=>doc.querySelector('.rd-p').textContent==='After.',3000);
 assert.equal(reads(),before+1);
});

test('when the newer words cannot be read, Read says so and offers Try again; the old words stay until it works',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Before.')])};
 const {doc,sources}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 assert.equal(doc.querySelector('[data-rd-stale]').hidden,true);
 answers['/api/study-draft/read']=[500,{error:'down'}];
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:9200,bootId:'b',scope:{kind:'draft',id:'b1'},operationId:'x1'});
 await until(()=>!doc.querySelector('[data-rd-stale]').hidden,3000);
 assert.match(doc.querySelector('[data-rd-stale]').textContent,/Newer words exist, but they could not be read/);
 assert.equal(doc.querySelector('.rd-p').textContent,'Before.');
 answers['/api/study-draft/read']=draft([row('r0','After.')],'h2');
 doc.querySelector('[data-rd-retry]').click();
 await until(()=>doc.querySelector('.rd-p').textContent==='After.',3000);
 assert.equal(doc.querySelector('[data-rd-stale]').hidden,true);
});

test('every change to the saved words counts as newer words: save, undo, restore, recover; a check or read does not',()=>{
 const R=window_changes();
 for(const k of ['study-draft.save','study-draft.undo','study-draft.history-restore','study-draft.recover','study-draft.root-recovery.post'])assert.equal(R(k),true,k);
 for(const k of ['study-draft.check.post','study-draft.read','study-draft.inspect.post','study-draft.history-preview','','other.save'])assert.equal(R(k),false,k);
});
test('a failed re-read after an undo says newer words exist',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Before.')])};
 const {doc,sources}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 answers['/api/study-draft/read']=[500,{error:'down'}];
 for(const s of sources)s.emit('change',{kind:'study-draft.undo',cursor:9400,bootId:'b',scope:{kind:'draft',id:'b1'},operationId:'u1'});
 await until(()=>!doc.querySelector('[data-rd-stale]').hidden,3000);
 assert.match(doc.querySelector('[data-rd-stale]').textContent,/Newer words exist/);
});
test('a failed re-read says newer words exist only when a save was announced; otherwise it says the re-read failed',async()=>{
 const answers={'/api/subject/standing':standing,...owned,'/api/study-draft/read':draft([row('r0','Before.')])};
 const {doc,sources}=await page({hash:'#/read/s1?piece=o1',answers});await settle(150);
 answers['/api/study-draft/read']=[500,{error:'down'}];
 for(const s of sources)s.emit('change',{kind:'study-draft.check',cursor:9300,bootId:'b',operationId:'y1'});
 await until(()=>!doc.querySelector('[data-rd-stale]').hidden,3000);
 const said=doc.querySelector('[data-rd-stale]').textContent;
 assert.match(said,/could not be read again/);assert.doesNotMatch(said,/Newer words exist/);
 assert.ok(doc.querySelector('[data-rd-retry]'));
});

test('the page leaves no grey band under a short piece on a phone',()=>{
 const css=read('public/v2/screens/read.css');
 assert.match(css,/@media \(max-width:850px\)\{[^@]*\.rd\.v2-page\{[^}]*background:var\(--(?:paper|surface-card)\)[^}]*min-height:calc\(100dvh - var\(--v2-top\)\)/);
});

test('Edit words is in one place per width: the bar on a computer, under the text on a phone',()=>{
 const css=read('public/v2/screens/read.css');
 assert.match(css,/\.rd \.rd-foot \.rd-edit-foot\{display:none\}/);
 assert.match(css,/@media \(max-width:850px\)\{[^@]*\.rd \.rd-edit\{display:none\}[^@]*\.rd-edit-foot\{display:inline-flex\}/);
});

test('a piece whose words are owned elsewhere says so and offers Advanced; a missing piece is said plainly',async()=>{
 const elsewhere=await page({hash:'#/read/s1?piece=o1',answers:{'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'magazine'}}]}}});await settle(150);
 assert.match(elsewhere.doc.querySelector('.rd-empty').textContent,/not kept where Read can open them/);
 assert.match(elsewhere.doc.querySelector('.rd-foot a').getAttribute('href'),/section=read/);
 assert.equal(elsewhere.calls.filter(c=>c.path==='/api/study-draft/read').length,0);
 const missing=await page({hash:'#/read/s1?piece=nope',answers:{'/api/subject/standing':standing}});await settle(150);
 assert.match(missing.doc.querySelector('.wr-none').textContent,/not one of this subject’s Articles/);
 assert.equal(missing.doc.querySelector('.wr-seg'),null);
});

test('Read is a screen of its own: index.html loads it after write, before check',()=>{
 const html=read('public/v2/index.html');
 assert.ok(html.indexOf('screens/write.js')<html.indexOf('screens/read.js')&&html.indexOf('screens/read.js')<html.indexOf('screens/check.js'));
 assert.ok(html.indexOf('screens/write.css')<html.indexOf('screens/read.css')&&html.indexOf('screens/read.css')<html.indexOf('screens/check.css'));
 const css=read('public/v2/screens/read.css'),js=read('public/v2/screens/read.js');
 for(const rule of css.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(r=>r.split('{')[0].trim()).filter(r=>r&&!r.startsWith('@')))for(const sel of rule.split(','))assert.match(sel.trim(),/^\.rd[\s.\[:]|^\.rd$/,'every rule starts with .rd: '+sel);
 assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b|font-size:\s*\d+px/i,'no hard-coded colour or size');
 assert.doesNotMatch(js+css,/—/,'no em dash');assert.doesNotMatch(js,/\bfetch\s*\(/,'no fetch');
 assert.doesNotMatch(js,/speech|audio|dictat/i);
});

// ---- the same commands against the real server ----
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
   const base='http://127.0.0.1:'+s.address().port;
   await fillDemo(base,{only:['straw-over-the-rows','the-first-cup','circle-of-twelve']});
   return {base};
  }catch(error){await closeWorld();throw error;}
 })();
 return worldPromise;
}
after(async()=>{if(worldPromise)await worldPromise.catch(()=>{});await closeWorld?.();});
const getJSON=async(base,p)=>(await fetch(base+p)).json();
async function subjectOf(base,slug){const st=await getJSON(base,'/api/subject/standing?parentStudyId=demo-'+slug);return {id:'demo-'+slug,binding:st.facts.bindingId,piece:st.forms.find(f=>f.kind==='article').id};}
const draftOf=(base,sub)=>getJSON(base,`/api/study-draft/read?bindingId=${sub.binding}&parentStudyId=${sub.id}`);
async function livePage(base,sub,{search='',seed=null}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#/read/'+sub.id+'?piece='+sub.piece,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.EventSource=class{constructor(){this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href),method=options.method||'GET';calls.push({path:u.pathname,method});
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});const text=await r.text();
  return {ok:r.ok,status:r.status,text:async()=>text};};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('.rd-text')||w.document.querySelector('.wr-none'));
 return {w,doc:w.document,calls,sources};
}

test('real server: Read shows exactly the saved words of a demo piece and sends nothing but reads',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'circle-of-twelve');
 const saved=(await draftOf(base,sub)).projection.filter(r=>r.safe!==false||r.words).map(r=>r.words);
 const {doc,calls}=await livePage(base,sub);
 await until(()=>doc.querySelectorAll('.rd-text > *').length===saved.length);
 assert.deepEqual([...doc.querySelectorAll('.rd-text > *')].map(n=>n.textContent),saved);
 assert.match(doc.querySelector('.rd-count').textContent,/^[\d,]+ words?$/);
 assert.deepEqual(calls.filter(c=>c.method!=='GET'),[],'Read never writes');
 assert.ok(calls.some(c=>c.path==='/api/study-draft/read'));
});

test('real server: a save made elsewhere shows on an open Read, and his unsaved words are said',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup');
 const {w,doc,sources}=await livePage(base,sub);
 const before=[...doc.querySelectorAll('.rd-p')].map(p=>p.textContent);
 const d=await draftOf(base,sub),first=d.projection.find(r=>r.safe!==false&&r.words);
 const res=await fetch(base+'/api/study-draft/save',{method:'POST',headers:{'content-type':'application/json',Origin:base,'X-AR-Actor':'human:adrian','X-AR-Client':'http'},body:JSON.stringify({bindingId:sub.binding,parentStudyId:sub.id,operationId:'11111111-2222-4333-8444-555555555555',expected:d.expected,operations:[{kind:'text',id:first.id,from:0,to:0,insert:'Newly added. ',seenBlockHash:first.blockHash}]})});
 assert.equal(res.status,200,await res.clone().text());
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:7000,bootId:'b',scope:{kind:'draft',id:sub.binding},operationId:'elsewhere'});
 await until(()=>[...doc.querySelectorAll('.rd-text > *')].some(n=>n.textContent.startsWith('Newly added. ')),5000);
 assert.notDeepEqual([...doc.querySelectorAll('.rd-p')].map(p=>p.textContent),before);
 assert.equal(doc.querySelector('[data-rd-unsaved]').hidden,true);
 w.localStorage.setItem('ar-v2-write:'+sub.binding,JSON.stringify({v:2,at:1,draft:'x',edits:[[first.id,'Typed, not saved.',first.words]],added:[],sent:[],base:[]}));
 w.dispatchEvent(new w.Event('storage'));
 await until(()=>!doc.querySelector('[data-rd-unsaved]').hidden,2000);
});

test('real server: an assistant opens Read and sees the same saved words',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const {doc}=await livePage(base,sub,{search:'?reviewActor=agent:claude-code'});
 assert.ok(doc.querySelectorAll('.rd-text > *').length>0);
 assert.equal(doc.querySelector('.rd-foot a')?.getAttribute('href').startsWith('#/write/')||doc.querySelector('.rd-foot a')?.getAttribute('href').startsWith('#/check/'),true);
});
