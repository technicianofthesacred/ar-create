import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

// Version three's Write (public/v3/screens/write*.js), on the approved page: the pure steps that turn his words into the operations study-draft.save takes, the screen in a
// page, and the same commands against the real in-process server (a save with the revision he read, a stale save, an
// assistant's 403). Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v3dir=path.join(repo,'public/v3');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const plain=value=>JSON.parse(JSON.stringify(value));

/** The page with every script, fetch answered from a table (route -> body or [status, body]). */
async function page({hash='',answers={},search=''}={}){
 const html=read('public/v3/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v3/index.html'+search+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 const commands=[['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],['look','GET','/api/look',true],
  ['subject.standing','GET','/api/subject/standing',true],['study.outputs','GET','/api/study/outputs',true],['study-draft.read','GET','/api/study-draft/read',true],['study-draft.save','POST','/api/study-draft/save',false],
  ['study-ai.requests','GET','/api/study-ai/requests',true],['study-ai.review','GET','/api/study-ai/review',true],['study-ai.read','GET','/api/study-ai/read',true],['study-ai.accept','POST','/api/study-ai/accept',false],['study-ai.reject','POST','/api/study-ai/reject',false],['study-ai.finish','POST','/api/study-ai/finish',false],['study-draft.undo','POST','/api/study-draft/undo',false],['study-draft.set-aside','POST','/api/study-draft/set-aside',false],['study-draft.set-aside.list','GET','/api/study-draft/set-aside/list',true],['presence.post','POST','/api/presence',false]]
  .map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push({path:u.pathname,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  const answer=u.pathname==='/api/capabilities'?{commands}:answers[u.pathname]??{};const [status,body]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){const file=src.startsWith('/')?path.join(repo,'public',src):path.join(v3dir,src);w.eval(fs.readFileSync(file,'utf8'));}
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await settle(40);
 return {w,calls,doc:w.document};
}

const row=(id,words,extra={})=>({id,words,blockKind:'paragraph',safe:true,blockHash:id.padEnd(64,'0'),...extra});

test('the screen is registered at write/:id, in version three\'s index.html as its own files, and the README names the route',()=>{
 const html=read('public/v3/index.html');
 const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]),styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
 assert.deepEqual(scripts.filter(s=>/write/.test(s)),['screens/write-page.js','screens/write-margin.js','screens/write-versions.js','screens/write.js'],'its own four files, in this order, and never version two\'s');
 assert.deepEqual(styles.filter(s=>/write/.test(s)),['screens/write.css']);
 for(const f of ['write.js','write-page.js','write-margin.js','write-versions.js','write.css'])assert.ok(fs.existsSync(path.join(v3dir,'screens',f)),f);
 assert.match(read('public/v3/README.md'),/`write\/:id`/);
 assert.match(read('public/v2/README.md'),/`write\/:id`/,'version two still names it');
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
 assert.deepEqual([...doc.querySelectorAll('.wr-ed')].map(t=>t.value).filter(Boolean),['First <b>words</b>.','Second words.'],'his words are put in as text, never as markup');
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

test('typing saves through study-draft.save with the revision he read; a stale save shows both versions of that paragraph in place and merges nothing',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.','Second words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const t=doc.querySelector('[data-ed="r0"]');t.value='First words, edited.';t.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match(doc.querySelector('[data-wr-saved]').textContent,/Not saved yet/);
 // the next read the server gives is a newer draft; the save then answers 409
 answers['/api/study-draft/save']=[409,{error:'stale'}];answers['/api/study-draft/read']=draft(['First words changed elsewhere.','Second words.'],'h2');
 await settle(1800);
 const save=calls.find(c=>c.path==='/api/study-draft/save');
 assert.ok(save,'the save was sent');assert.deepEqual(plain(save.body.expected),{workflow:{draft:'h1'}},'the revision he read goes with it');
 assert.equal(save.body.bindingId,'b1');assert.equal(save.body.parentStudyId,'s1');assert.match(save.body.operationId,/^[0-9a-f-]{36}$/);
 assert.deepEqual(plain(save.body.operations.map(o=>o.kind)),['text']);
 // Both changed the first paragraph: both versions stand in its place, each named, and he keeps one, or both.
 const two=doc.querySelector('[data-row="r0"] .wr-two');assert.ok(two,'both versions are in the page, in place');
 const [theirs,mine]=[...two.querySelectorAll('.wr-v')];
 assert.match(theirs.textContent,/Written elsewhere/);assert.match(theirs.textContent,/First words changed elsewhere\./);
 assert.match(mine.textContent,/Written here, \d\d:\d\d/);assert.match(mine.textContent,/First words, edited\./);
 assert.ok(two.querySelector('mark.wr-dif'),'what differs is marked');
 assert.equal(doc.querySelector('[data-ed="r0"]'),null,'nothing is typed into a paragraph while it has two versions');
 assert.match(doc.querySelector('[data-wr-saved]').textContent,/One paragraph has two versions/);
 assert.match(doc.querySelector('[data-wr-conflict]').textContent,/One paragraph, written in two places/);
 assert.ok(two.querySelector('[data-act="keep"][data-v="theirs"]')&&two.querySelector('[data-act="keep"][data-v="mine"]')&&two.querySelector('[data-act="keep"][data-v="both"]'),'he chooses');
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/save').length,1,'nothing is sent again until he chooses');
 assert.equal(JSON.parse(w.localStorage.getItem('ar-v3-write:b1')).edits[0][1],'First words, edited.','his words wait on the device meanwhile');
 // he keeps the saved version: his words are set aside on the app first
 two.querySelector('[data-act="keep"][data-v="theirs"]').click();await settle(80);
 const aside=calls.find(c=>c.path==='/api/study-draft/set-aside');
 assert.deepEqual(plain(aside?.body.paragraphs),[{id:'r0',words:'First words, edited.'}]);assert.equal(aside.body.reason,'conflict');
 assert.equal(doc.querySelector('[data-ed="r0"]').value,'First words changed elsewhere.');assert.equal(doc.querySelector('.wr-two'),null);
 assert.equal(w.localStorage.getItem('ar-v3-write:b1'),null,'nothing unsaved is left once he chose the saved words, and his are on the app');
});

test('unsaved words are kept on this device and come back after a reload',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]},'/api/study-draft/save':[500,{error:'down'}]};
 const first=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const t=first.doc.querySelector('[data-ed="r0"]');t.value='First words, kept safe.';t.dispatchEvent(new first.w.Event('input',{bubbles:true}));
 const kept=JSON.parse(first.w.localStorage.getItem('ar-v3-write:b1'));
 assert.deepEqual(plain(kept.edits),[['r0','First words, kept safe.','First words.']]);assert.equal(kept.draft,'h1');
 // a new page (a reload) with that copy on this device
 const second=await page({hash:'#/write/s1?piece=o1',answers});
 second.w.localStorage.setItem('ar-v3-write:b1',JSON.stringify(kept));
 second.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(30);second.w.location.hash='#/';await settle(30);second.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(200);
 assert.equal(second.doc.querySelector('[data-ed="r0"]').value,'First words, kept safe.');
});

test('after a reload, words typed into a paragraph removed elsewhere, or one that now holds formatting, come back as new paragraphs: never dropped',async()=>{
 // Kept on this device before the reload: two paragraphs he changed. Meanwhile the second was removed elsewhere and the third
 // was given formatting this page keeps as it is. Both of his come back, where they stood, and wait to be saved.
 const kept={v:2,at:Date.now(),draft:'h1',edits:[['r1','Second words, mine.','Second words.'],['r2','Third words, mine.','Third words.']],added:[],sent:[],base:[['r0','First words.'],['r1','Second words.'],['r2','Third words.']]};
 const now={...draft(['First words.']),expected:{workflow:{draft:'h2'}}};now.projection.push(row('r2','Third **words**.',{safe:false}));
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':now,'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]},'/api/study-draft/save':[500,{error:'down'}]};
 const pg=await page({hash:'#/',answers});
 pg.w.localStorage.setItem('ar-v3-write:b1',JSON.stringify(kept));
 pg.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(250);
 const values=[...pg.doc.querySelectorAll('.wr-ed[data-ed]')].map(t=>t.value);
 assert.ok(values.includes('Second words, mine.'),'words typed into a paragraph removed elsewhere are on the page: '+JSON.stringify(values));
 assert.ok(values.includes('Third words, mine.'),'words typed into a paragraph that now holds formatting are on the page');
 const stored=JSON.parse(pg.w.localStorage.getItem('ar-v3-write:b1'));
 assert.deepEqual(plain(stored.added.map(a=>[a.afterId,a.text])),[['r0','Second words, mine.'],['r2','Third words, mine.']],'and kept on the device, each after the paragraph it followed');
});

test('a paragraph that now holds formatting never swallows his words: a newer version, and a closed tab\'s kept words, bring them back as a new paragraph after it',async()=>{
 const base=()=>({'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}});
 const formatted=()=>{const d={...draft(['First words.']),expected:{workflow:{draft:'h2'}}};d.projection.push(row('r1','Second **words**.',{safe:false}));return d;};
 // A newer version arrives while he has typed into the paragraph that it gave formatting.
 const answers={...base(),'/api/study-draft/read':draft(['First words.','Second words.'])};
 const {w,doc}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const t=doc.querySelector('[data-ed="r1"]');t.value='Second words, mine.';t.dispatchEvent(new w.Event('input',{bubbles:true}));
 answers['/api/study-draft/save']=[409,{error:'stale'}];answers['/api/study-draft/read']=formatted();
 await settle(1800);
 assert.ok([...doc.querySelectorAll('.wr-ed[data-ed]')].some(e=>e.value==='Second words, mine.'),'his words stand on the page as a new paragraph');
 assert.deepEqual(plain(JSON.parse(w.localStorage.getItem('ar-v3-write:b1')).added.map(a=>[a.afterId,a.text])),[['r1','Second words, mine.']],'after the paragraph they were typed into');
 // A tab that closed with words typed into that paragraph: they are offered, not removed.
 const held=new Set(),locks={request(name,opts,cb){if(typeof opts==='function')cb=opts;if(held.has(name))return Promise.resolve().then(()=>cb(null));held.add(name);return Promise.resolve().then(()=>cb({name})).finally(()=>held.delete(name));}};
 const kept={v:2,at:Date.now(),tab:'a-closed-tab',draft:'h1',edits:[['r1','Second words, from the closed tab.','Second words.']],added:[],sent:[],base:[['r0','First words.'],['r1','Second words.']]};
 const pg=await page({hash:'#/',answers:{...base(),'/api/study-draft/read':formatted()}});
 Object.defineProperty(pg.w.navigator,'locks',{configurable:true,get:()=>locks});
 pg.w.localStorage.setItem('ar-v3-write:b1',JSON.stringify(kept));
 pg.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(300);
 assert.deepEqual([...pg.doc.querySelectorAll('.wr-rec')].map(e=>e.textContent),['Second words, from the closed tab.'],'offered in place');
 assert.ok(pg.w.localStorage.getItem('ar-v3-write:b1'),'and still on the device until he chooses');
 pg.doc.querySelector('[data-act="rec"][data-v="back"]').click();await settle(100);
 assert.ok([...pg.doc.querySelectorAll('.wr-ed[data-ed]')].some(e=>e.value==='Second words, from the closed tab.'),'Put them back: a new paragraph after it');
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
 for(const t of doc.querySelectorAll('.wr-ed'))assert.ok(t.readOnly,'every paragraph is read only for an assistant');
 const t=doc.querySelector('[data-ed="r0"]');t.value='Typed by an assistant.';t.dispatchEvent(new w.Event('input',{bubbles:true}));await settle(1800);
 assert.equal(w.localStorage.getItem('ar-v3-write:b1'),null,'an assistant\'s words are not kept on the device');
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/save'||c.path==='/api/presence').length,0,'no save and no presence from an assistant');
});

test('accepting as him uses study-ai.accept and then reads the draft again; Dismiss uses study-ai.reject',async()=>{ const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),
  '/api/study-ai/requests':{items:[{id:'q1',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]},'/api/study-ai/review':{id:'q1',status:'pending',stale:false,replacements:[{id:'r0',words:'Better words.',before:'First words.'}]},
  '/api/study-ai/read':{sourceCatalog:[]},'/api/study-ai/accept':{ok:true},'/api/study-ai/reject':{ok:true}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(200);
 answers['/api/study-draft/read']=draft(['Better words.'],'h2');answers['/api/study-ai/requests']={items:[]};
 doc.querySelector('[data-act="accept"]').click();await settle(200);
 const accept=calls.find(c=>c.path==='/api/study-ai/accept');assert.ok(accept);assert.equal(accept.body.requestId,'q1');
 assert.equal(doc.querySelector('[data-ed="r0"]').value,'Better words.');assert.equal(doc.querySelectorAll('.wr-note').length,0);
 // Dismiss on a second page: study-ai.reject, and the words stay as he wrote them.
 answers['/api/study-draft/read']=draft(['First words.']);answers['/api/study-ai/requests']={items:[{id:'q2',status:'pending',stale:false,proposedBy:{actor:'agent:claude-code'}}]};answers['/api/study-ai/review']={id:'q2',status:'pending',stale:false,replacements:[{id:'r0',words:'Other words.',before:'First words.'}]};
 const second=await page({hash:'#/write/s1?piece=o1',answers});await settle(200);
 answers['/api/study-ai/requests']={items:[]};
 second.doc.querySelector('[data-act="reject"]').click();await settle(200);
 const reject=second.calls.find(c=>c.path==='/api/study-ai/reject');assert.ok(reject);assert.equal(reject.body.requestId,'q2');
 assert.equal(second.doc.querySelector('[data-ed="r0"]').value,'First words.');
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
 const css=read('public/v3/screens/write.css'),js=['write','write-page','write-margin','write-versions'].map(f=>read('public/v3/screens/'+f+'.js')).join('\n');
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
 const css=read('public/v3/screens/write.css'),block=css.slice(css.indexOf('@media (max-width:380px)'));
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
 const t=doc.querySelector('[data-ed="r0"]');t.value='First words, changed.';t.dispatchEvent(new w.Event('input',{bubbles:true}));
 t.dispatchEvent(new w.Event('focusout',{bubbles:true}));await settle(150);
 assert.equal(doc.querySelector('[data-wr-conflict]').hidden,true,'the revision did not change, so there is no newer version to choose');
 assert.match(doc.querySelector('.wr-bar [data-wr-saved]').textContent,/Edit would create unsupported/);
 assert.equal(doc.querySelector('[data-ed="r0"]').value,'First words, changed.','his words stay');
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
 const html=read('public/v3/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v3/index.html'+search+'#/write/'+sub.id+'?piece='+sub.piece,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.EventSource=class{constructor(u){this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  const isSave=u.pathname==='/api/study-draft/save';
  if(w.__down)throw new TypeError('Failed to fetch');// no connection: nothing reaches the server and nothing comes back
  if(lateSave&&isSave)await settle(lateSave);// held back before it reaches the server
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  let text=await r.text();entry.status=r.status;
  // __nocan: the app says the latest saved change can no longer be undone while every older one still can ('all' on every answer, 'reads' only on a fresh read)
  if(w.__nocan&&r.ok&&(w.__nocan==='all'?/study-draft\/(read|save)$/:/study-draft\/read$/).test(u.pathname)){const j=JSON.parse(text),h=(j.history||[]).filter(x=>x.state==='committed');if(h.length){for(const x of h)x.canUndo=true;h.at(-1).canUndo=false;text=JSON.stringify(j);}}
  if(slowSave&&isSave)await settle(slowSave);// the server has it; the answer is held back
  const extra=delay?delay(u.pathname,method):0;if(extra)await settle(extra);
  entry.answered=Date.now();
  return {ok:r.ok,status:r.status,text:async()=>text};
 };
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v3dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('.wr-ed')||w.document.querySelector('.wr-none'));
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
const edsOf=doc=>[...doc.querySelectorAll('.wr-ed')].map(t=>t.value).filter(Boolean);
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
 assert.equal(pg.w.localStorage.getItem('ar-v3-write:'+sub.binding),null,'nothing is left waiting on the device');
 return server;
}
const key=(w,binding)=>JSON.parse(w.localStorage.getItem('ar-v3-write:'+binding)||'null');

test('real server: words typed into a new paragraph, and into a saved one, while a save is in flight are never lost',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const {w,doc}=await livePage(base,sub,{slowSave:500});
 const tail=[...doc.querySelectorAll('.wr-ed')].at(-1),first=doc.querySelector('.wr-ed');
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
 assert.ok([...doc.querySelectorAll('.wr-ed')].some(t=>t.value===typed),'and still on the page');
 assert.equal(w.localStorage.getItem('ar-v3-write:'+sub.binding),null,'nothing waits on the device once it is all saved');
});

test('real server: a change from the stream that arrives while a save is running is shown after the save',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup');
 const {w,doc,sources}=await livePage(base,sub,{slowSave:600});
 const tail=[...doc.querySelectorAll('.wr-ed')].at(-1);
 type(w,tail,'Closing words from the screen.');blur(w,tail);
 await settle(100);
 // another window of his saves paragraph 2 while the first save's answer is still on its way
 const adrian=clientModule().createClient({base,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:base}:{})}})});
 const mid=await adrian.call('study-draft.read',{bindingId:sub.binding,parentStudyId:sub.id});
 const target=mid.projection.find(r=>r.safe!==false&&r.words);
 await adrian.call('study-draft.save',{bindingId:sub.binding,parentStudyId:sub.id,expected:mid.expected,operations:[{kind:'text',id:target.id,from:0,to:0,insert:'Elsewhere: ',seenBlockHash:target.blockHash}]});
 for(const s of sources)s.emit('change',{kind:'study-draft.save',cursor:5000,bootId:'b',scope:{kind:'draft',id:sub.binding},operationId:'elsewhere-1'});
 await until(()=>doc.querySelector(`[data-ed="${target.id}"]`)?.value.startsWith('Elsewhere: '),20000);
});

test('real server: presence tells an assistant he has unsaved words, and only while he has them',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'studio-after-rain');
 const {w,doc,calls}=await livePage(base,sub);
 const seen=()=>getJSON(base,`/api/presence?kind=draft&id=${sub.binding}`).then(r=>r.presence.map(p=>[p.actor,p.dirty,p.stage]));
 assert.deepEqual(await seen(),[],'nothing to say before he has typed');
 const t=doc.querySelector('.wr-ed');type(w,t,t.value+' more');
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
 const agent=await livePage(base,sub,{search:'?reviewActor=agent:codex',seed:{['ar-v3-write:'+sub.binding]:kept}});
 for(const t of agent.doc.querySelectorAll('.wr-ed'))assert.ok(t.readOnly);
 assert.equal([...agent.doc.querySelectorAll('.wr-ed')].some(t=>/Kept for Adrian only/.test(t.value)),false,'not shown');
 assert.doesNotMatch(agent.doc.body.textContent,/unsaved words from earlier|Kept for Adrian only/);
 const t=agent.doc.querySelector('.wr-ed');type(agent.w,t,'Typed anyway.');blur(agent.w,t);await settle(2500);
 assert.equal(agent.calls.filter(c=>c.method==='POST'&&/study-draft\/save|presence/.test(c.path)).length,0,'not saved, not reported');
 assert.equal(agent.w.localStorage.getItem('ar-v3-write:'+sub.binding),kept,'his kept words are untouched, not removed and not rewritten');
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'the draft is as it was');
 // and an assistant\'s own typing leaves nothing on the device
 const bare=await livePage(base,sub,{search:'?reviewActor=agent:codex'});
 const u=bare.doc.querySelector('.wr-ed');type(bare.w,u,'Typed anyway.');blur(bare.w,u);await settle(500);
 assert.equal(bare.w.localStorage.getItem('ar-v3-write:'+sub.binding),null);assert.equal(bare.w.localStorage.length,0);
 // then he opens it: his words come back, as his
 const he=await livePage(base,sub,{seed:{['ar-v3-write:'+sub.binding]:kept}});
 assert.ok(edsOf(he.doc).includes('Kept for Adrian only.'),'for him they are restored');
 he.w.localStorage.removeItem('ar-v3-write:'+sub.binding);
});

test('real server: Backspace joins two paragraphs and an emptied paragraph is deleted, each with an Undo that takes back that change',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup');
 const {w,doc}=await livePage(base,sub);
 const before=wordsOf(await draftOf(base,sub));
 const eds=()=>[...doc.querySelectorAll('.wr-ed')].filter(t=>t.value);
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
const longRows=doc=>[...doc.querySelectorAll('.wr-ed')].filter(t=>t.value.length>30);

test('real server: reload while a new paragraph is being saved keeps every word, once, with no refused save',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'shade-and-patience');
 const a=await livePage(base,sub,{slowSave:3000});
 const tail=[...a.doc.querySelectorAll('.wr-ed')].at(-1),first='A closing paragraph written for the reload test';
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
 const tail=[...a.doc.querySelectorAll('.wr-ed')].at(-1),first='Another closing paragraph, for the held-back save';
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
 const right=[...a.doc.querySelectorAll('.wr-ed')].find(x=>x.value===text.slice(at).trim());
 right.focus();right.setSelectionRange(0,0);press(a.w,right,'Backspace');await savedOnServer(a);
 b=await reload(a,base,sub);
 server=await agree(b,base,sub,2500);
 assert.equal(server.filter(x=>x.startsWith(text.slice(0,at))&&x.endsWith(text.slice(at).trim())).length,1,'the join is there, once: '+JSON.stringify(server.slice(0,3)));
 assert.equal(server.includes(text.slice(at).trim()),false);
 // delete
 a=await livePage(base,sub,{slowSave:3000});
 const gone=[...a.doc.querySelectorAll('.wr-ed')].filter(x=>x.value).at(-1),goneText=gone.value;
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
 // he keeps typing at the caret while the split is saved
 type(a.w,target,L+' TYPED '+R);target.setSelectionRange(at+7,at+7);
 await until(()=>edsOf(a.doc).includes(L)||edsOf(a.doc).some(x=>x.includes('TYPED')),20000);
 await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
 let server=wordsOf(await draftOf(base,sub));
 assert.equal(server.filter(x=>x.includes('TYPED')).length,1,'typed once');
 assert.ok(server.includes(L),'the left half is as it was');assert.ok(server.includes('TYPED '+R),'what he typed at the caret goes with the new paragraph');
 assert.deepEqual(edsOf(a.doc),server);assert.equal(a.w.localStorage.getItem('ar-v3-write:'+sub.binding),null);
 // typing at the start of the left half while the next split is saved
 const t2=longRows(a.doc).find(x=>x.value!==L&&x.value!=='TYPED '+R&&x.value.length>30);
 if(t2){
  const T=t2.value,cut=T.indexOf(' ',Math.floor(T.length/2));
  t2.focus();t2.setSelectionRange(cut,cut);press(a.w,t2,'Enter');await savedOnServer(a,2);
  type(a.w,t2,'AA '+T);
  await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
  server=wordsOf(await draftOf(base,sub));
  assert.ok(server.includes('AA '+T.slice(0,cut)),'typed before the split point stays in the left half');assert.ok(server.includes(T.slice(cut).trim()));
  assert.equal(server.filter(x=>x.includes('AA ')).length,1);assert.deepEqual(edsOf(a.doc),server);
 }
 // a join while he types in both halves
 const rows=longRows(a.doc),left=rows[0],right=rows[1];
 const lw=left.value,rw=right.value;
 right.focus();right.setSelectionRange(0,0);press(a.w,right,'Backspace');await savedOnServer(a,3);
 type(a.w,left,lw+' LEFTMORE');type(a.w,right,rw+' RIGHTMORE');
 await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
 server=wordsOf(await draftOf(base,sub));
 assert.equal(server.filter(x=>x.includes('LEFTMORE')).length,1);assert.equal(server.filter(x=>x.includes('RIGHTMORE')).length,1);
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
 const first=a.doc.querySelector('.wr-ed'),words=first.value+' (changed after the read began)';
 type(a.w,first,words);blur(a.w,first);await quiet(a.doc);
 await settle(2600);// the old read lands
 assert.equal(a.doc.querySelector('[data-wr-conflict]').hidden,true,'it is not a newer version');
 assert.equal(a.doc.querySelector('.wr-ed').value,words,'his saved words are not put back to the old ones');
 assert.equal(wordsOf(await draftOf(base,sub))[0],words);
 // a change from the stream that arrives while a save is running is read once the save is over
 const b=await livePage(base,sub,{slowSave:900,delay:(p,m)=>p==='/api/study-draft/read'&&m==='GET'?readHold:0});
 const reads=()=>b.calls.filter(c=>c.path==='/api/study-draft/read').length,n0=reads();
 readHold=500;
 for(const s of b.sources)s.emit('change',{kind:'study-draft.save',cursor:6100,bootId:'b',scope:{kind:'draft',id:sub.binding},operationId:'elsewhere-3'});
 await settle(300);readHold=0;
 const f2=b.doc.querySelector('.wr-ed');type(b.w,f2,f2.value+' more');blur(b.w,f2);// the save starts while that read is running
 await savedOnServer(b);const answered=Date.now();
 await until(()=>b.calls.some(c=>c.path==='/api/study-draft/read'&&c.method==='GET'&&c.answered>answered-50&&c.answered>b.calls.find(x=>x.path==='/api/study-draft/save').answered-1),20000);
 await quiet(b.doc);assert.ok(reads()>n0+1,'it was read again after the save');
});

test('real server: a paragraph changed only elsewhere is taken, his own change is kept, both are saved, and the page says so with a way to see them',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'shade-and-patience');
 const {w,doc}=await livePage(base,sub);
 const rows=longRows(doc),mine=rows[0],other=rows[1];
 type(w,mine,mine.value+' (his change)');
 const adrian=clientModule().createClient({base,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:base}:{})}})});
 const cur=await adrian.call('study-draft.read',{bindingId:sub.binding,parentStudyId:sub.id});
 const target=cur.projection.find(r=>r.id===other.dataset.ed);
 await adrian.call('study-draft.save',{bindingId:sub.binding,parentStudyId:sub.id,expected:cur.expected,operations:[{kind:'text',id:target.id,from:0,to:0,insert:'Elsewhere: ',seenBlockHash:target.blockHash}]});
 blur(w,mine);
 const panel=await until(()=>{const p=doc.querySelector('[data-wr-conflict] [data-wr-side="merged"]');return p||null;},20000);
 assert.match(panel.textContent,/1 paragraph changed elsewhere was taken as it is/);
 assert.match(panel.textContent,/Your words in 1 paragraph changed only here stay as you wrote them/);
 assert.match(panel.querySelector('h2').textContent,/at \d\d:\d\d\b/,'the time reads as the bar does, in 24 hours');
 assert.doesNotMatch(panel.querySelector('h2').textContent,/[AP]M/);
 assert.equal(doc.querySelector('.wr-two'),null,'nothing was changed in both places, so nothing waits');
 await quiet(doc);
 const server=wordsOf(await draftOf(base,sub));
 assert.ok(server.some(x=>x.endsWith('(his change)')),'his change is saved');assert.ok(server.some(x=>x.startsWith('Elsewhere: ')),'and the other, untouched');
 // he can see what was taken, and put back the words he had there
 doc.querySelector('[data-wr-conflict] [data-act="merged-see"]').click();
 const seen=doc.querySelector('[data-wr-conflict] [data-wr-side="merged"]');assert.match(seen.textContent,/Changed elsewhere/);assert.match(seen.textContent,/Elsewhere: /);
 seen.querySelector('[data-act="earlier"]').click();await settle(100);await quiet(doc);
 const back=wordsOf(await draftOf(base,sub));assert.equal(back.some(x=>x.startsWith('Elsewhere: ')),false,'the words he had are back');assert.ok(back.some(x=>x.endsWith('(his change)')));
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
 await adrian.call('presence.post',{stage:'Write',scope:{kind:'draft',id:scope.bindingId},dirty:true,sequence:1,session:'v3-test'});
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
 const all=[...doc.querySelectorAll('.wr-ed')],last=all.filter(t=>t.value.trim()).at(-1),at=last.value.indexOf(' ',Math.floor(last.value.length/2));
 last.focus();last.setSelectionRange(at,at);press(w,last,'Enter');
 await until(async()=>wordsOf(await draftOf(base,sub)).length===before.length+1,20000);
 const boxes=await until(()=>{const b=[...doc.querySelectorAll('.wr-ed')];return b.length>=2&&b.filter(t=>t.value.trim()).length===before.length+1?b:null;},20000);
 assert.equal(boxes.at(-1).value,'','the empty Write here box is last');
 assert.ok(boxes.slice(0,-1).every(t=>t.value.trim()),'no empty box between the halves');
});

test('the Add a piece plus is never hidden at any width',()=>{
 const css=read('public/v3/screens/write.css');
 assert.doesNotMatch(css,/Add a piece[^}]*\{[^}]*display:none/,'the plus stays at every width');
});

test('real server: typing into a saved paragraph with a bold run and splitting it at once saves each word once, in order, bold kept',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'studio-after-rain');
 const adrian=pageClient(base),scope={bindingId:sub.binding,parentStudyId:sub.id};
 const d0=await adrian.call('study-draft.read',scope),row=d0.projection.find(r=>r.safe!==false&&r.words.length>30);
 const id=globalThis.crypto.randomUUID();
 await adrian.call('study-draft.save',{...scope,expected:d0.expected,operations:[{kind:'insert',id,beforeId:row.id,raw:'Alpha **bold run** beta gamma, in a paragraph he saved earlier.'}]});
 const a=await livePage(base,sub),target=a.doc.querySelector(`[data-ed="${id}"]`);
 assert.ok(target.value.startsWith('Alpha '),'the saved paragraph is on the page: '+target.value.slice(0,40));
 const cut=target.value.indexOf('beta')-1,typed=target.value.slice(0,cut)+' XYZ'+target.value.slice(cut);
 type(a.w,target,typed);const at=cut+4;target.setSelectionRange(at,at);press(a.w,target,'Enter');// before the autosave
 await savedOnServer(a);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
 const check=async d=>{
  const rows=d.projection.filter(r=>r.safe!==false&&r.words),i=rows.findIndex(r=>r.id===id),both=rows[i].raw+' | '+rows[i+1].raw;
  for(const w of ['Alpha','XYZ','beta','gamma'])assert.equal(both.split(w).length-1,1,w+' once: '+both);
  assert.ok(both.indexOf('Alpha')<both.indexOf('XYZ')&&both.indexOf('XYZ')<both.indexOf('beta')&&both.indexOf('beta')<both.indexOf('gamma'),'in order: '+both);
  assert.match(rows[i].raw,/\*\*bold run\*\*/,'the bold is kept: '+rows[i].raw);
  return rows.map(r=>r.words);
 };
 const server=await check(await draftOf(base,sub));
 assert.deepEqual(edsOf(a.doc),server,'the page shows what the server holds');
 const b=await reload(a,base,sub);await agree(b,base,sub,2500);
 assert.deepEqual(await check(await draftOf(base,sub)),server,'a reload shows the same');
});

// ---- piece 2: the page's own editable paragraphs, the failed save, Enter during a save, a newline without Enter ----
test('an Article\'s paragraphs are the page\'s own editable lines; a ring after a quote is never part of his words, typed around or saved',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['She said “First you watch,” and left.','Second words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]}};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const el=doc.querySelector('[data-ed="r0"]');
 assert.equal(el.tagName,'P');assert.equal(el.getAttribute('contenteditable'),'plaintext-only');assert.equal(el.getAttribute('role'),'textbox');assert.equal(el.readOnly,false);
 const ring=doc.createElement('span');ring.setAttribute('data-ring','');ring.setAttribute('contenteditable','false');ring.textContent='RING';
 const first=el.firstChild,cut=first.data.indexOf('”')+1;first.splitText(cut);el.insertBefore(ring,first.nextSibling);
 assert.equal(el.value,'She said “First you watch,” and left.','the ring is skipped when his words are read');
 el.focus();el.setSelectionRange(cut,cut);assert.equal(el.selectionStart,cut);
 ring.nextSibling.data=' she said,'+ring.nextSibling.data;el.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(el.value,'She said “First you watch,” she said, and left.');
 assert.ok(el.contains(ring),'typing beside the ring leaves it where it is');
 await settle(1800);
 const save=calls.find(c=>c.path==='/api/study-draft/save');assert.ok(save,'saved');
 assert.doesNotMatch(JSON.stringify(save.body),/RING/,'nothing of the ring reaches the save');
 const [op]=save.body.operations,orig='She said “First you watch,” and left.';
 assert.equal(op.kind,'text');assert.equal(orig.slice(0,op.from)+op.insert+orig.slice(op.to),'She said “First you watch,” she said, and left.');
});

test('a save the app does not answer: the bar says since when with Try again on its line, Copy all my words copies the unsaved words, Try again saves them',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.','Second words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]},'/api/study-draft/save':[503,{error:'down'}]};
 const {w,doc,calls}=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 const el=doc.querySelector('[data-ed="r0"]');el.focus();el.value='First words, not saved.';el.dispatchEvent(new w.Event('input',{bubbles:true}));
 el.dispatchEvent(new w.Event('focusout',{bubbles:true}));await settle(150);
 const bar=doc.querySelector('.wr-bar');
 assert.match(bar.querySelector('[data-wr-saved]').textContent,/^Not saved since 10:00$|^Not saved since \d\d:\d\d$/);
 assert.equal(bar.querySelector('[data-wr="retry"]').hidden,false,'Try again stands on the same line');
 const panel=doc.querySelector('[data-wr-fail]');assert.equal(panel.hidden,false);assert.match(panel.textContent,/are not saved yet/);assert.match(panel.textContent,/kept on this device/);
 assert.equal(JSON.parse(w.localStorage.getItem('ar-v3-write:b1')).edits[0][1],'First words, not saved.','kept on the device meanwhile');
 let copied=null;Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async t=>{copied=t;}}});
 panel.querySelector('[data-wr="copy"]').click();await settle(30);
 assert.equal(copied,'Invented piece\n\nFirst words, not saved.\n\nSecond words.','every word on the page, the unsaved ones as he typed them');
 assert.match(doc.querySelector('#v2-messages').textContent,/Copied all 8 words/);
 // a second failure says the times tried
 bar.querySelector('[data-wr="retry"]').click();await settle(150);
 assert.match(bar.querySelector('[data-wr-saved]').textContent,/^Still not saved, tried \d\d:\d\d$/);assert.match(panel.textContent,/Still not saved/);assert.match(panel.textContent,/Tried at .+ and .+\. The app has not answered\./);
 // the app answers
 answers['/api/study-draft/save']=draft(['First words, not saved.','Second words.'],'h2');
 bar.querySelector('[data-wr="retry"]').click();await settle(150);
 assert.match(bar.querySelector('[data-wr-saved]').textContent,/^Saved/);assert.equal(panel.hidden,true);assert.equal(bar.querySelector('[data-wr="retry"]').hidden,true);
 assert.equal(calls.filter(c=>c.path==='/api/study-draft/save').length,3);
 const ops=calls.filter(c=>c.path==='/api/study-draft/save').map(c=>JSON.stringify(c.body.operations));assert.equal(new Set(ops).size,1,'the same words each time');
});

test('real server: Enter in the middle of a saved paragraph while a save runs keeps every letter in order, and the caret after them',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'ink-on-warm-paper');
 const a=await livePage(base,sub,{slowSave:1200});
 const rows=longRows(a.doc),target=rows[0],other=rows[1];
 type(a.w,other,other.value+' Changed first.');blur(a.w,other);
 await until(()=>a.calls.some(c=>c.path==='/api/study-draft/save'));// a save is running and slow to answer
 const text=target.value,at=text.indexOf(' ',Math.floor(text.length/2));
 target.focus();target.setSelectionRange(at,at);press(a.w,target,'Enter');
 const letter=ch=>{const el=a.doc.activeElement,p=el.selectionStart;el.value=el.value.slice(0,p)+ch+el.value.slice(p);el.setSelectionRange(p+1,p+1);el.dispatchEvent(new a.w.Event('input',{bubbles:true}));};
 for(const ch of 'jo'){letter(ch);await settle(80);}// he goes on typing before the split is made
 const rid=target.dataset.ed;
 await savedOnServer(a,2);await until(()=>edsOf(a.doc).includes(text.slice(0,at))&&a.doc.activeElement?.dataset?.ed&&a.doc.activeElement.dataset.ed!==rid,20000);// the split is on the page
 for(const ch of 'ined'){letter(ch);await settle(40);}
 await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);await settle(2500);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
 const server=wordsOf(await draftOf(base,sub));
 assert.ok(server.includes(text.slice(0,at)),'the first half is as it was');
 assert.ok(server.includes('joined'+text.slice(at)),'what he typed after Enter starts the new paragraph, in the order he typed it: '+server.find(x=>/j|ined/.test(x)&&x.includes(text.slice(at+1,at+12))));
 assert.equal(server.filter(x=>x.endsWith(' Changed first.')).length,1,'the save that was running is kept, once');
 assert.deepEqual(edsOf(a.doc),server,'the page is what the server holds');
});

test('real server: a newline that comes without an Enter key, as Android keyboards send it, splits the paragraph and never becomes a space',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'small-paintings-of-doors');
 const a=await livePage(base,sub);
 for(const [n,inputType] of [[1,'insertParagraph'],[2,'insertLineBreak'],[3,'none']]){
  const target=longRows(a.doc)[0],text=target.value,at=text.indexOf(' ',Math.floor(text.length/2));
  target.focus();target.setSelectionRange(at,at);
  if(inputType==='none'){target.value=text.slice(0,at)+'\n'+text.slice(at);target.setSelectionRange(at+1,at+1);target.dispatchEvent(new a.w.Event('input',{bubbles:true}));}// a newline with nothing before it to say so
  else{const ev=new a.w.InputEvent('beforeinput',{inputType,bubbles:true,cancelable:true});target.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented,true,'the browser does not put a newline in the paragraph');}
  await savedOnServer(a,n);await until(()=>/^Saved/.test(savedSaying(a.doc)),30000);
  const server=wordsOf(await draftOf(base,sub));
  assert.ok(server.includes(text.slice(0,at))&&server.includes(text.slice(at).trim()),inputType+' made two paragraphs');
  assert.ok(!server.includes(text),'the old paragraph is gone, not kept with a space');
  assert.deepEqual(edsOf(a.doc),server);
 }
});

// ---- version three beside version two: the device, and the bar Read and Check borrow ----
test('version three\'s Write keeps his unsaved words under its own key and never reads, writes, adopts or deletes version two\'s',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]},'/api/study-draft/save':[500,{error:'down'}]};
 const old=JSON.stringify({v:2,at:1,draft:'h1',edits:[['r0','Words only version two kept.','First words.']],added:[],sent:[],base:[]});
 const seeded=await page({hash:'#/write/s1?piece=o1',answers});await settle(150);
 seeded.w.localStorage.setItem('ar-v2-write:b1',old);
 seeded.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});seeded.w.location.hash='#/';await settle(30);seeded.w.v2.go('write/:id',{id:'s1'},{piece:'o1'});await settle(200);
 const t=seeded.doc.querySelector('[data-ed="r0"]');
 assert.equal(t.value,'First words.','version two\'s kept words are not adopted onto version three\'s page');
 t.value='First words, typed in version three.';t.dispatchEvent(new seeded.w.Event('input',{bubbles:true}));
 assert.deepEqual(plain(JSON.parse(seeded.w.localStorage.getItem('ar-v3-write:b1')).edits),[['r0','First words, typed in version three.','First words.']]);
 assert.equal(seeded.w.localStorage.getItem('ar-v2-write:b1'),old,'version two\'s key is exactly as it was');
 await settle(1800);
 // the page is left with the save failing: his words stay on the device under version three's key; leaving never touches version two's
 seeded.w.location.hash='#/';await settle(100);
 assert.equal(seeded.w.localStorage.getItem('ar-v2-write:b1'),old);
 assert.ok(seeded.w.localStorage.getItem('ar-v3-write:b1'),'his unsaved words are still kept');
 const keys=[...Array(seeded.w.localStorage.length)].map((_,i)=>seeded.w.localStorage.key(i)).filter(k=>/^ar-v[23]-write/.test(k)).sort();
 assert.deepEqual(keys,['ar-v2-write:b1','ar-v3-write:b1']);
 for(const f of ['write.js','write-page.js','write-margin.js','write-versions.js'])assert.doesNotMatch(read('public/v3/screens/'+f).replace(/^\/\*[\s\S]*?\*\//,''),/ar-v2-write/,f+' never names version two\'s key');
});

test('Write, Read and Check in version three share one bar: one band, one piece bar, the subject named, the open mode marked',async()=>{
 const answers={'/api/subject/standing':standing,'/api/study/outputs':{outputBindings:[{outputId:'o1',wordOwner:{kind:'native',bindingId:'b1'}}]},'/api/study-draft/read':draft(['First words.']),'/api/study-ai/requests':{items:[]},'/api/study-ai/read':{sourceCatalog:[]},'/api/study-draft/check':[404,{error:'none'}]};
 const seen={};
 for(const mode of ['write','read','check']){
  const {doc}=await page({hash:`#/${mode}/s1?piece=o1`,answers});await settle(250);
  assert.equal(doc.querySelectorAll('.wr-bar').length,1,mode+': one piece bar');
  assert.equal(doc.querySelectorAll('.v3-band').length,1,mode+': one band');assert.equal(doc.querySelector('.v2-top'),null,mode+': no version two top bar');
  assert.equal(doc.querySelector('.wr-bar .wr-back span').textContent,'Invented piece',mode+': the way back names the subject on every tab');
  assert.equal(doc.querySelector('.wr-bar .wr-seg [aria-current]').textContent.toLowerCase(),mode);
  assert.deepEqual([...doc.querySelectorAll('.wr-bar .wr-seg>*')].map(e=>e.textContent),['Write','Read','Check']);
  assert.equal(doc.querySelectorAll('.wr-bar .wr-tabs a[aria-current]').length,1,mode+': the piece tab');
  seen[mode]=doc.querySelector('.wr-bar .wr-tabs').innerHTML.replace(/#\/(write|read|check)\//g,'#/X/');
 }
 assert.equal(seen.write,seen.read);assert.equal(seen.read,seen.check,'the same tabs on all three');
});


// ---- Undo in the bar only takes back the latest saved change, and nothing it takes back is ever gone ----
const undoBtn=doc=>doc.querySelector('.wr-bar [data-wr="undo"]');
const undoCalls=pg=>pg.calls.filter(c=>c.path==='/api/study-draft/undo');
const barShape=doc=>{const b=doc.querySelector('.wr-bar');return JSON.stringify({kids:[...b.children].map(c=>c.className),tools:[...b.querySelectorAll('.wr-tools button')].map(x=>x.dataset.wr),status:[...b.querySelector('[data-wr-status]').children].map(c=>c.tagName+(c.dataset.wr||'')),lines:b.querySelectorAll('br').length});};
const barText=doc=>doc.querySelector('.wr-bar [data-wr-status]').textContent.replace(/\s+/g,' ').trim();
const putBackBtn=doc=>doc.querySelector('.wr-bar [data-wr="putback"]');
const askBox=doc=>doc.querySelector('[data-wr-undo]');
const clickWr=(doc,wr)=>doc.querySelector(`[data-wr="${wr}"]`).click();
const taken=doc=>until(()=>!putBackBtn(doc).hidden);
const paras=doc=>[...doc.querySelectorAll('.wr-ed')].filter(t=>t.value&&t.tagName!=='H2');// drawn again after each save, so asked for again each time

test('real server: a stretch offline, then Undo: the unsaved words stay, nothing is taken back, and the four paragraphs saved after are asked about first and can be put back exactly',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'circle-of-twelve');
 const pg=await livePage(base,sub),{w,doc}=pg;
 const before=wordsOf(await draftOf(base,sub)),shape=barShape(doc);
 const rows=paras(doc).slice(0,4);assert.equal(rows.length,4,'the demo piece has four paragraphs');
 w.__down=true;
 const typed=rows.map((r,i)=>r.value+' Typed offline, paragraph '+(i+1)+'.');
 rows.forEach((r,i)=>{type(w,r,typed[i]);blur(w,r);});
 await until(()=>/Not saved/.test(barText(doc)),20000);
 assert.equal(undoBtn(doc).disabled,true,'Undo is off while the app does not answer and words are unsaved');
 assert.match(undoBtn(doc).getAttribute('aria-label'),/not answering, so your words are not saved/);assert.equal(undoBtn(doc).title,undoBtn(doc).getAttribute('aria-label'));
 assert.equal(barShape(doc),shape,'nothing in the bar moved or was added');
 undoBtn(doc).click();await settle(100);
 assert.equal(undoCalls(pg).length,0,'nothing was sent to the app');
 assert.deepEqual(edsOf(doc).filter(x=>/Typed offline/.test(x)),typed,'every typed sentence is still on the page');
 assert.equal(key(w,sub.binding).edits.length,4,'and on the device');
 // the connection returns and the four paragraphs are saved in one save
 w.__down=false;clickWr(doc,'retry');await quiet(doc);
 assert.deepEqual(wordsOf(await draftOf(base,sub)).filter(x=>/Typed offline/.test(x)),typed);
 const save=pg.calls.filter(c=>c.path==='/api/study-draft/save'&&c.status===200).at(-1);assert.equal(save.body.operations.length,4,'one save carried the four paragraphs');
 assert.equal(undoBtn(doc).disabled,false);assert.equal(undoBtn(doc).getAttribute('aria-label'),'Undo');
 // Undo asks, in place, before it takes anything back
 undoBtn(doc).click();await until(()=>!askBox(doc).hidden);
 assert.match(askBox(doc).textContent,/This takes back 4 paragraphs saved at \d\d:\d\d\./);
 assert.deepEqual([...askBox(doc).querySelectorAll('button')].map(b=>b.textContent),['Take back 4 paragraphs','Keep them']);
 assert.equal(undoCalls(pg).length,0,'asking takes nothing back');assert.deepEqual(wordsOf(await draftOf(base,sub)).filter(x=>/Typed offline/.test(x)),typed);
 clickWr(doc,'undo-no');assert.equal(askBox(doc).hidden,true);await settle(100);
 assert.equal(undoCalls(pg).length,0);assert.deepEqual(edsOf(doc).filter(x=>/Typed offline/.test(x)),typed,'Keep them leaves everything');
 // Take back: the words go from the page and the server, and Put back is offered on the bar's one line
 undoBtn(doc).click();await until(()=>!askBox(doc).hidden);clickWr(doc,'undo-yes');await taken(doc);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before);assert.deepEqual(edsOf(doc),before);
 assert.match(barText(doc),/Taken back 4 paragraphs/);assert.equal(putBackBtn(doc).textContent,'Put back');assert.equal(barShape(doc),shape,'the bar has the same parts, on the same line');
 const copy=JSON.parse(w.localStorage.getItem('ar-v3-write-back:'+sub.binding));assert.deepEqual(copy.before.map(e=>e.words),typed,'the four paragraphs, as they stood before Undo, are kept on the device');
 // Put back: those exact words, as a new save in his name, with the revision he read
 const read=await draftOf(base,sub);
 clickWr(doc,'putback');await until(()=>/^Saved/.test(barText(doc)),20000);
 const again=pg.calls.filter(c=>c.path==='/api/study-draft/save'&&c.status===200).at(-1);
 assert.deepEqual(plain(again.body.expected),plain(read.expected),'saved against the version he read, never forced');assert.equal('force' in again.body,false);
 assert.deepEqual(wordsOf(await draftOf(base,sub)).filter(x=>/Typed offline/.test(x)),typed,'the exact words are back on the server');
 assert.deepEqual(edsOf(doc).filter(x=>/Typed offline/.test(x)),typed);assert.equal(putBackBtn(doc).hidden,true);assert.equal(w.localStorage.getItem('ar-v3-write-back:'+sub.binding),null);
});

test('real server: Undo is off, in its place, while words are unsaved and while a save runs, and says why; typing is the browser\'s to undo',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'ink-on-warm-paper');
 const pg=await livePage(base,sub,{slowSave:2500}),{w,doc}=pg,shape=barShape(doc),t=longRows(doc)[0];
 type(w,t,t.value+' Unsaved.');
 assert.equal(undoBtn(doc).disabled,true);assert.match(undoBtn(doc).title,/not saved yet.*Ctrl or Cmd Z/);assert.equal(barShape(doc),shape);
 undoBtn(doc).click();assert.equal(undoCalls(pg).length,0);
 blur(w,t);await until(()=>/Saving/.test(barText(doc)));
 assert.equal(undoBtn(doc).disabled,true);assert.match(undoBtn(doc).title,/Saving\. Undo is ready when the save is done/);assert.equal(barShape(doc),shape);
 await quiet(doc);assert.equal(undoBtn(doc).disabled,false);assert.equal(undoBtn(doc).title,'Undo');assert.equal(barShape(doc),shape);
 // the phone's bottom bar has the same Undo, in the same state
 type(w,paras(doc)[0],paras(doc)[0].value+' More.');assert.equal([...doc.querySelectorAll('[data-wr="undo"]')].every(b=>b.disabled&&/not saved yet/.test(b.title)),true);
 assert.equal(undoCalls(pg).length,0);
 // no key of the page takes the browser's own Undo from the paragraph
 for(const init of [{key:'z',ctrlKey:true},{key:'z',metaKey:true}]){const e=new w.KeyboardEvent('keydown',{...init,bubbles:true,cancelable:true});t.dispatchEvent(e);assert.equal(e.defaultPrevented,false,'Ctrl or Cmd Z is left to the browser');}
});

test('real server: Undo never reaches past a latest save that cannot be undone, and never takes back an older one',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'studio-after-rain');
 const pg=await livePage(base,sub),{w,doc}=pg;
 {const r=paras(doc)[0];type(w,r,r.value+' First change.');blur(w,r);await quiet(doc);}
 w.__nocan='all';// the app will say the next save cannot be undone
 {const r=paras(doc)[1];type(w,r,r.value+' Second change.');blur(w,r);}await until(()=>pg.calls.filter(c=>c.path==='/api/study-draft/save'&&c.status===200).length>=2);await quiet(doc);
 assert.equal(undoBtn(doc).disabled,true);assert.match(undoBtn(doc).title,/can no longer be undone, so Undo leaves everything as it is/);
 undoBtn(doc).click();await settle(100);assert.equal(undoCalls(pg).length,0);
 assert.deepEqual(wordsOf(await draftOf(base,sub)).filter(x=>/change\./.test(x)).length,2,'both changes are still saved');
 // the page thinks it can, the app's fresh answer says it cannot: nothing is sent
 w.__nocan='reads';
 const pg2=await livePage(base,sub);w.close();pg2.w.__nocan=null;
 {const t=paras(pg2.doc)[2];type(pg2.w,t,t.value+' Third change.');blur(pg2.w,t);}await quiet(pg2.doc);
 pg2.w.__nocan='reads';undoBtn(pg2.doc).click();
 await until(()=>/nothing was taken back/.test(pg2.doc.querySelector('#v2-messages')?.textContent||''));
 assert.equal(undoCalls(pg2).length,0);assert.ok(wordsOf(await draftOf(base,sub)).some(x=>/Third change\./.test(x)));
});

test('real server: a page opened as an agent has no working Undo',{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'circle-of-twelve');
 const pg=await livePage(base,sub,{search:'?reviewActor=agent:codex'});
 assert.equal(undoBtn(pg.doc).disabled,true);assert.match(undoBtn(pg.doc).title,/Only Adrian writes here/);
 undoBtn(pg.doc).click();await settle(100);assert.equal(undoCalls(pg).length,0);assert.equal(pg.doc.querySelector('[data-wr="putback"]').hidden,true);
});

test('real server: Put back after one paragraph is taken back; when the app\'s version has moved on it becomes the newer-version choice and overwrites nothing',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'shade-and-patience');
 const pg=await livePage(base,sub),{w,doc}=pg,before=wordsOf(await draftOf(base,sub)),t=longRows(doc)[0];
 const words=t.value+' One more sentence.';
 type(w,t,words);blur(w,t);await quiet(doc);
 undoBtn(doc).click();await taken(doc);// one paragraph: no question
 assert.equal(askBox(doc).hidden,true);assert.deepEqual(wordsOf(await draftOf(base,sub)),before);assert.match(barText(doc),/Taken back 1 paragraph/);
 // another window of his saves a different paragraph meanwhile
 const adrian=clientModule().createClient({base,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:base}:{})}})});
 const mid=await adrian.call('study-draft.read',{bindingId:sub.binding,parentStudyId:sub.id}),other=mid.projection.filter(r=>r.safe!==false&&r.words).at(-1);
 await adrian.call('study-draft.save',{bindingId:sub.binding,parentStudyId:sub.id,expected:mid.expected,operations:[{kind:'text',id:other.id,from:0,to:0,insert:'Elsewhere: ',seenBlockHash:other.blockHash}]});
 clickWr(doc,'putback');
 // The other change touched another paragraph only, so his put back words go on top of it and nothing is overwritten.
 await until(()=>doc.querySelector('[data-wr-conflict] [data-wr-side="merged"]'));
 assert.equal(doc.querySelector('.wr-two'),null,'no paragraph was changed in both places');
 await quiet(doc);
 const done=wordsOf(await draftOf(base,sub));assert.ok(done.includes(words),'his words are back');assert.ok(done.some(x=>x.startsWith('Elsewhere: ')),'the other change is intact');
});

test('real server: a paragraph written new, saved and taken back comes back with Put back, once, with the same words',{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'straw-over-the-rows');
 const pg=await livePage(base,sub),{w,doc}=pg,before=wordsOf(await draftOf(base,sub));
 const tail=[...doc.querySelectorAll('.wr-ed')].at(-1),words='A closing paragraph, taken back and put back again.';
 type(w,tail,words);blur(w,tail);await quiet(doc);assert.equal(wordsOf(await draftOf(base,sub)).at(-1),words);
 undoBtn(doc).click();await taken(doc);assert.deepEqual(wordsOf(await draftOf(base,sub)),before);
 clickWr(doc,'putback');await until(()=>/^Saved/.test(barText(doc)),20000);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),[...before,words],'once, at the end, the same words');
 assert.deepEqual(edsOf(doc),[...before,words]);
});

test('real server: a reload straight after Undo keeps the taken back words on the device and offers Put back again; typing over them ends the offer and keeps them in Copy all my words',{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup');
 const a=await livePage(base,sub),before=wordsOf(await draftOf(base,sub)),t=longRows(a.doc)[1],words=t.value+' Written, saved, then taken back.';
 type(a.w,t,words);blur(a.w,t);await quiet(a.doc);
 undoBtn(a.doc).click();await taken(a.doc);assert.deepEqual(wordsOf(await draftOf(base,sub)),before);
 const kept=JSON.parse(a.w.localStorage.getItem('ar-v3-write-back:'+sub.binding));assert.ok(kept.before.some(e=>e.words===t.value.replace(/ Written.*$/,'')||e.words===words),'kept on the device');
 // a reload: only the device's keys stay
 const b=await reload(a,base,sub);
 assert.equal(putBackBtn(b.doc).hidden,false,'Put back is offered again after the reload');assert.match(barText(b.doc),/Taken back 1 paragraph/);
 clickWr(b.doc,'putback');await until(()=>/^Saved/.test(barText(b.doc)),20000);
 assert.ok(wordsOf(await draftOf(base,sub)).includes(words),'the exact words are back');assert.equal(b.w.localStorage.getItem('ar-v3-write-back:'+sub.binding),null);
 // taken back once more, then typed over: the offer ends and the words are still on the device, in Copy all my words
 undoBtn(b.doc).click();await taken(b.doc);
 const u=longRows(b.doc)[1],gone=JSON.parse(b.w.localStorage.getItem('ar-v3-write-back:'+sub.binding)).before.map(e=>e.words);
 b.w.__down=true;type(b.w,u,u.value+' Typed over.');
 assert.equal(putBackBtn(b.doc).hidden,true,'typing over those paragraphs ends the offer');
 assert.equal(JSON.parse(b.w.localStorage.getItem('ar-v3-write-back:'+sub.binding)).ended,true);
 blur(b.w,u);await until(()=>!b.doc.querySelector('[data-wr-fail]').hidden,20000);
 let copied=null;Object.defineProperty(b.w.navigator,'clipboard',{configurable:true,value:{writeText:async x=>{copied=x;}}});
 b.doc.querySelector('[data-wr-fail] [data-wr="copy"]').click();await settle(50);
 assert.ok(gone.length&&gone.every(x=>copied.includes(x)),'the taken back words are in what is copied');assert.match(copied,/Taken back with Undo:/);
 // and a reload after that does not offer them again or put them on the page
 const c=await reload(b,base,sub);
 assert.equal(putBackBtn(c.doc).hidden,true);assert.equal(edsOf(c.doc).some(x=>gone.includes(x)&&!wordsOf({projection:[]}).length&&false),false);
});
