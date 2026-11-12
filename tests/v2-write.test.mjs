import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

// Version two's Write: the pure steps that turn his words into the operations study-draft.save takes, the screen in a
// page, and the same commands against the real in-process server (a save with the revision he read, a stale save, an
// assistant's 403). Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const plain=value=>JSON.parse(JSON.stringify(value));

/** The page with every script, fetch answered from a table (route -> body or [status, body]). */
async function page({hash='',answers={},search=''}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html'+search+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 const commands=[['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],['look','GET','/api/look',true],
  ['subject.standing','GET','/api/subject/standing',true],['study.outputs','GET','/api/study/outputs',true],['study-draft.read','GET','/api/study-draft/read',true],['study-draft.save','POST','/api/study-draft/save',false],
  ['study-ai.requests','GET','/api/study-ai/requests',true],['study-ai.review','GET','/api/study-ai/review',true],['study-ai.read','GET','/api/study-ai/read',true],['study-ai.accept','POST','/api/study-ai/accept',false],['study-ai.reject','POST','/api/study-ai/reject',false],['study-ai.finish','POST','/api/study-ai/finish',false],['study-draft.undo','POST','/api/study-draft/undo',false],['presence.post','POST','/api/presence',false]]
  .map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push({path:u.pathname,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  const answer=u.pathname==='/api/capabilities'?{commands}:answers[u.pathname]??{};const [status,body]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){const file=src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src);w.eval(fs.readFileSync(file,'utf8'));}
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await settle(40);
 return {w,calls,doc:w.document};
}

const row=(id,words,extra={})=>({id,words,blockKind:'paragraph',safe:true,blockHash:id.padEnd(64,'0'),...extra});

test('the screen is registered at write/:id, in index.html, and the README names the route',()=>{
 const html=read('public/v2/index.html');
 assert.match(html,/<script src="screens\/write\.js"><\/script>/);assert.match(html,/<link rel="stylesheet" href="screens\/write\.css">/);
 assert.match(read('public/v2/README.md'),/`write\/:id`/);
});

test('rowsOf hides an empty protected placeholder and keeps protected words read-only',async()=>{
 const {w}=await page(),{rowsOf}=w.v2.shared.write;
 const rows=rowsOf({projection:[row('a','One.'),row('b','',{safe:false}),row('c','Kept as it is.',{safe:false}),row('d','Head',{blockKind:'heading',level:2})]});
 assert.deepEqual(plain(rows.map(r=>[r.id,r.safe,r.kind])),[['a',true,'paragraph'],['c',false,'paragraph'],['d',true,'heading']]);
});

test('minimalDiff is the smallest change, and buildOps names the passage he saw and where a new paragraph goes',async()=>{
 const {w}=await page(),{minimalDiff,buildOps,rowsOf}=w.v2.shared.write;
 assert.equal(minimalDiff('same','same'),null);
 assert.deepEqual(plain(minimalDiff('The first cup.','The first small cup.')),{from:10,to:10,insert:'small '});
 assert.deepEqual(plain(minimalDiff('abc','')),{from:0,to:3,insert:''});
 const rows=rowsOf({projection:[row('a','One.'),row('b','Two.'),row('c','Three.',{safe:false})]});
 const edits=new Map([['a',{text:'One, changed.',orig:'One.'}],['c',{text:'Never sent.',orig:'Three.'}]]);
 const added=[{id:'n1',afterId:'a',text:'  A new one.  '},{id:'n2',afterId:'n1',text:'Another.'},{id:'n3',afterId:'c',text:''},{id:'n4',afterId:'c',text:'Last.'}];
 const ops=plain(buildOps({rows,edits,added}));
 assert.deepEqual(ops,[
  {kind:'text',id:'a',from:3,to:3,insert:', changed',seenBlockHash:'a'.padEnd(64,'0')},
  {kind:'insert',id:'n1',beforeId:'b',raw:'A new one.'},
  {kind:'insert',id:'n2',beforeId:'b',raw:'Another.'},
  {kind:'insert',id:'n4',beforeId:null,raw:'Last.'},
 ],'a protected passage is never edited, an empty new paragraph is not sent, order follows the page');
});

test('flat keeps a paste in one paragraph; a suggestion is shown only as the proposal owner offers it',async()=>{
 const {w}=await page(),{flat,proposalView}=w.v2.shared.write;
 assert.equal(flat('one\r\ntwo\n\n three'),'one two three');
 const simple=proposalView({id:'p',proposedBy:{actor:'agent:claude-code'}},{status:'pending',replacements:[{id:'a',words:'New.'},{nope:1}]});
 assert.deepEqual(plain(simple),{id:'p',by:'agent:claude-code',purpose:'',instruction:'',replacements:[{id:'a',words:'New.'}],simple:true,reads:false});
 const read=proposalView({id:'q'},{purpose:'scoped-revision',instruction:'Clearer.',replacements:[{id:'a',words:'New.'}]});
 assert.equal(read.simple,false);assert.equal(read.reads,true,'a read-through of a draft is settled with study-ai.finish');
 assert.equal(proposalView({id:'q'},{purpose:'opening-options',replacements:[{id:'a',words:'x'}]}).reads,false,'opening options need a choice and stay in Advanced');
 assert.equal(proposalView({id:'q'},{purpose:'sourced-paragraph',canStandInReview:true,replacements:[{id:'a',words:'x'}]}).reads,false);
});

test('"Saved" reads as the sample does: the time today, the day and time on another day',async()=>{
 const {w}=await page(),{savedLabel}=w.v2.shared.write,now=new Date(2026,10,11,15,0);
 assert.equal(savedLabel(new Date(2026,10,11,13,52).toISOString(),now),'Saved 13:52');
 assert.equal(savedLabel(new Date(2026,10,10,13,52).toISOString(),now),'Saved 10 Nov, 13:52');
 assert.equal(savedLabel('nonsense',now),'Saved');
});

test('an emptied passage becomes a delete, except the one under his caret; it is never sent as an empty text change',async()=>{
 const {w}=await page(),{buildOps,rowsOf}=w.v2.shared.write;
 const rows=rowsOf({projection:[row('a','One.'),row('b','Two.'),row('c','Three.')]});
 const edits=new Map([['a',{text:'  ',orig:'One.'}],['b',{text:'',orig:'Two.'}],['c',{text:'Three, more.',orig:'Three.'}]]);
 assert.deepEqual(plain(buildOps({rows,edits,added:[]})).map(o=>[o.kind,o.id]),[['text','c'],['delete','a'],['delete','b']]);
 assert.deepEqual(plain(buildOps({rows,edits,added:[],hold:'b'})).map(o=>[o.kind,o.id]),[['text','c'],['delete','a']],'the passage he is still in is left until he leaves it');
});

const standing={title:'Invented piece',look:null,forms:[{key:'out:o1',kind:'article',name:'Article',id:'o1',title:'Invented piece'},{key:'ig:p1',kind:'instagram',name:'Carousel',id:'p1',title:'Slides'}],facts:{bindingId:'b1'}};
const draft=(words,hash='h1')=>({binding:{id:'b1',parentStudyId:'s1'},projection:words.map((x,i)=>row('r'+i,x)),expected:{workflow:{draft:hash}},history:[{operationId:'o',state:'committed',modifiedAt:'2026-11-11T10:00:00Z',canUndo:false}]});

test('Write opens the real draft of the piece, with the forms of the subject as tabs and Advanced beside it',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First <b>words</b>.','Second words.']),
  '/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[{id:'author-page:b1',title:'Your page'},{id:'n1',title:'My <i>notes</i>',kind:'note'}]}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 assert.equal(w.v2.route().id,'write');
 doc.querySelector('.wr-bar [data-wr="src"]').click();await settle(100);
 assert.deepEqual([...doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(Boolean),['First <b>words</b>.','Second words.'],'his words are put in as text, never as markup');
 assert.equal(doc.querySelector('.wr-ed:not(:empty)')?.innerHTML.includes('<b>'),false);
 assert.match(doc.querySelector('.wr-title').textContent,/Invented piece/);
 assert.equal(doc.querySelector('.wr-tabs a[aria-current]').textContent,'Article');
 assert.match(doc.querySelector('.wr-tabs').innerHTML,/#\/subject\/s1\?form=ig%3Ap1/,'a Carousel opens on the subject, where its own steps are');
 const advanced=doc.querySelector('[data-v2-advanced]').getAttribute('href');
 assert.match(advanced,/\/document-study\/index\.html\?/);assert.match(advanced,/subject=s1/);assert.match(advanced,/piece=o1/);assert.match(advanced,/section=write/);
 assert.match(doc.querySelector('[data-wr-advanced]').getAttribute('href'),/section=write/);
 assert.match(doc.querySelector('.wr-seg').innerHTML,/href="#\/read\/s1\?piece=o1"/,'Read is a screen of its own now');assert.match(doc.querySelector('.wr-seg').innerHTML,/href="#\/check\/s1\?piece=o1"/);
 assert.equal(doc.querySelector('.wr-seg [aria-current]').textContent,'Write');
 assert.match(doc.querySelector('[data-wr-src]').textContent,/My <i>notes<\/i>/);assert.doesNotMatch(doc.querySelector('[data-wr-src]').innerHTML,/<i>notes/);
 assert.ok(doc.querySelectorAll('[data-v2-notbuilt]').length>=2,'the player, the transcript and the list still to write say they are not built yet');
 assert.ok(!doc.querySelector('[data-wr-src] button[aria-label*="peak"],[data-wr] [class*="mic"]'),'no speech button');
 assert.ok(calls.every(c=>!/speech|dictat/i.test(c.path)));
});

test('typing saves through study-draft.save with the revision he read; a stale save shows both and merges nothing',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.','Second words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const t=doc.querySelector('textarea[data-ed="r0"]');t.value='First words, edited.';t.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match(doc.querySelector('[data-wr-saved]').textContent,/Not saved yet/);
 // the next read the server gives is a newer draft; the save then answers 409
 answers['/api/study-draft/save']=[409,{error:'stale'}];answers['/api/study-draft/read']=draft(['First words changed elsewhere.','Second words.'],'h2');
 await settle(1800);
 const save=calls.find(c=>c.path==='/api/study-draft/save');
 assert.ok(save,'the save was sent');assert.deepEqual(plain(save.body.expected),{workflow:{draft:'h1'}},'the revision he read goes with it');
 assert.equal(save.body.bindingId,'b1');assert.equal(save.body.parentStudyId,'s1');assert.match(save.body.operationId,/^[0-9a-f-]{36}$/);
 assert.deepEqual(plain(save.body.operations.map(o=>o.kind)),['text']);
 const panel=doc.querySelector('[data-wr-conflict]');assert.equal(panel.hidden,false);
 assert.match(panel.textContent,/First words, edited\./);assert.match(panel.textContent,/First words changed elsewhere\./);
 assert.equal(doc.querySelector('textarea[data-ed="r0"]').value,'First words, edited.','his words are left as he typed them');
 assert.ok(panel.querySelector('[data-act="mine"]')&&panel.querySelector('[data-act="theirs"]'),'he chooses');
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/save').length,1,'nothing is sent again until he chooses');
 // he keeps the saved version
 panel.querySelector('[data-act="theirs"]').click();await settle(50);
 assert.equal(doc.querySelector('textarea[data-ed="r0"]').value,'First words changed elsewhere.');assert.equal(panel.hidden,true);
 assert.equal(w.localStorage.getItem('ar-v2-write:b1'),null,'nothing is kept once he chose the saved words');
});

test('unsaved words are kept on this device and come back after a reload',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]},'/api/study-draft/save':[500,{error:'down'}]};
 const first=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const t=first.doc.querySelector('textarea[data-ed="r0"]');t.value='First words, kept safe.';t.dispatchEvent(new first.w.Event('input',{bubbles:true}));
 const kept=JSON.parse(first.w.localStorage.getItem('ar-v2-write:b1'));
 assert.deepEqual(plain(kept.edits),[['r0','First words, kept safe.','First words.']]);assert.equal(kept.draft,'h1');
 // a new page (a reload) with that copy on this device
 const second=await page({hash:'#/write/s1?piece=o1',answers});
 second.w.localStorage.setItem('ar-v2-write:b1',JSON.stringify(kept));
 second.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(30);second.w.location.hash='#/';await settle(30);second.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(200);
 assert.equal(second.doc.querySelector('textarea[data-ed="r0"]').value,'First words, kept safe.');
});

test('an assistant opens the page: the paragraphs are read only, nothing is kept on the device, a decision answers 403 plainly',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),
  '/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]},'/api/study-ai/review':{id:'q1',status:'pending',stale:false,replacements:[{id:'r0',words:'Better words.',before:'First words.'}]},
  '/api/study-ai/read':{sourceCatalog:[]},'/api/study-ai/accept':[403,{error:'This decision is human-only; agent:claude-code may propose but not decide.'}],'/api/study-draft/save':[403,{error:'human-only'}]};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers,search:'?reviewActor=agent:claude-code'});await settle(200);
 assert.match(doc.querySelector('.wr-draft').textContent,/Better words\./,'the proposal shows where the passage is, dim');
 assert.match(doc.querySelector('.wr-note').textContent,/Claude suggests new words/);
 assert.match(doc.querySelector('.wr-ro').textContent,/Opened as Claude\. Only Adrian writes here/);
 doc.querySelector('[data-act="accept"]').click();await settle(120);
 assert.equal(doc.querySelector('#v2-messages').textContent.includes('Only Adrian can decide this. Claude can propose it, not do it.'),true);
 for(const t of doc.querySelectorAll('textarea.wr-ed'))assert.ok(t.readOnly,'every paragraph is read only for an assistant');
 const t=doc.querySelector('textarea[data-ed="r0"]');t.value='Typed by an assistant.';t.dispatchEvent(new w.Event('input',{bubbles:true}));await settle(1800);
 assert.equal(w.localStorage.getItem('ar-v2-write:b1'),null,'an assistant\'s words are not kept on the device');
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/save'||c.path==='/api/presence').length,0,'no save and no presence from an assistant');
});

test('accepting as him uses study-ai.accept and then reads the draft again; Dismiss uses study-ai.reject',async()=>{ const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),
  '/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]},'/api/study-ai/review':{id:'q1',status:'pending',stale:false,replacements:[{id:'r0',words:'Better words.',before:'First words.'}]},
  '/api/study-ai/read':{sourceCatalog:[]},'/api/study-ai/accept':{ok:true},'/api/study-ai/reject':{ok:true}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(200);
 answers['/api/study-draft/read']=draft(['Better words.'],'h2');answers['/api/study-ai/requests']={items:[]};
 doc.querySelector('[data-act="accept"]').click();await settle(200);
 const accept=calls.find(c=>c.path==='/api/study-ai/accept');assert.ok(accept);assert.equal(accept.body.requestId,'q1');
 assert.equal(doc.querySelector('textarea[data-ed="r0"]').value,'Better words.');assert.equal(doc.querySelectorAll('.wr-note').length,0);
 // Dismiss on a second page: study-ai.reject, and the words stay as he wrote them.
 answers['/api/study-draft/read']=draft(['First words.']);answers['/api/study-ai/requests']={items:[{id:'q2',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]};answers['/api/study-ai/review']={id:'q2',status:'pending',stale:false,replacements:[{id:'r0',words:'Other words.',before:'First words.'}]};
 const second=await page({hash:'#/write/s1?piece=o1',answers});await settle(200);
 answers['/api/study-ai/requests']={items:[]};
 second.doc.querySelector('[data-act="reject"]').click();await settle(200);
 const reject=second.calls.find(c=>c.path==='/api/study-ai/reject');assert.ok(reject);assert.equal(reject.body.requestId,'q2');
 assert.equal(second.doc.querySelector('textarea[data-ed="r0"]').value,'First words.');
});

// ---- the same commands against the real server ----
function clientModule(){const ctx={URLSearchParams,URL,JSON,Error,Promise,setTimeout,clearTimeout,console,crypto:globalThis.crypto,AbortSignal,module:{exports:{}}};ctx.globalThis=ctx;vm.runInNewContext(read('public/v2/shell/client.js'),ctx);return ctx.module.exports;}
async function server(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 return {url:'http://127.0.0.1:'+s.address().port};
}
const pageClient=(url,search='')=>clientModule().createClient({base:url,search,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:url}:{})}})});

test('against the server: the operations Write builds are saved, a stale revision is refused, an assistant gets 403',async t=>{
 const f=await server(t),adrian=pageClient(f.url);
 const root=await adrian.call('study-draft.create-collection',{parentStudyId:'invented-write-test',title:'Invented piece for Write'});
 const scope={bindingId:root.bindingId||root.binding?.id,parentStudyId:'invented-write-test'};
 assert.ok(scope.bindingId,'a new collection has its own draft');
 const {w}=await page(),{rowsOf,buildOps}=w.v2.shared.write;
 // the first words are a new paragraph
 const empty=await adrian.call('study-draft.read',scope);
 const firstOps=plain(buildOps({rows:rowsOf(empty),edits:new Map(),added:[{id:'11111111-1111-4111-8111-111111111111',afterId:null,text:'The first paragraph from the screen.'}]}));
 const first=await adrian.call('study-draft.save',{...scope,expected:empty.expected,operations:firstOps});
 const rows=rowsOf(first),target=rows.find(r=>r.id==='11111111-1111-4111-8111-111111111111');
 assert.equal(target?.words,'The first paragraph from the screen.','the new paragraph is in the draft under the id the screen gave it');
 // then an edit of it, with the revision he read
 const edits=new Map([[target.id,{text:target.words+' Added by the screen.',orig:target.words}]]);
 const ops=plain(buildOps({rows,edits,added:[]}));
 const saved=await adrian.call('study-draft.save',{...scope,expected:first.expected,operations:ops});
 const again=rowsOf(saved);
 assert.equal(again.find(r=>r.id===target.id).words,target.words+' Added by the screen.','his words are in the draft');
 // the revision he read is no longer current
 await assert.rejects(adrian.call('study-draft.save',{...scope,expected:first.expected,operations:ops}),e=>e.kind==='stale'&&e.status===409);
 // an assistant may read but not write his words
 const codex=pageClient(f.url,'?reviewActor=agent:codex');
 await assert.rejects(codex.call('study-draft.save',{...scope,expected:saved.expected,operations:[]}),e=>e.kind==='owner-only'&&e.message==='Only Adrian can decide this. Codex can propose it, not do it.');
 await assert.rejects(codex.call('study-ai.accept',{...scope,requestId:'22222222-2222-4222-8222-222222222222'}),e=>e.kind==='owner-only');
 const list=await adrian.call('study-ai.requests',scope);assert.deepEqual(plain(list.items),[],'no suggestion yet');
});

test('Write follows the house rules: six sizes, no em dash, no fetch, escaped records, no speech',()=>{
 const css=read('public/v2/screens/write.css'),js=read('public/v2/screens/write.js');
 const sizes=new Set([...css.matchAll(/font:\s*(?:italic\s+)?\d{3}\s+(\d+(?:\.\d+)?px)/g)].map(m=>m[1]));
 assert.deepEqual([...sizes],[],'every size is a --v2-t token');
 for(const m of css.matchAll(/font-size:\s*([^;}]+)/g))assert.match(m[1],/^var\(--v2-t(12|13|14|15|18|22)\)$/,m[0]);
 for(const m of css.matchAll(/font:[^;}]*?(var\(--v2-t\d+\))/g))assert.match(m[1],/--v2-t(12|13|14|15|18|22)\)/);
 assert.doesNotMatch(css+js,/\u2014/,'no em dash');
 assert.doesNotMatch(js,/\bfetch\s*\(/,'a command is never fetched');
 assert.doesNotMatch(js,/SpeechRecognition|webkitSpeech|getUserMedia/,'no speech');
 assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'only the app\'s colour tokens');
});

test('the bar stays on one row from 320 wide: the 380 block keeps the tabs and the buttons from wrapping',()=>{
 const css=read('public/v2/screens/write.css'),block=css.slice(css.indexOf('@media (max-width:380px)'));
 assert.match(block,/\.wr \.wr-bar\{[^}]*flex-wrap:nowrap/);assert.match(block,/\.wr \.wr-tabs\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/);
 assert.match(block,/\.wr \.wr-tabs a\{[^}]*flex:none/,'a tab keeps its readable width');
 assert.doesNotMatch(block,/\.wr \.wr-tabs\{[^}]*overflow:hidden/);
 assert.match(block,/\.wr \.wr-tabs a:focus-visible\{outline-offset:-2px/,'the focus ring stays inside the tab');
});

// ---- corrections after review: stub pages for what only the screen decides ----
test('a 409 is a newer version only when the saved revision differs; otherwise the server\'s own words are shown',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.','Second words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 answers['/api/study-draft/save']=[409,{error:'Edit would create unsupported or unbalanced source syntax or change block kind.'}];
 const t=doc.querySelector('textarea[data-ed="r0"]');t.value='First words, changed.';t.dispatchEvent(new w.Event('input',{bubbles:true}));
 t.dispatchEvent(new w.Event('focusout',{bubbles:true}));await settle(150);
 assert.equal(doc.querySelector('[data-wr-conflict]').hidden,true,'the revision did not change, so there is no newer version to choose');
 assert.match(doc.querySelector('.wr-bar [data-wr-saved]').textContent,/Edit would create unsupported/);
 assert.equal(doc.querySelector('textarea[data-ed="r0"]').value,'First words, changed.','his words stay');
});

test('a piece of another subject, or one that does not exist, says so plainly and opens nothing else',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[]},'/api/study-draft/read':draft(['First words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}};
 const {doc,calls}=await page({hash:'#/write/s1?piece=not-a-piece',answers});await settle(150);
 assert.match(doc.querySelector('.wr-none').textContent,/not one of this subject’s Articles/);
 assert.equal(doc.querySelectorAll('textarea').length,0,'the first Article is not quietly opened');
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/read').length,0);
 const other=await page({hash:'#/write/s1?piece=p1',answers});await settle(150);
 assert.match(other.doc.querySelector('.wr-none').textContent,/not one of this subject’s Articles/,'a Carousel is not an Article either');
});

test('two Articles of one subject are told apart in the tabs by their titles; one Article stays "Article"',async()=>{
 const two={...standing,forms:[{key:'out:o1',kind:'article',name:'Article',id:'o1',title:'The first piece'},{key:'out:o2',kind:'article',name:'Article',id:'o2',title:'The second piece'},{key:'out:o3',kind:'article',name:'Article',id:'o3',title:'The second piece'}]};
 const answers={'/api/subject/standing':two,'/api/study/outputs':{outputBindings:[{outputId:'o2',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['Words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}};
 const {doc}=await page({hash:'#/write/s1?piece=o2',answers});await settle(150);
 assert.deepEqual([...doc.querySelectorAll('.wr-tabs a:not([aria-label])')].map(a=>a.textContent),['The first piece','The second piece','The second piece (2)']);
 assert.equal(doc.querySelector('.wr-tabs a[aria-current]').textContent,'The second piece');
});

test('a read-through of several paragraphs: Not me under one leaves only it out; the choice goes to study-ai.finish; Not me on the card leaves all out',async()=>{
 const base={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['One.','Two.','Three.']),
  '/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,purpose:'article-draft',proposedBy:{actor:'agent:claude-code'}}]},
  '/api/study-ai/review':{id:'q1',status:'pending',stale:false,purpose:'article-draft',instruction:'Tighten it <b>up</b>.',replacements:[{id:'r0',words:'One, better.',before:'One.'},{id:'r1',words:'Two, better.',before:'Two.'}]},
  '/api/study-ai/read':{sourceCatalog:[]},'/api/study-ai/finish':{readThrough:{}}};
 const first=await page({hash:'#/write/s1?piece=o1',answers:{...base}});await settle(200);
 const {doc,calls}=first;
 assert.match(doc.querySelector('.wr-note').textContent,/Asked: Tighten it <b>up<\/b>\./,'the instruction is shown as text');
 assert.equal(doc.querySelectorAll('.wr-draft').length,2);
 assert.match(doc.querySelector('[data-act="finish"]').textContent,/Rewrite it as mine/);assert.match(doc.querySelector('[data-act="leave"]').textContent,/Not me/);
 doc.querySelector('.wr-mark[data-rid="r1"]').click();
 assert.equal(doc.querySelector('.wr-mark[data-rid="r1"]').getAttribute('aria-pressed'),'true');
 doc.querySelector('[data-act="finish"]').click();await settle(200);
 const done=calls.find(c=>c.path==='/api/study-ai/finish');
 assert.equal(done.body.requestId,'q1');assert.match(done.body.operationId,/^[0-9a-f-]{36}$/);assert.deepEqual(plain(done.body.marks),[{id:'r1'}]);assert.equal('edits' in done.body,false);
 const second=await page({hash:'#/write/s1?piece=o1',answers:{...base}});await settle(200);
 second.doc.querySelector('[data-act="leave"]').click();await settle(200);
 const left=second.calls.find(c=>c.path==='/api/study-ai/finish');assert.deepEqual(plain(left.body.marks),[{id:'r0'},{id:'r1'}]);
});

// ---- corrections after review: the real server, a real page ----
let world=null;
async function theWorld(){
 if(world)return world;
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+s.address().port;
 await fillDemo(base,{only:['straw-over-the-rows','the-first-cup','studio-after-rain','circle-of-twelve','ink-on-warm-paper','shade-and-patience','small-paintings-of-doors']});
 world={base,close:async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}};
 return world;
}
after(async()=>{if(world)await world.close();});
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error("timed out");await settle(25);}};
const getJSON=async(base,p)=>(await fetch(base+p)).json();
const subjectOf=async(base,slug)=>{const st=await getJSON(base,'/api/subject/standing?parentStudyId=demo-'+slug);return {id:'demo-'+slug,binding:st.facts.bindingId,piece:st.forms.find(f=>f.kind==='article').id,title:st.title};};
const draftOf=(base,sub)=>getJSON(base,`/api/study-draft/read?bindingId=${sub.binding}&parentStudyId=${sub.id}`);
const wordsOf=d=>d.projection.filter(r=>r.safe!==false||r.words).map(r=>r.words);

/** The real page on the real server. slowSave holds the save's answer back so he can keep typing while it is in flight. */
async function livePage(base,sub,{search='',slowSave=0,lateSave=0,delay=null,seed=null}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#/write/'+sub.id+'?piece='+sub.piece,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.EventSource=class{constructor(u){this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  const isSave=u.pathname==='/api/study-draft/save';
  if(lateSave&&isSave)await settle(lateSave);// held back before it reaches the server
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  const text=await r.text();entry.status=r.status;
  if(slowSave&&isSave)await settle(slowSave);// the server has it; the answer is held back
  const extra=delay?delay(u.pathname,method):0;if(extra)await settle(extra);
  entry.answered=Date.now();
  return {ok:r.ok,status:r.status,text:async()=>text};
 };
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('textarea.wr-ed')||w.document.querySelector('.wr-none'));
 return {w,doc:w.document,calls,sources};
}
const type=(w,el,value)=>{el.focus();el.value=value;el.setSelectionRange(value.length,value.length);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const blur=(w,el)=>el.dispatchEvent(new w.Event('focusout',{bubbles:true}));
const savedSaying=doc=>doc.querySelector('.wr-bar [data-wr-saved]').textContent;
const quiet=doc=>until(()=>/^Saved/.test(savedSaying(doc)));
/** What a reload does to a page: only what is kept on the device stays. The old page's save is still on its way. */
async function reload(old,base,sub,opts={}){
 const seed={};for(let i=0;i<old.w.localStorage.length;i++){const k=old.w.localStorage.key(i);seed[k]=old.w.localStorage.getItem(k);}
 old.w.close();return livePage(base,sub,{...opts,seed});
}
const edsOf=doc=>[...doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(Boolean);
/** After a reload: wait out the five-second retry, then the page, the server and the device must agree, with no complaint. */
async function agree(pg,base,sub,wait=6500){
 await settle(500);
 assert.equal(pg.doc.querySelector('[data-wr-conflict]').hidden,true,'his own save is not a newer version');
 await until(()=>/^Saved/.test(savedSaying(pg.doc)),30000);await settle(wait);
 await until(()=>/^Saved/.test(savedSaying(pg.doc)),30000);
 assert.equal(pg.doc.querySelector('[data-wr-conflict]').hidden,true);
 assert.deepEqual(pg.calls.filter(c=>c.method==='POST'&&c.status>=400).map(c=>c.status),[],'no refused save');
 assert.doesNotMatch(savedSaying(pg.doc),/Could not|Not saved/);
 const server=wordsOf(await draftOf(base,sub));
 assert.deepEqual(edsOf(pg.doc),server,'the page is what the server holds');
 assert.equal(pg.w.localStorage.getItem('ar-v2-write:'+sub.binding),null,'nothing is left waiting on the device');
 return server;
}
const key=(w,binding)=>JSON.parse(w.localStorage.getItem('ar-v2-write:'+binding)||'null');

test('real server: words typed into a new paragraph, and into a saved one, while a save is in flight are never lost',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const {w,doc}=await livePage(base,sub,{slowSave:500});
 const tail=[...doc.querySelectorAll('textarea.wr-ed')].at(-1),first=doc.querySelector('textarea.wr-ed');
 const keep=first.value;
 type(w,tail,'A new closing paragraph, begun');blur(w,tail);// the first save is now in flight (its answer is held back)
 await settle(120);
 let typed='A new closing paragraph, begun';
 for(const word of [' and then','  carried on',' while it was saving',' and again']){typed+=word;type(w,tail,typed);await settle(40);}
 type(w,first,keep+' (edited while saving)');
 await settle(900);
 await until(()=>/^Saved/.test(savedSaying(doc))&&!doc.querySelector('[data-wr-conflict]:not([hidden])'),30000);
 await settle(2200);await until(()=>/^Saved/.test(savedSaying(doc)),30000);
 const server=wordsOf(await draftOf(base,sub));
 assert.ok(server.includes(typed),'every character he typed into the new paragraph is on the server: '+JSON.stringify(server.at(-1)));
 assert.equal(server[0],keep+' (edited while saving)','and into the saved paragraph');
 assert.ok([...doc.querySelectorAll('textarea.wr-ed')].some(t=>t.value===typed),'and still on the page');
 assert.equal(w.localStorage.getItem('ar-v2-write:'+sub.binding),null,'nothing waits on the device once it is all saved');
});

test('real server: a change from the stream that arrives while a save is running is shown after the save',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup');
 const {w,doc,sources}=await livePage(base,sub,{slowSave:600});
 const tail=[...doc.querySelectorAll('textarea.wr-ed')].at(-1);
 type(w,tail,'Closing words from the screen.');blur(w,tail);
 await settle(100);
 // another window of his saves paragraph 2 while the first save's answer is still on its way
 const adrian=clientModule().createClient({base,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:base}:{})}})});
 const mid=await adrian.call('study-draft.read',{bindingId:sub.binding,parentStudyId:sub.id});
 const target=mid.projection.find(r=>r.safe!==false&&r.words);
 await adrian.call('study-draft.save',{bindingId:sub.binding,parentStudyId:sub.id,expected:mid.expected,operations:[{kind:'text',id:target.id,from:0,to:0,insert:'Elsewhere: ',seenBlockHash:target.blockHash}]});
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:5000,bootId:'b',scope:{kind:'draft',id:sub.binding},operationId:'elsewhere-1'});
 await until(()=>doc.querySelector(`textarea[data-ed="${target.id}"]`)?.value.startsWith('Elsewhere: '),20000);
});

test('real server: presence tells an assistant he has unsaved words, and only while he has them',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'studio-after-rain');
 const {w,doc,calls}=await livePage(base,sub);
 const seen=()=>getJSON(base,`/api/presence?kind=draft&id=${sub.binding}`).then(r=>r.presence.map(p=>[p.actor,p.dirty,p.stage]));
 assert.deepEqual(await seen(),[],'nothing to say before he has typed');
 const t=doc.querySelector('textarea.wr-ed');type(w,t,t.value+' more');
 await until(async()=>calls.some(c=>c.path==='/api/presence'));await settle(200);
 assert.deepEqual(await seen(),[['human:adrian',true,'Write']],'Adrian has unsaved words open');
 assert.equal(calls.filter(c=>c.path==='/api/presence').every(c=>!('operationId' in c.body)),true);
 blur(w,t);await quiet(doc);await settle(300);
 assert.deepEqual(await seen(),[['human:adrian',false,'Write']],'saved, so no longer unsaved');
});

test('real server: an assistant\'s page never types, saves, keeps or restores words as his',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'circle-of-twelve');
 const before=wordsOf(await draftOf(base,sub));
 // his kept words, on this device, under his key: an assistant opening the page must not restore, show or save them
 const kept=JSON.stringify({v:1,at:Date.now(),draft:'x',edits:[],added:[{id:'55555555-5555-4555-8555-555555555555',afterId:null,text:'Kept for Adrian only.'}]});
 const agent=await livePage(base,sub,{search:'?reviewActor=agent:codex',seed:{['ar-v2-write:'+sub.binding]:kept}});
 for(const t of agent.doc.querySelectorAll('textarea.wr-ed'))assert.ok(t.readOnly);
 assert.equal([...agent.doc.querySelectorAll('textarea.wr-ed')].some(t=>/Kept for Adrian only/.test(t.value)),false,'not shown');
 assert.doesNotMatch(agent.doc.body.textContent,/unsaved words from earlier|Kept for Adrian only/);
 const t=agent.doc.querySelector('textarea.wr-ed');type(agent.w,t,'Typed anyway.');blur(agent.w,t);await settle(2500);
 assert.equal(agent.calls.filter(c=>c.method==='POST'&&/study-draft\/save|presence/.test(c.path)).length,0,'not saved, not reported');
 assert.equal(agent.w.localStorage.getItem('ar-v2-write:'+sub.binding),kept,'his kept words are untouched, not removed and not rewritten');
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'the draft is as it was');
 // and an assistant\'s own typing leaves nothing on the device
 const bare=await livePage(base,sub,{search:'?reviewActor=agent:codex'});
 const u=bare.doc.querySelector('textarea.wr-ed');type(bare.w,u,'Typed anyway.');blur(bare.w,u);await settle(500);
 assert.equal(bare.w.localStorage.getItem('ar-v2-write:'+sub.binding),null);assert.equal(bare.w.localStorage.length,0);
 // then he opens it: his words come back, as his
 const he=await livePage(base,sub,{seed:{['ar-v2-write:'+sub.binding]:kept}});
 assert.ok(edsOf(he.doc).includes('Kept for Adrian only.'),'for him they are restored');
 he.w.localStorage.removeItem('ar-v2-write:'+sub.binding);
});

test('real server: Backspace joins two paragraphs and an emptied paragraph is deleted, each with an Undo that takes back that change',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup');
 const {w,doc}=await livePage(base,sub);
 const before=wordsOf(await draftOf(base,sub));
 const eds=()=>[...doc.querySelectorAll('textarea.wr-ed')].filter(t=>t.value);
 const second=eds()[1];second.focus();second.setSelectionRange(0,0);
 second.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length-1,20000);
 const joined=wordsOf(await draftOf(base,sub));
 assert.ok(joined[0].startsWith(before[0])&&joined[0].endsWith(before[1].trim().slice(-12)),'the second paragraph is joined onto the first');
 const undo=await until(()=>doc.querySelector('#v2-messages button:not([aria-label])'));
 assert.match(doc.querySelector('#v2-messages').textContent,/Joined two paragraphs/);
 undo.click();
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length,20000);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'Undo took back that join');
 // an emptied paragraph is deleted when he leaves it
 await until(()=>eds().length>=3);
 const third=eds()[2];type(w,third,'');blur(w,third);
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length-1,20000);
 assert.equal(wordsOf(await draftOf(base,sub)).includes(before[2]),false);
 assert.match(await until(()=>doc.querySelector('#v2-messages')?.textContent.match(/Paragraph deleted/)?.[0]),/Paragraph deleted/);
});

test('real server: a whole-draft suggestion is settled with study-ai.finish; Undo takes back that one; an assistant gets 403',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'ink-on-warm-paper');
 const before=wordsOf(await draftOf(base,sub));
 const agent=await livePage(base,sub,{search:'?reviewActor=agent:codex'});
 await until(()=>agent.doc.querySelector('[data-act="finish"]'));
 agent.doc.querySelector('[data-act="finish"]').click();
 await until(()=>/Only Adrian can decide this/.test(agent.doc.querySelector('#v2-messages').textContent));
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'nothing changed');
 const {w,doc,calls}=await livePage(base,sub);
 await until(()=>doc.querySelector('[data-act="finish"]'));
 assert.match(doc.querySelector('.wr-draft').textContent,/It began with something small/);
 doc.querySelector('[data-act="finish"]').click();
 const undo=await until(()=>doc.querySelector('#v2-messages button:not([aria-label])'));
 const finish=calls.find(c=>c.path==='/api/study-ai/finish');assert.ok(finish);
 const after=wordsOf(await draftOf(base,sub));
 assert.match(after[0],/^It began with something small/,'his draft has the words, because he pressed it');
 undo.click();
 await until(async()=>wordsOf(await draftOf(base,sub))[0]===before[0],20000);
 assert.equal(doc.querySelectorAll('[data-act="finish"]').length,0,'a decided suggestion is not offered again');
});

// ---- second corrections: a reload or more typing while a save is on its way ----
const press=(w,el,k)=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
const savedOnServer=(pg,n=1)=>until(()=>pg.calls.filter(c=>c.path==='/api/study-draft/save'&&c.status===200).length>=n,20000);
const longRows=doc=>[...doc.querySelectorAll('textarea.wr-ed')].filter(t=>t.value.length>30);

test('real server: reload while a new paragraph is being saved keeps every word, once, with no refused save',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'shade-and-patience');
 const a=await livePage(base,sub,{slowSave:3000});
 const tail=[...a.doc.querySelectorAll('textarea.wr-ed')].at(-1),first='A closing paragraph written for the reload test';
 type(a.w,tail,first);blur(a.w,tail);await savedOnServer(a);// the server has it; the answer is on its way
 type(a.w,tail,first+', and these words were typed during that save');
 assert.ok(key(a.w,sub.binding)?.sent?.length,'what is in flight is kept with his words');
 const b=await reload(a,base,sub);
 const server=await agree(b,base,sub);
 assert.equal(server.filter(x=>x.startsWith(first)).length,1,'once, not twice');
 assert.equal(server.at(-1),first+', and these words were typed during that save');
});

test('real server: reload while a save has not yet reached the server also loses and doubles nothing',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const before=wordsOf(await draftOf(base,sub));
 const a=await livePage(base,sub,{lateSave:2500});
 const tail=[...a.doc.querySelectorAll('textarea.wr-ed')].at(-1),first='Another closing paragraph, for the held-back save';
 type(a.w,tail,first);blur(a.w,tail);await settle(300);
 const b=await reload(a,base,sub);
 const server=await agree(b,base,sub);
 assert.equal(server.filter(x=>x===first).length,1);assert.equal(server.length,before.length+1);
});

test('real server: reload during a split, a join and a delete shows his own save as his own',{timeout:180000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'small-paintings-of-doors');
 // split
 let a=await livePage(base,sub,{slowSave:3000});
 let rows=longRows(a.doc),target=rows[0],text=target.value,at=Math.floor(text.indexOf(' ',text.length/2));
 target.focus();target.setSelectionRange(at,at);press(a.w,target,'Enter');await savedOnServer(a);
 let b=await reload(a,base,sub);
 let server=await agree(b,base,sub,2500);
 assert.ok(server.includes(text.slice(0,at))&&server.includes(text.slice(at).trim()),'the split is there, once: '+JSON.stringify(server.slice(0,3)));
 // join: Backspace at the start of the second half
 a=await livePage(base,sub,{slowSave:3000});
 const right=[...a.doc.querySelectorAll('textarea.wr-ed')].find(x=>x.value===text.slice(at).trim());
 right.focus();right.setSelectionRange(0,0);press(a.w,right,'Backspace');await savedOnServer(a);
 b=await reload(a,base,sub);
 server=await agree(b,base,sub,2500);
 assert.equal(server.filter(x=>x.startsWith(text.slice(0,at))&&x.endsWith(text.slice(at).trim())).length,1,'the join is there, once: '+JSON.stringify(server.slice(0,3)));
 assert.equal(server.includes(text.slice(at).trim()),false);
 // delete
 a=await livePage(base,sub,{slowSave:3000});
 const gone=[...a.doc.querySelectorAll('textarea.wr-ed')].filter(x=>x.value).at(-1),goneText=gone.value;
 type(a.w,gone,'');blur(a.w,gone);await savedOnServer(a);
 b=await reload(a,base,sub);
 server=await agree(b,base,sub,2500);
 assert.equal(server.includes(goneText),false,'the deleted paragraph stays deleted and is not brought back');
});

test('real server: typing while a split or a join is being saved carries onto the new paragraphs, nothing lost or doubled',{timeout:180000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'studio-after-rain');
 const a=await livePage(base,sub,{slowSave:1500});
 const target=longRows(a.doc)[0],text=target.value,at=text.indexOf(' ',Math.floor(text.length/2));
 const L=text.slice(0,at),R=text.slice(at).trim();
 target.focus();target.setSelectionRange(at,at);press(a.w,target,'Enter');await savedOnServer(a);
 // the break is on the page at once and the caret is in the new paragraph: he keeps typing there while the split is saved
 assert.ok(edsOf(a.doc).includes(L)&&edsOf(a.doc).includes(R),'both halves are on the page at once');
 const nb=a.doc.activeElement;assert.equal(nb.value,R);assert.equal(nb.selectionStart,0,'the caret is at the start of the new paragraph');
 type(a.w,nb,'TYPED '+R);nb.setSelectionRange(6,6);
 await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
 let server=wordsOf(await draftOf(base,sub));
 assert.equal(server.filter(x=>x.includes('TYPED')).length,1,'typed once');
 assert.ok(server.includes(L),'the left half is as it was');assert.ok(server.includes('TYPED '+R),'what he typed at the caret goes with the new paragraph');
 assert.deepEqual(edsOf(a.doc),server);assert.equal(a.w.localStorage.getItem('ar-v2-write:'+sub.binding),null);
 // typing into the left half while the next split is saved
 const t2=longRows(a.doc).find(x=>x.value!==L&&x.value!=='TYPED '+R&&x.value.length>30);
 if(t2){
  const T=t2.value,cut=T.indexOf(' ',Math.floor(T.length/2));
  t2.focus();t2.setSelectionRange(cut,cut);press(a.w,t2,'Enter');await savedOnServer(a,2);
  const left=[...a.doc.querySelectorAll('textarea.wr-ed')].find(x=>x.value===T.slice(0,cut));assert.ok(left,'the left half is on the page at once');
  type(a.w,left,'AA '+T.slice(0,cut));
  await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
  server=wordsOf(await draftOf(base,sub));
  assert.ok(server.includes('AA '+T.slice(0,cut)),'typed before the split point stays in the left half');assert.ok(server.includes(T.slice(cut).trim()));
  assert.equal(server.filter(x=>x.includes('AA ')).length,1);assert.deepEqual(edsOf(a.doc),server);
 }
 // a join while he types in the joined paragraph
 const rows=longRows(a.doc),left=rows[0],right=rows[1];
 const lw=left.value,rw=right.value;
 right.focus();right.setSelectionRange(0,0);press(a.w,right,'Backspace');await savedOnServer(a,3);
 assert.ok(edsOf(a.doc).includes(lw+' '+rw),'the joined paragraph is on the page at once');
 const joined=a.doc.activeElement;assert.equal(joined.value,lw+' '+rw);
 type(a.w,joined,lw+' '+rw+' LEFTMORE');
 await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
 server=wordsOf(await draftOf(base,sub));
 assert.equal(server.filter(x=>x.includes('LEFTMORE')).length,1);
 assert.equal(server.filter(x=>x.includes(lw)).length,1,'the left words are not doubled');assert.equal(server.filter(x=>x.includes(rw)).length,1,'nor the right');
 assert.deepEqual(edsOf(a.doc),server);
});

test('real server: a read that was started before a save is never taken for a newer version, and one that lands during a save is shown after it',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'circle-of-twelve');
 let readHold=0;
 const a=await livePage(base,sub,{delay:(p,m)=>p==='/api/study-draft/read'&&m==='GET'?readHold:0});
 // a read of the old draft is on its way (slow) when his save is made and finished
 readHold=1800;
 for(const s of a.sources)s.emit('change',{kind:'study-draft.save',cursor:6000,bootId:'b',scope:{kind:'draft',id:sub.binding},operationId:'elsewhere-2'});
 await settle(500);readHold=0;
 const first=a.doc.querySelector('textarea.wr-ed'),words=first.value+' (changed after the read began)';
 type(a.w,first,words);blur(a.w,first);await quiet(a.doc);
 await settle(2600);// the old read lands
 assert.equal(a.doc.querySelector('[data-wr-conflict]').hidden,true,'it is not a newer version');
 assert.equal(a.doc.querySelector('textarea.wr-ed').value,words,'his saved words are not put back to the old ones');
 assert.equal(wordsOf(await draftOf(base,sub))[0],words);
 // a change from the stream that arrives while a save is running is read once the save is over
 const b=await livePage(base,sub,{slowSave:900,delay:(p,m)=>p==='/api/study-draft/read'&&m==='GET'?readHold:0});
 const reads=()=>b.calls.filter(c=>c.path==='/api/study-draft/read').length,n0=reads();
 readHold=500;
 for(const s of b.sources)s.emit('change',{kind:'study-draft.save',cursor:6100,bootId:'b',scope:{kind:'draft',id:sub.binding},operationId:'elsewhere-3'});
 await settle(300);readHold=0;
 const f2=b.doc.querySelector('textarea.wr-ed');type(b.w,f2,f2.value+' more');blur(b.w,f2);// the save starts while that read is running
 await savedOnServer(b);const answered=Date.now();
 await until(()=>b.calls.some(c=>c.path==='/api/study-draft/read'&&c.method==='GET'&&c.answered>answered-50&&c.answered>b.calls.find(x=>x.path==='/api/study-draft/save').answered-1),20000);
 await quiet(b.doc);assert.ok(reads()>n0+1,'it was read again after the save');
});

test('real server: the newer-version box shows the saved version\'s changed paragraphs beside his',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'shade-and-patience');
 const {w,doc}=await livePage(base,sub);
 const rows=longRows(doc),mine=rows[0],other=rows[1];
 type(w,mine,mine.value+' (his change)');
 const adrian=clientModule().createClient({base,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:base}:{})}})});
 const cur=await adrian.call('study-draft.read',{bindingId:sub.binding,parentStudyId:sub.id});
 const target=cur.projection.find(r=>r.id===other.dataset.ed);
 await adrian.call('study-draft.save',{bindingId:sub.binding,parentStudyId:sub.id,expected:cur.expected,operations:[{kind:'text',id:target.id,from:0,to:0,insert:'Elsewhere: ',seenBlockHash:target.blockHash}]});
 blur(w,mine);
 const panel=await until(()=>{const p=doc.querySelector('[data-wr-conflict]');return p&&!p.hidden?p:null;},20000);
 assert.match(panel.textContent,/\(his change\)/,'his paragraph');
 assert.match(panel.textContent,/Elsewhere: /,'the paragraph the saved version changed, which he did not touch');
 assert.match(panel.textContent,/You have not changed this paragraph/);
 assert.match(panel.querySelector('h2').textContent,/at \d\d:\d\d\b/,'the time reads as the bar does, in 24 hours');
 assert.doesNotMatch(panel.querySelector('h2').textContent,/[AP]M/);
 assert.equal(doc.querySelector('textarea[data-ed="'+mine.dataset.ed+'"]').value,mine.value);
});

test('real server: a split has an Undo that takes back that split',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const before=wordsOf(await draftOf(base,sub));
 const {w,doc}=await livePage(base,sub);
 const target=longRows(doc)[0],at=target.value.indexOf(' ',Math.floor(target.value.length/2));
 target.focus();target.setSelectionRange(at,at);press(w,target,'Enter');
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length+1,20000);
 assert.match(await until(()=>doc.querySelector('#v2-messages')?.textContent.match(/Split a paragraph/)?.[0]),/Split a paragraph/);
 doc.querySelector('#v2-messages button:not([aria-label])').click();
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length,20000);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'the split is taken back');
});

test('a read-through can be rewritten before it becomes his; a plain suggestion says it goes in as it stands',async()=>{
 const base={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['One.','Two.']),
  '/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,purpose:'article-draft',proposedBy:{actor:'agent:claude-code'}}]},
  '/api/study-ai/review':{id:'q1',status:'pending',stale:false,purpose:'article-draft',replacements:[{id:'r0',words:'One, better.',before:'One.'},{id:'r1',words:'Two, better.',before:'Two.'}]},
  '/api/study-ai/read':{sourceCatalog:[]},'/api/study-ai/finish':{readThrough:{}}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers:base});await settle(200);
 const box=doc.querySelector('textarea[data-rt="q1"][data-rid="r0"]');assert.ok(box,'the suggested words are a box he can change');
 assert.equal(box.value,'One, better.');
 box.value='One, mine.';box.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match(w.localStorage.getItem('ar-create:read-through:q1'),/One, mine\./,'kept on the device under the existing workspace\'s own key');
 doc.querySelector('[data-act="finish"]').click();await settle(200);
 const done=calls.find(c=>c.path==='/api/study-ai/finish');
 assert.deepEqual(plain(done.body.edits),[{id:'r0',words:'One, mine.'}],'only what he changed goes as his words');
 assert.equal(w.localStorage.getItem('ar-create:read-through:q1'),null);
 assert.match(doc.querySelector('#v2-messages').textContent,/Changed to your words\./,'his edits were sent, so the words are his');
 const plainOne=await page({hash:'#/write/s1?piece=o1',answers:{...base,'/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]},'/api/study-ai/review':{id:'q1',status:'pending',stale:false,replacements:[{id:'r0',words:'One, better.'}]}}});await settle(200);
 assert.match(plainOne.doc.querySelector('[data-act="accept"]').textContent,/Accept/);assert.match(plainOne.doc.querySelector('.wr-note').textContent,/exactly as they stand/);
 assert.equal(plainOne.doc.querySelectorAll('textarea[data-rt]').length,0);
});

// ---- every command Write calls is accepted by the real server as the client sends it ----
const agentPost=async(base,route,query,body)=>{
 const r=await fetch(base+route+'?'+new URLSearchParams(query),{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-AR-Actor':'agent:codex','X-AR-Client':'ui'},body:JSON.stringify(body)});
 const value=await r.json();assert.ok(r.ok,route+': '+JSON.stringify(value));return value;
};
/** A new piece with two plain paragraphs, and one suggestion an assistant has proposed for the first. */
async function plainSuggestion(base,words,extra={}){
 const adrian=pageClient(base),parentStudyId='invented-'+uuidv4().slice(0,8);
 const created=await adrian.call('study-draft.create-collection',{parentStudyId,title:'Invented piece'});
 const scope={bindingId:created.bindingId||created.binding?.id,parentStudyId};
 const empty=await adrian.call('study-draft.read',scope),ids=[uuidv4(),uuidv4()];
 const saved=await adrian.call('study-draft.save',{...scope,expected:empty.expected,operations:[{kind:'insert',id:ids[0],beforeId:null,raw:'The first paragraph.'},{kind:'insert',id:ids[1],beforeId:null,raw:'The second paragraph.'}]});
 const target=ids[0];
 const prep=await agentPost(base,'/api/study-ai/prepare',scope,{sourceIds:['author-page:'+scope.bindingId],...(extra.purpose?{...extra,targetParagraphIds:[target]}:{})});
 await agentPost(base,'/api/study-ai/propose',{...scope,requestId:prep.id},{requestId:prep.id,replacements:[{id:target,words}]});
 return {scope,requestId:prep.id,target,adrian,draft:saved};
}
const uuidv4=()=>globalThis.crypto.randomUUID();
test('real server: a human rejects a plain suggestion and it is gone',{timeout:60000},async()=>{
 const {base}=await theWorld();
 const {scope,requestId,adrian}=await plainSuggestion(base,'A plain suggestion to turn down.');
 assert.ok((await adrian.call('study-ai.requests',scope)).items.some(i=>i.id===requestId&&i.status==='pending'));
 await adrian.call('study-ai.reject',{...scope,requestId});
 assert.ok(!(await adrian.call('study-ai.requests',scope)).items.some(i=>i.id===requestId&&i.status==='pending'),'it is no longer pending');
});
test('real server: the other commands Write calls are not refused for an unsupported field',{timeout:60000},async()=>{
 const {base}=await theWorld(),{scope,requestId,target,adrian}=await plainSuggestion(base,'Taken as it stands.');
 const sub={id:scope.parentStudyId};
 await adrian.call('subject.standing',{parentStudyId:sub.id});
 await adrian.call('study.outputs',{rootBindingId:scope.bindingId,parentStudyId:sub.id});
 await adrian.call('study-ai.read',scope);
 await adrian.call('presence.post',{stage:'Write',scope:{kind:'draft',id:scope.bindingId},dirty:true,sequence:1,session:'v2-test'});
 await adrian.call('study-ai.review',{...scope,requestId});
 await adrian.call('study-ai.accept',{...scope,requestId});
 let draft=await adrian.call('study-draft.read',scope);
 assert.equal(draft.projection.find(r=>r.id===target).words,'Taken as it stands.');
 const op=(draft.history||[]).find(h=>h.canUndo&&h.operationId);
 assert.ok(op,'the accepted change can be taken back');
 await adrian.call('study-draft.undo',{...scope,expected:draft.expected,undoOperationId:op.operationId});
 draft=await adrian.call('study-draft.read',scope);
 const second=draft.projection.find(r=>r.words==='The second paragraph.');
 await adrian.call('study-draft.save',{...scope,expected:draft.expected,operations:[{kind:'text',id:second.id,from:0,to:0,insert:'X ',seenBlockHash:second.blockHash}]});
 const rt=await plainSuggestion(base,'Read-through words.',{purpose:'scoped-revision',instruction:'Clearer.'});
 await rt.adrian.call('study-ai.finish',{...rt.scope,requestId:rt.requestId,marks:[{id:rt.target}]});
});

test('real server: after splitting the last paragraph the empty box is after it, not between the halves',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'circle-of-twelve');
 const before=wordsOf(await draftOf(base,sub));
 const {w,doc}=await livePage(base,sub);
 const all=[...doc.querySelectorAll('textarea.wr-ed')],last=all.filter(t=>t.value.trim()).at(-1),at=last.value.indexOf(' ',Math.floor(last.value.length/2));
 last.focus();last.setSelectionRange(at,at);press(w,last,'Enter');
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length+1,20000);
 const boxes=await until(()=>{const b=[...doc.querySelectorAll('textarea.wr-ed')];return b.length>=2&&b.filter(t=>t.value.trim()).length===before.length+1?b:null;},20000);
 assert.equal(boxes.at(-1).value,'','the empty Write here box is last');
 assert.ok(boxes.slice(0,-1).every(t=>t.value.trim()),'no empty box between the halves');
});

test('the Add a piece plus is never hidden at any width',()=>{
 const css=read('public/v2/screens/write.css');
 assert.doesNotMatch(css,/Add a piece[^}]*\{[^}]*display:none/,'the plus stays at every width');
});

// ---- the third review: Enter and Backspace while a save is running ----
/** What a person typing would expect: paragraphs, and a caret in one of them. A break at the caret swallows the spaces beside
    it; Enter at the end moves to (or makes) an empty paragraph after; at the very start or in an empty paragraph it does
    nothing; Backspace at the start joins the paragraph to the one before with one space, the caret at the join. */
function person(paras,i=0,pos=0){
 const m={paras:[...paras],i,pos,
  type(ch){const p=m.paras[m.i];m.paras[m.i]=p.slice(0,m.pos)+ch+p.slice(m.pos);m.pos++;},
  left(){if(m.pos>0)m.pos--;},
  home(){m.pos=0;},
  enter(){
   const p=m.paras[m.i];if(!p.trim())return;
   const head=p.slice(0,m.pos).replace(/\s+$/,''),tail=p.slice(m.pos).replace(/^\s+/,'');
   if(!tail){if(m.i+1<m.paras.length&&!m.paras[m.i+1].trim()){m.i++;m.pos=0;return;}m.paras.splice(m.i+1,0,'');m.i++;m.pos=0;return;}
   if(!head)return;
   m.paras[m.i]=head;m.paras.splice(m.i+1,0,tail);m.i++;m.pos=0;
  },
  backspace(){
   if(m.pos!==0||m.i<1)return;
   const lt=m.paras[m.i-1].replace(/\s+$/,''),rt=m.paras[m.i].replace(/^\s+/,'');
   m.paras.splice(m.i-1,2,lt&&rt?lt+' '+rt:lt||rt);m.i--;m.pos=lt.length;
  },
  words(){return m.paras.filter(x=>x.trim());}};
 return m;
}
/** One key at a time into whichever box has the caret, as a browser does; the page must show what the person expects after every key. */
function hands(pg,model){
 const {w,doc}=pg,rec={dropped:0,wrong:[],enters:0,joins:0,during:{enters:0,joins:0}},trace=[];
 const box=()=>{const el=doc.activeElement;return el&&el.matches?.('textarea.wr-ed')&&!el.readOnly&&el.isConnected?el:null;};
 const saving=()=>/^Saving/.test(savedSaying(doc));
 const check=what=>{
  trace.push([what,saving(),JSON.stringify(model.paras.map(x=>x.slice(0,10))),JSON.stringify([...doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value.slice(0,10))),pg.calls.filter(c=>c.path==='/api/study-draft/save').map(c=>c.status).join(',')].join(' | '));
  const el=box(),shown=[...doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(x=>x.trim());
  if(JSON.stringify(shown)!==JSON.stringify(model.words())||!el||el.value!==model.paras[model.i]||el.selectionStart!==model.pos){
  rec.wrong.push({what,trace:trace.slice(-25),shown,expected:model.words(),caret:el?[el.value,el.selectionStart]:null,at:[model.paras[model.i],model.pos]});}
 };
 const act={
  letter(ch){const el=box();if(!el){rec.dropped++;return;}const at=el.selectionStart;el.value=el.value.slice(0,at)+ch+el.value.slice(at);el.setSelectionRange(at+1,at+1);el.dispatchEvent(new w.Event('input',{bubbles:true}));model.type(ch);},
  left(){const el=box();if(!el){rec.dropped++;return;}el.setSelectionRange(Math.max(0,el.selectionStart-1),Math.max(0,el.selectionStart-1));model.left();},
  home(){const el=box();if(!el){rec.dropped++;return;}el.setSelectionRange(0,0);model.home();},
  enter(){const el=box();if(!el){rec.dropped++;return;}const before=model.paras.length,m0=saving();press(w,el,'Enter');model.enter();if(model.paras.length!==before){rec.enters++;if(m0)rec.during.enters++;}},
  backspace(){const el=box();if(!el){rec.dropped++;return;}el.setSelectionRange(0,0);model.home();const before=model.paras.length,m0=saving();press(w,el,'Backspace');model.backspace();if(model.paras.length!==before){rec.joins++;if(m0)rec.during.joins++;}}
 };
 return {rec,act,check,saving};
}
/** A repeatable stream: mostly letters, some caret moves, Enters, and Backspaces at the start of a paragraph. */
function script(n,seed=7){
 let x=seed;const rnd=()=>{x=(x*1103515245+12345)&0x7fffffff;return x/0x7fffffff;},out=[],letters='abcdefghijklmnopqrstuvwxyz';
 for(let k=0;k<n;k++){
  const r=rnd();
  if(r<.62)out.push(['letter',letters[Math.floor(rnd()*26)]]);
  else if(r<.72)out.push(['left']);
  else if(r<.80)out.push(['home']);
  else if(r<.92)out.push(['enter']);
  else out.push(['backspace']);
 }
 return out;
}

test('real server: a steady typist who presses Enter and joins paragraphs while saves are in flight: the page is always what he expects, and so are the saved paragraphs',{timeout:240000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const pg=await livePage(base,sub,{slowSave:700});
 const start=longRows(pg.doc)[0],paras=edsOf(pg.doc),at=Math.floor(start.value.length/2);
 start.focus();start.setSelectionRange(at,at);
 const model=person(paras,paras.indexOf(start.value),at),hand=hands(pg,model);
 for(const [what,arg] of script(360,11)){hand.act[what](arg);hand.check(what+' '+(arg||''));await settle(15);}
 assert.ok(hand.rec.during.enters>=3,'Enter was pressed while a save was running: '+JSON.stringify(hand.rec.during));
 assert.ok(hand.rec.during.joins>=1,'Backspace joined while a save was running: '+JSON.stringify(hand.rec.during));
 assert.equal(hand.rec.dropped,0);
 assert.deepEqual(hand.rec.wrong.slice(0,2),[],'after every key the page showed what a person typing it expects, with the caret where it belongs');
 await until(()=>/^Saved/.test(savedSaying(pg.doc)),60000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(pg.doc)),60000);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),model.words(),'the saved paragraphs are exactly what he typed');
 assert.deepEqual(edsOf(pg.doc),model.words(),'and the page agrees');
 assert.deepEqual(pg.calls.filter(c=>c.method==='POST'&&c.status>=400).map(c=>c.status),[],'no refused save');
 assert.equal(pg.w.localStorage.getItem('ar-v2-write:'+sub.binding),null,'nothing is left waiting on the device');
});

test('real server: closing the tab while a save is running keeps the Enters and joins: the paragraphs come back as he left them',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'ink-on-warm-paper');
 const a=await livePage(base,sub,{slowSave:4000,lateSave:0});
 const start=longRows(a.doc)[0],paras=edsOf(a.doc),at=Math.floor(start.value.length/2);
 start.focus();start.setSelectionRange(at,at);
 const model=person(paras,paras.indexOf(start.value),at),hand=hands(a,model);
 const cmds=[['letter','x'],['enter'],['letter','y'],['letter','z'],['home'],['backspace'],['letter','q'],['left'],['left'],['enter'],['letter','w']];
 for(const [what,arg] of cmds){hand.act[what](arg);hand.check(what);await settle(30);if(what==='letter'&&arg==='x')await savedOnServer(a);}
 assert.deepEqual(hand.rec.wrong.slice(0,2),[]);
 assert.ok(hand.rec.during.enters>=1&&hand.rec.during.joins>=1,JSON.stringify(hand.rec.during));
 const b=await reload(a,base,sub);
 assert.deepEqual(edsOf(b.doc),model.words(),'the page shows the paragraphs as he left them');
 await agree(b,base,sub,2500);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),model.words(),'and the server holds them');
});
