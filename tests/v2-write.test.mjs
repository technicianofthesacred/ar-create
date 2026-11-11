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
 await fillDemo(base,{only:['straw-over-the-rows','the-first-cup','studio-after-rain','circle-of-twelve','ink-on-warm-paper','shade-and-patience']});
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
async function livePage(base,sub,{search='',slowSave=0}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#/write/'+sub.id+'?piece='+sub.piece,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 w.EventSource=class{constructor(u){this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET';calls.push({path:u.pathname,method,body:options.body?JSON.parse(options.body):null});
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  const text=await r.text();
  if(slowSave&&u.pathname==='/api/study-draft/save')await settle(slowSave);
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
 // the old way left words under his key; an assistant's page must neither restore nor save them
 const seed=await livePage(base,sub);
 seed.w.localStorage.setItem('ar-v2-write:'+sub.binding,JSON.stringify({v:1,at:Date.now(),draft:'x',edits:[],added:[{id:'55555555-5555-4555-8555-555555555555',afterId:null,text:'Typed by an assistant.'}]}));
 const agent=await livePage(base,sub,{search:'?reviewActor=agent:codex'});
 for(const t of agent.doc.querySelectorAll('textarea.wr-ed'))assert.ok(t.readOnly);
 assert.equal([...agent.doc.querySelectorAll('textarea.wr-ed')].some(t=>/Typed by an assistant/.test(t.value)),false);
 const t=agent.doc.querySelector('textarea.wr-ed');type(agent.w,t,'Typed anyway.');blur(agent.w,t);await settle(2000);
 assert.equal(agent.calls.filter(c=>c.method==='POST'&&/study-draft\/save|presence/.test(c.path)).length,0);
 assert.equal(agent.w.localStorage.getItem('ar-v2-write:'+sub.binding),null);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'the draft is as it was');
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
