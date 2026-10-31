import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./research-tab.js',import.meta.url),'utf8');
const point=(id,kind,extra={})=>({id,title:'Finding '+id,kind,clarity:{supported:'Said twice.',uncertain:''},spoken:[{quote:'Words '+id,speaker:'Invented speaker',location:'00:01'}],sources:[{name:'Invented transcript.md',lineStart:1,lineEnd:3}],originalText:'Invented passage.',...extra});
function fixture({findings={},status=200}={}){
 const dom=new JSDOM('<header id="c3-tabstrip"><button data-ht-research>R</button><button data-ht-home>H</button></header><div id="app"><main class="workspace"><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.state={project:'hk',projects:[{id:'hk',name:'Invented piece one'},{id:'ref-an-cha',name:'Invented piece two'},{id:'other',name:'Not connected piece'}]};
 const calls=[],posts=[];let fail=false;
 w.current=()=>w.state.projects.find(p=>p.id===w.state.project);
 w.viewPhase=async n=>{calls.push(['viewPhase',n]);};
 w.switchProject=async id=>{if(fail)return;calls.push(['switchProject',id]);w.state.project=id;};
 w.fetch=async(u,o)=>{if(o&&o.method&&o.method!=='GET')posts.push(u);const url=new URL(u,'http://localhost');const pid=url.searchParams.get('parentStudyId');calls.push(['read',url.pathname,pid]);return {ok:status===200,json:async()=>findings[pid]||{available:false,reason:'No saved research findings for this piece yet.'}};};
 w.eval(code);
 const settle=async()=>{for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,0));await w.c3Research.whenIdle();}};
 return {w,d:w.document,calls,posts,settle,set fail(v){fail=v;}};
}
const json=v=>JSON.parse(JSON.stringify(v));

test('Research reads saved findings only for connected pieces, through the read-only route',async()=>{
 const f=fixture({findings:{hk:{available:true,points:[point('a','fact'),point('b','wisdom')]},'ref-an-cha':{available:true,points:[point('c','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 assert.deepEqual(json(f.calls.filter(c=>c[0]==='read').map(c=>[c[1],c[2]])),[['/api/study-research/findings','hk'],['/api/study-research/findings','ref-an-cha']]);
 assert.deepEqual(json([...f.d.querySelectorAll('.rt-col .rt-colt')].map(n=>n.textContent)),['Fact','Wisdom']);
 assert.equal(f.d.querySelectorAll('.rt-card').length,3);
 assert.equal(f.posts.length,0,'nothing is written');
 assert.equal(f.d.querySelector('#manuscript').textContent,'Unsaved human writing');
});

test('no saved findings is said plainly with each piece’s reason; never filled with examples',async()=>{
 const f=fixture();
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 assert.match(f.d.querySelector('.rt-c3-empty h3').textContent,/No saved findings yet/);
 assert.ok(f.d.querySelector('.rt-c3-empty [data-rt-decide]'),'a real next step: research a piece');
 assert.match(f.d.querySelector('.rt-note').textContent,/Invented piece one: No saved research findings/);
 assert.equal(f.d.querySelectorAll('.rt-card').length,0);
});

test('reader shows the finding; outside search, Atlas and model discussion are marked not connected',async()=>{
 const f=fixture({findings:{hk:{available:true,verification:'Source text checked; no independent fact check.',points:[point('a','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-open="0"]').click();
 const drawer=f.d.querySelector('.rt-drawer');
 assert.match(drawer.textContent,/Words a/);
 assert.match(drawer.textContent,/no independent fact check/);
 f.d.querySelector('[data-rt-more]').click();
 const more=[...f.d.querySelectorAll('.rt-menu button')];
 assert.equal(more.length,3);
 assert.ok(more.every(b=>b.disabled&&/not connected/.test(b.textContent)));
});

test('deciding goes to the piece’s own Research through switchProject; a refused switch stays put',async()=>{
 const f=fixture({findings:{'ref-an-cha':{available:true,points:[point('c','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-open="0"]').click();
 f.d.querySelector('[data-rt-decide]').click();await f.settle();
 assert.deepEqual(json(f.calls.filter(c=>c[0]!=='read')),[['switchProject','ref-an-cha'],['viewPhase',3]]);
 assert.equal(f.w.c3Research.isOpen(),false);
 const g=fixture({findings:{'ref-an-cha':{available:true,points:[point('c','fact')]}}});
 g.fail=true;
 g.d.querySelector('[data-ht-research]').click();await g.settle();
 g.d.querySelector('[data-rt-open="0"]').click();
 g.d.querySelector('[data-rt-decide]').click();await g.settle();
 assert.equal(g.w.current().id,'hk');
 assert.equal(g.calls.some(c=>c[0]==='viewPhase'),false);
});

test('search, evidence and source filters narrow without hiding the way back',async()=>{
 const f=fixture({findings:{hk:{available:true,points:[point('a','fact'),point('b','wisdom',{clarity:{supported:'',uncertain:'Only one source.'}})]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-ev="uncertain"]').click();
 assert.equal(f.d.querySelectorAll('.rt-card').length,1);
 assert.ok(f.d.querySelector('[data-rt-clear]'));
 f.d.querySelector('[data-rt-clear]').click();
 assert.equal(f.d.querySelectorAll('.rt-card').length,2);
 const q=f.d.querySelector('[data-rt-q]');q.value='zzz';q.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 assert.match(f.d.querySelector('.rt-empty h2').textContent,/No findings match/);
});

test('each card has a ⋯ menu: reader, source, decide; outside tools stay not connected',async()=>{
 const f=fixture({findings:{hk:{available:true,points:[point('a','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-cmore="0"]').click();
 const items=[...f.d.querySelectorAll('.rt-cmenu button')].map(b=>[b.textContent,b.disabled]);
 assert.deepEqual(json(items),[['Open in the reader',false],['Show only Invented transcript.md',false],['Decide in Invented piece one',false],['Search outside sources · not connected',true],['Ask about this point · not connected',true]]);
 f.d.querySelector('.rt-cmenu [data-rt-open]').click();
 assert.ok(f.d.querySelector('.rt-drawer'));
 assert.equal(f.d.querySelector('.rt-cmenu'),null);
});

test('native global research keeps source-picked inquiry and notebook on the exact selected subject',async()=>{const f=fixture(),bindingId='44444444-4444-4444-8444-444444444444',parentStudyId='structure-test-native',projectId='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222',answerId='33333333-3333-4333-8333-333333333333';try{f.w.state.projects.push({id:parentStudyId,name:'Native subject'});f.w.state.project=parentStudyId;f.w.studyDraft={currentBinding:()=>({id:bindingId,parentStudyId})};let answer=null,savedNote;f.w.studyHumanDirection={readNotebook:async scope=>{assert.equal(scope.parentStudyId,parentStudyId);assert.equal(scope.bindingId,bindingId);return{record:{body:'Original shared notes.'},prose:'Original shared notes.',entries:savedNote?[savedNote]:[]};},appendNotebook:async(input,assertCurrent)=>{assertCurrent();savedNote={...input,author:'agent:codex',decisionRole:'stand-in'};return{entry:savedNote};}};const original=f.w.fetch;f.w.fetch=async(url,options)=>{const parsed=new URL(url,'http://localhost');if(!parsed.pathname.startsWith('/api/study/research'))return original(url,options);if(parsed.pathname==='/api/study/research'){assert.equal(parsed.searchParams.get('bindingId'),bindingId);assert.equal(parsed.searchParams.get('parentStudyId'),parentStudyId);return{ok:true,json:async()=>({bindingId,parentStudyId,projectId,sources:[{id:sourceId,title:'Exact source',hash:'a'.repeat(64)}],records:answer?[answer]:[],canPrepare:true,canRun:true,canKeep:true})};}const body=JSON.parse(options.body);f.posts.push({url,body});assert.equal(body.bindingId,bindingId);assert.equal(body.parentStudyId,parentStudyId);const status=parsed.pathname.endsWith('/prepare')?'preview':parsed.pathname.endsWith('/run')?'result-ready':'result-ready';answer={id:answerId,projectId,status,question:body.question||answer?.question,studyScope:{binding:{bindingId,parentStudyId}},sourceIds:[sourceId],sources:[{id:sourceId,hash:'a'.repeat(64)}],...(status==='result-ready'?{answer:{body:'Recorded learning.',excerpts:[{sourceId,quote:'Exact source words.'}]},finalizationVerified:true}:{}),...(parsed.pathname.endsWith('/keep')?{keptAt:'2026-10-31'}:{})};return{ok:true,json:async()=>answer};};f.w.c3Research.show();await f.settle();const inquiry=f.d.querySelector('[data-rt-inquiry]');inquiry.value='Explain the source.';inquiry.dispatchEvent(new f.w.Event('input',{bubbles:true}));const source=f.d.querySelector('[data-rt-inquiry-source]');source.checked=true;source.dispatchEvent(new f.w.Event('change',{bubbles:true}));f.d.querySelector('[data-rt-prepare]').click();await f.settle();assert.deepEqual(json(f.posts[0].body.sourceIds),[sourceId]);f.d.querySelector('[data-rt-run]').click();await f.settle();assert.match(f.d.querySelector('.rt-learning-answer').textContent,/Recorded learning/);f.d.querySelector('[data-rt-keep]').click();await f.settle();assert.equal(f.d.querySelector('[data-rt-keep]').textContent,'Kept');f.d.querySelector('[data-rt-panel="notebook"]').click();await f.settle();const note=f.d.querySelector('[data-rt-note]');note.value='My exact notebook observation.';note.dispatchEvent(new f.w.Event('input',{bubbles:true}));f.d.querySelector('[data-rt-save-note]').click();await f.settle();assert.equal(savedNote.parentStudyId,parentStudyId);assert.equal(savedNote.bindingId,bindingId);assert.equal(savedNote.kind,'note');assert.equal(savedNote.origin,null);assert.match(f.d.querySelector('.rt-notebook-record').textContent,/agent:codex · stand-in/);assert.equal(f.d.getElementById('manuscript').textContent,'Unsaved human writing');assert.equal(f.calls.some(call=>call[0]==='switchProject'),false);}finally{f.w.close();}});

test('scoped Brief prepares and explicitly runs existing files with truthful agent source use, then reopens without resending',async()=>{const f=fixture(),parentStudyId='structure-test-brief',bindingId='44444444-4444-4444-8444-444444444444',projectId='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333',posts=[];try{f.w.arCreateUiActor={actor:'agent:codex'};f.w.state.projects.push({id:parentStudyId,name:'Brief subject'});f.w.state.project=parentStudyId;f.w.studyDraft={currentBinding:()=>({id:bindingId,parentStudyId})};f.w.studyHumanDirection={readNotebook:async()=>({record:{},entries:[]})};let view={bindingId,parentStudyId,projectId,revision:0,hash:'a'.repeat(64),sourceIds:[],materials:[],canPrepare:true,canRun:true,agentStandIn:true};const original=f.w.fetch;f.w.fetch=async(url,options)=>{if(url.startsWith('/api/study/research/brief')){if(options?.method==='POST'){const body=JSON.parse(options.body);posts.push({url,body});assert.equal(body.bindingId,bindingId);assert.equal(body.parentStudyId,parentStudyId);assert.equal(body.humanDecision,undefined);assert.equal(body.sourceReviews,undefined);view={...view,research:url.endsWith('/prepare')?{requestId,status:'preview',question:body.question,sourceIds:body.sourceIds}:{...view.research,status:'result-ready',body:'## Evidence\n\nSource claims remain attributed.',brief:'## Working brief\n\nA readable saved synthesis.'},directions:url.endsWith('/run')?[{title:'Possible angle',angle:'An unadopted possibility.',reason:'Based on source words.'}]:[]};}return{ok:true,json:async()=>view};}if(url.startsWith('/api/study/research?'))return{ok:true,json:async()=>({bindingId,parentStudyId,projectId,sources:[{id:sourceId,title:'Current source',hash:'b'.repeat(64)}],records:[]})};return original(url,options);};await f.w.c3Research.openBrief({bindingId,parentStudyId});await f.settle();let question=f.d.querySelector('[data-rt-brief-question]');question.value='What should this brief explain?';question.dispatchEvent(new f.w.Event('input',{bubbles:true}));const source=f.d.querySelector('[data-rt-inquiry-source]');source.checked=true;source.dispatchEvent(new f.w.Event('change',{bubbles:true}));f.d.querySelector('[data-rt-brief-prepare]').click();await f.settle();assert.equal(posts.length,1);assert.deepEqual(json(posts[0].body.sourceIds),[sourceId]);f.d.querySelector('[data-rt-brief-run]').click();await f.settle();assert.equal(posts.length,2);assert.equal(posts[1].body.requestId,requestId);assert.match(f.d.querySelector('.rt-shared-brief').textContent,/A readable saved synthesis/);assert.match(f.d.querySelector('.rt-shared-brief').textContent,/Possible directions · unadopted/);f.w.c3Research.hide();await f.w.c3Research.openBrief({bindingId,parentStudyId});await f.settle();assert.match(f.d.querySelector('.rt-shared-brief').textContent,/A readable saved synthesis/);assert.equal(posts.length,2);assert.equal(f.d.getElementById('manuscript').textContent,'Unsaved human writing');}finally{f.w.close();}});

test('human Brief preparation requires explicit current source review and sends exact review hashes',async()=>{const f=fixture(),parentStudyId='human-brief',bindingId='44444444-4444-4444-8444-444444444444',projectId='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222',posts=[];try{f.w.arCreateUiActor={actor:'human:adrian'};f.w.state.projects.push({id:parentStudyId,name:'Human brief'});f.w.state.project=parentStudyId;f.w.studyDraft={currentBinding:()=>({id:bindingId,parentStudyId})};f.w.studyHumanDirection={readNotebook:async()=>({record:{},entries:[]})};const view={bindingId,parentStudyId,projectId,canPrepare:true,canRun:true};const original=f.w.fetch;f.w.fetch=async(url,options)=>{if(url.startsWith('/api/study/research/brief')){if(options?.method==='POST')posts.push(JSON.parse(options.body));return{ok:true,json:async()=>view};}if(url.startsWith('/api/study/research?'))return{ok:true,json:async()=>({...view,sources:[{id:sourceId,title:'Exact source',hash:'a'.repeat(64)}],records:[]})};return original(url,options);};await f.w.c3Research.openBrief({bindingId,parentStudyId});await f.settle();const input=f.d.querySelector('[data-rt-brief-question]');input.value='What matters here?';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));const source=f.d.querySelector('[data-rt-inquiry-source]');source.checked=true;source.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.d.querySelector('[data-rt-brief-prepare]').disabled,true);const review=f.d.querySelector('[data-rt-source-confirm]');review.checked=true;review.dispatchEvent(new f.w.Event('change',{bubbles:true}));f.d.querySelector('[data-rt-brief-prepare]').click();await f.settle();assert.equal(posts.length,1);assert.equal(posts[0].humanDecision,true);assert.deepEqual(json(posts[0].sourceReviews),[{sourceId,hash:'a'.repeat(64)}]);}finally{f.w.close();}});

test('opening global Research closes the owned Research sheet through its return owner without replacing writing',async()=>{const f=fixture();try{const writer=f.d.getElementById('manuscript'),text=writer.firstChild,range=f.d.createRange();range.setStart(text,3);range.setEnd(text,8);f.w.getSelection().removeAllRanges();f.w.getSelection().addRange(range);writer.scrollTop=23;const sheet=f.d.createElement('section');sheet.dataset.combinedSheet='research';f.d.body.append(sheet);let closes=0;f.w.combinedSheets={state:()=>sheet.isConnected?{kind:'research',projectId:'hk'}:null,close:()=>{closes++;sheet.remove();writer.scrollTop=23;}};f.w.c3Research.show();await f.settle();assert.equal(closes,1);assert.equal(sheet.isConnected,false);assert.equal(f.d.getElementById('manuscript'),writer);assert.equal(f.w.getSelection().anchorNode,text);assert.equal(f.w.getSelection().anchorOffset,3);assert.equal(f.w.getSelection().focusOffset,8);assert.equal(writer.scrollTop,23);assert.equal(f.w.c3Research.isOpen(),true);assert.equal(f.posts.length,0);}finally{f.w.close();}});
