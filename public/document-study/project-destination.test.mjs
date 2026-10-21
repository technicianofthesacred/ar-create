import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const study=fs.readFileSync(new URL('./study.js',import.meta.url),'utf8'),draft=fs.readFileSync(new URL('./draft-flow.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(t,{background=false,reader=false}={}){
 const dom=new JSDOM('<main id="app"><div id="workspace"></div></main>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,calls=[],renders=[];
 t.after(()=>dom.window.close());
 w.state={project:'source',variant:'visible',projects:['source','target','other'].map(id=>({id,name:id,title:id,view:id==='target'?'article':'record',viewedStage:id==='target'?5:6,slides:[{id:'slide'}],blocks:[{id:id+'-words',tag:'p',html:id+' exact browser words'}],history:[],note:null,originalNotes:[],positions:{'stage-6':71,article:91},rev:1}))};
 w.current=()=>w.state.projects.find(p=>p.id===w.state.project);w.esc=String;w.readonlyHTML=x=>x;w.WORKFLOW_RECORDS={};w.viewKey=p=>p.view==='record'?'stage-'+p.viewedStage:p.view;w.carouselSession=null;w.selected=null;w.activeBlock=null;w.keyboardBlock=null;w.catalogSlide=null;w.modal=null;w.mobileProjects=false;w.marginOpen=false;
 w.commitTyping=()=>{};w.save=()=>{};w.blockHTML=b=>'<p>'+b.html+'</p>';w.article=()=>'<div id="manuscript"></div>';w.phaseReader=()=>'<p>Retained exact words</p>';w.render=()=>{renders.push({id:w.current().id,view:w.current().view,stage:w.current().viewedStage});w.document.querySelector('#app').innerHTML='<div id="workspace"></div>';w.document.querySelector('#workspace').scrollTop=w.current().positions?.[w.viewKey(w.current())]??w.current().scroll??0;};w.onTyping=()=>{};w.viewPhase=stage=>{w.current().viewedStage=stage;w.current().view='record';w.render()};w.setView=view=>{w.current().view=view;w.render()};
 for(const name of ['undo','workflowBar','refreshDiscussion','historicalNotice','wireDocument','openInstruction'])w[name]=()=>'';
 if(background)w.EventSource=function(){};w.fetch=async url=>{calls.push(url);if(new URL(url,w.location.href).pathname.endsWith('/catalog'))return {ok:true,json:async()=>({drafts:[{parentStudyId:'target',parentStudyKey:'target',originalId:'target-original'}]})};throw Error('No native copy may open: '+url)};
 w.localStorage.setItem('ar-document-study-draft-pieces-v1',JSON.stringify({ids:['target']}));
 w.eval(study.slice(study.indexOf('function rememberPosition()'),study.indexOf('function setView(view)')));
 if(reader){w.eval(study.match(/^function readonlyHTML\(html\).*$/m)[0]);w.eval(study.match(/^function blockHTML\(b\).*$/m)[0]);const start=study.indexOf('function browserWordsReader(p)');w.eval(study.slice(start<0?study.indexOf('function phaseReader(p)'):start,study.indexOf('function shortRecordName')));w.compactRecordPage=record=>'<article class="recordPage">'+record.html+'</article>';const previousRender=w.render;w.render=()=>{previousRender();if(w.current().view==='record'&&w.current().viewedStage===6)w.document.querySelector('#workspace').innerHTML=w.phaseReader(w.current());};}
 w.eval(draft);
 return {w,calls,renders,projects:w.state.projects,intent:destination=>({destination,originProjectId:w.current().id}),library(){w.CSS={escape:String};w.projectBrowser=()=>'';w.eval(fs.readFileSync(new URL('./project-library.js',import.meta.url),'utf8'));}};
}
test('retained Read intent precedes first supported Write destination render without opening a copy',async t=>{
 const f=fixture(t),source=f.projects[0],target=f.projects[1];f.w.document.querySelector('#workspace').scrollTop=134;
 await f.w.switchProject('target',f.intent('retained-read'));await tick();
 assert.equal(f.w.current(),target);assert.equal(target.view,'record');assert.equal(target.viewedStage,6);assert.equal(source.positions['stage-6'],134);
 assert.ok(f.renders.length);assert.ok(f.renders.every(r=>r.id!=='target'||r.view==='record'&&r.stage===6));assert.equal(f.calls.some(url=>url.endsWith('/open')||url.includes('/read?')),false);
});
test('carousel intent precedes first render and preserves exact browser text and slide identities',async t=>{
 const f=fixture(t),target=f.projects[1],blocks=JSON.stringify(target.blocks),slides=JSON.stringify(target.slides);
 await f.w.switchProject('target',f.intent('carousel-words'));await tick();
 assert.equal(target.view,'carousel');assert.equal(target.outputMode,'words');assert.ok(f.renders.every(r=>r.id!=='target'||r.view==='carousel'));assert.equal(JSON.stringify(target.blocks),blocks);assert.equal(JSON.stringify(target.slides),slides);assert.equal(f.calls.some(url=>url.endsWith('/open')),false);
});
test('dirty or failed origin flush cannot mutate either destination or replace origin editor',async t=>{
 for(const failure of ['dirty','failed']){const f=fixture(t),before=JSON.stringify(f.projects),editor=f.w.document.querySelector('#workspace');f.w.studyDraft.flush=async()=>{if(failure==='failed')throw Error('Synthetic save failure');return {dirty:true}};
 await assert.rejects(f.w.switchProject('target',f.intent('retained-read')),/save|changes/i);assert.equal(JSON.stringify(f.projects),before);assert.equal(f.w.current().id,'source');assert.equal(f.w.document.querySelector('#workspace'),editor);}
});
test('unknown projects and malformed or unavailable destination intents refuse unchanged',async t=>{
 const f=fixture(t),before=JSON.stringify(f.projects);
 for(const [id,intent] of [['missing',f.intent('retained-read')],['target',null],['target',{}],['target',{destination:'write',originProjectId:'source'}],['target',{...f.intent('retained-read'),extra:true}],['target',{destination:'retained-read',originProjectId:'other'}]])await assert.rejects(Promise.resolve().then(()=>f.w.switchProject(id,intent)),/project|destination|intent|changed/i);
 f.projects[1].slides=[];await assert.rejects(f.w.switchProject('target',f.intent('carousel-words')),/carousel/i);f.projects[1].slides=[{id:'slide'}];assert.equal(JSON.stringify(f.projects),before);
});
test('later switch and origin changes cancel a pending destination without destination mutation',async t=>{
 const f=fixture(t),before=JSON.stringify(f.projects[1]);let release;const gate=new Promise(r=>release=r);f.w.studyDraft.flush=()=>gate;
 const pending=f.w.switchProject('target',f.intent('retained-read'));await tick();await f.w.switchProject('other');release({dirty:false});await assert.rejects(pending,/changed/i);assert.equal(f.w.current().id,'other');assert.equal(JSON.stringify(f.projects[1]),before);
});
test('same-project optional intent opens the requested view; legacy same-project calls retain their behavior',async t=>{
 const f=fixture(t);f.w.state.project='target';await f.w.switchProject('target',f.intent('retained-read'));assert.equal(f.w.current().view,'record');assert.equal(f.w.current().viewedStage,6);const before=JSON.stringify(f.w.current());await f.w.switchProject('target');assert.equal(JSON.stringify(f.w.current()),before);
});

test('project library forwards the guarded intent including same-project pickup without dirty-destination resume',async t=>{
 const f=fixture(t);f.library();assert.equal(typeof f.w.projectDestination,'function');
 await f.w.switchProject('target',f.intent('retained-read'));assert.equal(f.w.current().view,'record');assert.equal(f.w.current().viewedStage,6);
 await f.w.switchProject('target',f.intent('carousel-words'));assert.equal(f.w.current().view,'carousel');assert.equal(f.w.current().outputMode,'words');assert.equal(f.calls.some(url=>url.endsWith('/open')),false);
});
test('library asynchronous flush rejects a stale origin and later switch before forwarding its destination',async t=>{
 const f=fixture(t);f.library();const target=JSON.stringify(f.projects[1]);let release;const gate=new Promise(r=>release=r);let count=0;f.w.studyOutputConnection={flush:()=>++count===1?gate:Promise.resolve()};
 const pending=f.w.switchProject('target',f.intent('retained-read'));await f.w.switchProject('other');release();await assert.rejects(pending,/changed/i);assert.equal(f.w.current().id,'other');assert.equal(JSON.stringify(f.projects[1]),target);
});
test('library dirty close flush veto preserves source editor and both project states',async t=>{
 const f=fixture(t);f.library();const before=JSON.stringify(f.projects),editor=f.w.document.querySelector('#workspace');f.w.studyOutputConnection={flush:async()=>{throw Error('Synthetic save failed.')}};
 await assert.rejects(f.w.switchProject('target',f.intent('retained-read')),/save failed/);assert.equal(JSON.stringify(f.projects),before);assert.equal(f.w.document.querySelector('#workspace'),editor);assert.equal(f.w.current().id,'source');
});
test('origin hold is released after success, failed save and changed native sequence',async t=>{
 for(const mode of ['saved','failed','changed']){const f=fixture(t),before=JSON.stringify(f.projects[1]),released=[],hold={bufferToken:'held-origin',bindingId:'origin-binding',parentStudyId:'source',sequence:4};
 f.w.studyDraft.holdForContext=()=>hold;f.w.studyDraft.releaseContext=options=>released.push(options);f.w.studyDraft.flush=async()=>{if(mode==='failed')throw Error('Synthetic save failure');return {dirty:false}};f.w.studyDraft.currentProof=()=>({...hold,dirty:false,sequence:mode==='changed'?5:4});
 if(mode==='saved')await f.w.switchProject('target',f.intent('retained-read'));else{await assert.rejects(f.w.switchProject('target',f.intent('retained-read')),/save|changed/i);assert.equal(JSON.stringify(f.projects[1]),before);assert.equal(f.w.current().id,'source');}
 assert.equal(released.length,1);assert.equal(released[0].bufferToken,'held-origin');assert.equal(released[0].cancelOnly,true);}
});

test('same-project unbound Write pickup with a cached catalog does not create or open native writing',async t=>{
 const f=fixture(t,{background:true});f.library();f.w.state.project='target';await tick();assert.equal(f.calls.some(url=>url.endsWith('/open')),false);
 await f.w.switchProject('target',f.intent('retained-read'));await tick();
 assert.equal(f.w.current().view,'record');assert.equal(f.w.current().viewedStage,6);assert.equal(f.calls.some(url=>url.endsWith('/open')||url.includes('/read?')),false);
 const disk=JSON.parse(f.w.localStorage.getItem('ar-document-study-owned-drafts-v1'));assert.equal(disk.projects.target.browser.blocks[0].html,'target exact browser words');assert.equal(Object.keys(disk.documents).length,0);
});

test('same-project browser hold releases after failed flush and preserves words without native opening',async t=>{
 const f=fixture(t,{background:true});f.library();f.w.state.project='target';await tick();const before=JSON.stringify(f.projects[1]);f.w.studyOutputConnection={flush:async()=>{throw Error('Synthetic save failure')}};
 await assert.rejects(f.w.switchProject('target',f.intent('retained-read')),/save failure/);assert.equal(JSON.stringify(f.projects[1]),before);assert.equal(f.calls.some(url=>url.endsWith('/open')),false);
 f.w.setView('article');await tick();assert.equal(f.calls.some(url=>url.endsWith('/open')),true,'ordinary Write opening resumes after failed navigation releases its hold');
});
test('retained carousel copy identifies browser authority without claiming synthetic words or approval',async t=>{
 const f=fixture(t);f.w.eval(study.match(/function carouselWords\(p\)\{[^\n]+/)[0]);const html=f.w.carouselWords(f.projects[1]);
 assert.match(html,/CAROUSEL WORDS · BROWSER COPY/);assert.match(html,/Read and edit the whole sequence here; layout is separate\./);assert.doesNotMatch(html,/SYNTHETIC CAROUSEL|Synthetic lines/);assert.match(html,/No words-yes, look approval, export or publication is recorded/);
});


const browserIntent=(f,p=f.projects[1])=>({destination:'browser-read',originProjectId:f.w.current().id,browserSignature:JSON.stringify([p.blocks,p.note??null,p.originalNotes??[]])});
test('supported unbound browser pickup reads exact preserved blocks rather than retained originals without a native open',async t=>{
 for(const same of [false,true]){const f=fixture(t,{reader:true,background:true}),p=f.projects[1];
  p.blocks=[{id:'protected-browser',tag:'blockquote',html:'Exact <em>earlier browser</em> words.',quote:true,source:'Invented browser source',protection:{reason:'Keep this quote exact.'}}];p.note={anchor:'protected-browser',state:'proposal',proposal:'Unaccepted proposal stays separate.'};p.originalNotes=[{anchor:'protected-browser',text:'Preserved browser note.'}];
  f.w.WORKFLOW_RECORDS.target={words:[{path:'invented/original.md'}],stages:{6:[{html:'<p>Different retained original words.</p>'}]}};
  const body=JSON.stringify([p.blocks,p.note,p.originalNotes]);if(same)f.w.state.project='target';f.library();
  await f.w.switchProject('target',browserIntent(f));await tick();
  assert.equal(p.view,'record');assert.equal(p.viewedStage,6);assert.equal(p.readSource,'browser');
  const surface=f.w.document.querySelector('#workspace');assert.match(surface.textContent,/Exact earlier browser words/);assert.doesNotMatch(surface.textContent,/Different retained original/);assert.equal(surface.querySelector('[contenteditable],[role="textbox"]'),null);
  assert.equal(JSON.stringify([p.blocks,p.note,p.originalNotes]),body);assert.equal(f.calls.some(url=>url.endsWith('/open')||url.includes('/read?')||url.endsWith('/save')),false);
  assert.equal(Object.keys(JSON.parse(f.w.localStorage.getItem('ar-document-study-owned-drafts-v1')).documents).length,0);
 }
});

test('browser read intent rejects full words or protection drift and newly bound identity before first destination paint',async t=>{
 for(const change of ['words','protection','binding','reference']){const f=fixture(t),p=f.projects[1],intent=browserIntent(f);let release;const gate=new Promise(r=>release=r);f.w.studyDraft.flush=()=>gate;const pending=f.w.switchProject('target',intent);const refusal=pending.then(()=>null,error=>error);await tick();
  if(change==='words')p.blocks[0].html='Changed without incrementing revision';if(change==='protection')p.blocks[0].quote=true;if(change==='binding')p.ownedDraft={bindingId:'other-owner'};if(change==='reference')p.referenceOnly=true;
  release({dirty:false});assert.match((await refusal)?.message||'',/browser|changed|writing|identity/i);assert.equal(f.w.current().id,'source');assert.equal(p.readSource,undefined);assert.equal(f.renders.some(r=>r.id==='target'),false);
 }
});

test('browser-read requires exact signature and ordinary navigation clears its temporary source selection',async t=>{
 const f=fixture(t),p=f.projects[1];
 for(const intent of [{destination:'browser-read',originProjectId:'source'}, {...browserIntent(f),browserSignature:'wrong'}])await assert.rejects(f.w.switchProject('target',intent),/signature|browser|changed|intent/i);
 f.library();await f.w.switchProject('target',browserIntent(f));assert.equal(p.readSource,'browser');
 f.w.eval(study.match(/^function viewPhase\(stage\).*$/m)[0]);f.w.viewPhase(6);assert.equal(p.readSource,undefined);
 await f.w.switchProject('target',browserIntent(f));await f.w.switchProject('other');await f.w.switchProject('target');assert.equal(p.readSource,undefined);
});
