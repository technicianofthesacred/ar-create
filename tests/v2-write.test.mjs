import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

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
  ['study-ai.requests','GET','/api/study-ai/requests',true],['study-ai.review','GET','/api/study-ai/review',true],['study-ai.read','GET','/api/study-ai/read',true],['study-ai.accept','POST','/api/study-ai/accept',false],['study-ai.reject','POST','/api/study-ai/reject',false],['presence.post','POST','/api/presence',false]]
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
 assert.deepEqual(plain(simple),{id:'p',by:'agent:claude-code',purpose:'',replacements:[{id:'a',words:'New.'}],simple:true});
 assert.equal(proposalView({id:'q'},{purpose:'article-draft',replacements:[]}).simple,false,'a whole draft is read through, never accepted from here');
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
 assert.match(doc.querySelector('.wr-seg').innerHTML,/section=read/);assert.match(doc.querySelector('.wr-seg').innerHTML,/section=check/);
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

test('an assistant opens the page: a save and a decision answer 403 and the screen says so plainly',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),
  '/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]},'/api/study-ai/review':{id:'q1',status:'pending',stale:false,replacements:[{id:'r0',words:'Better words.',before:'First words.'}]},
  '/api/study-ai/read':{sourceCatalog:[]},'/api/study-ai/accept':[403,{error:'This decision is human-only; agent:claude-code may propose but not decide.'}],'/api/study-draft/save':[403,{error:'human-only'}]};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers,search:'?reviewActor=agent:claude-code'});await settle(200);
 assert.match(doc.querySelector('.wr-draft').textContent,/Better words\./,'the proposal shows where the passage is, dim');
 assert.match(doc.querySelector('.wr-note').textContent,/Claude suggests new words/);
 doc.querySelector('[data-act="accept"]').click();await settle(120);
 assert.equal(doc.querySelector('#v2-messages').textContent.includes('Only Adrian can decide this. Claude can propose it, not do it.'),true);
 const t=doc.querySelector('textarea[data-ed="r0"]');t.value='First words, typed by an assistant.';t.dispatchEvent(new w.Event('input',{bubbles:true}));await settle(1800);
 assert.match(doc.querySelector('.wr-bar [data-wr-saved]').textContent,/Only Adrian can decide this/);
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/save').length,1,'it does not keep trying');
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
