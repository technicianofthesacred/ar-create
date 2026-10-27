import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID,createHash,webcrypto} from 'node:crypto';
import * as nativePlacement from '../runtime/services/draft-correspondence.mjs';
import {createServer} from '../runtime/server.mjs';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
const require = createRequire(new URL('../runtime/package.json', import.meta.url)), {JSDOM} = require('jsdom');
const selection = {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working'};
const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const wait = async fn => { for (let n=0;n<150;n++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('native journey timed out'); };

function editor(origin, windows, {storage,project,workflowBar=()=>''}={}) {
  const dom = new JSDOM('<main id="app"></main>', {url: origin+'/document-study/', runScripts:'outside-only'}), w=dom.window;
  windows.push(dom);if(storage)w.localStorage.setItem('ar-document-study-owned-drafts-v1',storage);
  const p=project?structuredClone(project):{id:'browser-clay-story',name:'Invented current story',view:'record',viewedStage:1,blocks:[],title:'Invented story',history:[],note:null,originalNotes:[],rev:1};
  w.state={projects:[p]};w.current=()=>p;w.selected=w.activeBlock=w.keyboardBlock=w.typingSession=null;w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;
  const renderedStages=[];let loseSave=false,loseUndo=false;
  w.fetch=async(url,options)=>{const response=await fetch(new URL(url,origin),options?.method==='POST'?{...options,headers:{...options.headers,Origin:origin}}:options);if(loseSave&&String(url).endsWith('/working-draft/save')){loseSave=false;throw Error('Synthetic lost response after owner commit');}if(loseUndo&&String(url).endsWith('/working-draft/undo')){loseUndo=false;throw Error('Synthetic lost Undo response after owner commit');}return response;};
  w.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.readonlyHTML=x=>x;w.shortRecordName=x=>x;w.WORKFLOW_RECORDS={};
  for(const name of ['toast','commitTyping','rememberPosition','save','undo','refreshDiscussion','wireDocument','openInstruction'])w[name]=()=>{};
  w.blockHTML=b=>'<'+b.tag+' data-block="'+b.id+'">'+b.html+'</'+b.tag+'>';
  w.article=x=>'<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">'+x.blocks.map(w.blockHTML).join('')+'</div><aside id="margin"></aside><div class="marginHint"></div>';
  w.phaseReader=()=>'<p>Invented material</p>';w.render=()=>{renderedStages.push(p.viewedStage);w.document.getElementById('app').innerHTML=p.view==='article'?w.article(p):w.phaseReader(p);};
  w.onTyping=el=>{p.blocks=[...el.children].map(child=>({id:child.dataset.block,tag:child.tagName.toLowerCase(),html:child.innerHTML}));};
  w.viewPhase=stage=>{p.viewedStage=stage;p.view='record';w.render();};w.setView=view=>{p.view=view;w.render();};w.workflowBar=workflowBar;w.historicalNotice=()=>'';
  w.eval(fs.readFileSync(new URL('../public/document-study/draft-flow.js',import.meta.url),'utf8'));
  const type=words=>{const el=w.document.getElementById('manuscript'),target=[...el.children].find(row=>row.textContent.startsWith('I met Mira')||row.textContent.startsWith('Changed opening'));assert.ok(target);target.textContent=words;w.onTyping(el);};
  return {w,p,dom,type,renderedStages,loseSave:()=>{loseSave=true;},loseUndo:()=>{loseUndo=true;},open:()=>w.studyDraft.openMagazine({...selection,parentStudyId:p.id})};
}

async function nativeFixture(t,{writable=true,registered=true}={}){
  const f=buildMagazineFixture({extra:{'Writing/Published edition.md':'Earlier immutable edition.\n'}}),plan=planRegistration({vault:f.vault,files:f.files}),windows=[];
  if(registered){fs.mkdirSync(path.join(f.data,'magazine/projects'),{recursive:true});fs.writeFileSync(path.join(f.data,'magazine/index.json'),JSON.stringify({schema:INDEX_SCHEMA,vaultRoot:f.vault,filesRoot:f.files,stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));
  for(const p of plan.stories)fs.writeFileSync(path.join(f.data,'magazine/projects',p.storyId+'.json'),JSON.stringify(p));}
  const server=await createServer({dataDir:f.data,publicDir:path.resolve('public'),connections:[],magazineRoots:[],researchEnabled:false,magazineVault:{vaultRoot:f.vault,filesRoot:f.files,writable,machine:'synthetic-native'}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{for(const dom of windows)dom.window.close();await new Promise(r=>server.close(r));f.cleanup();});
  return {f,origin,windows};
}

test('existing native editor → Magazine same DEV: edit/save/read/switch/reopen, fresh-context exact Undo and stale409 retained words',async t=>{
  const {f,origin,windows}=await nativeFixture(t);
  const original=treeHashes(f.vault),read=()=>fs.readFileSync(path.join(f.vault,DEV),'utf8');
  let ui=editor(origin,windows);await ui.open();assert.match(ui.w.document.getElementById('manuscript').textContent,/I met Mira/);
  assert.equal(ui.w.studyDraft.currentBinding(),null,'magazine piece is not a fabricated native copy binding');
  ui.type('Changed opening beside the blue kiln.');const inserted=ui.w.document.createElement('p');inserted.textContent='A new paragraph in the same maintained editor.';ui.w.document.getElementById('manuscript').append(inserted);ui.w.onTyping(ui.w.document.getElementById('manuscript'));ui.loseSave();assert.equal((await ui.w.studyDraft.flush()).dirty,true,'response loss preserves exact pending request');assert.equal((await ui.w.studyDraft.flush()).dirty,false,'retry replays the same owner operation');
  const saved=read();assert.match(saved,/Changed opening/);assert.match(saved,/A new paragraph in the same maintained editor/);
  await ui.w.studyDraft.read();assert.match(ui.w.document.getElementById('app').textContent,/Changed opening/);
  ui.w.viewPhase(1);await ui.open();assert.match(ui.w.document.getElementById('manuscript').textContent,/Changed opening/);
  ui.dom.window.close();ui=editor(origin,windows);await ui.open();assert.match(ui.w.document.getElementById('manuscript').textContent,/Changed opening/);
  const undo=ui.w.document.querySelector('[data-draft-action="disk-undo"]');assert.ok(undo&&!undo.disabled,'fresh context gets owner receipt eligibility');ui.loseUndo();undo.click();await wait(()=>ui.w.document.getElementById('app').textContent.includes('Synthetic lost Undo'));assert.equal((await ui.w.studyDraft.flush()).dirty,false,'retry recovers the exact committed Undo receipt');
  await wait(()=>read().includes('I met Mira')&&ui.w.studyDraft.currentProof()?.dirty===false).catch(error=>{console.log({raw:read(),proof:ui.w.studyDraft.currentProof(),screen:ui.w.document.getElementById('app').textContent});throw error;});
  assert.deepEqual(treeHashes(f.vault),original,'exact DEV restore; publication/source/other files untouched');
  ui.type('Changed opening retained in this browser.');fs.writeFileSync(path.join(f.vault,DEV),read()+'\nExternal current words.\n');
  const changed=read();const proof=await ui.w.studyDraft.flush();assert.equal(proof.dirty,true);assert.equal(read(),changed);assert.match(ui.w.document.getElementById('manuscript').textContent,/retained in this browser/);
  assert.match(ui.w.document.getElementById('app').textContent,/changed|newer/i);
  assert.equal(fs.existsSync(path.join(f.data,'study-draft-copies')),false);
});


test('native readonly and unregistered states refuse honestly; attempted typing creates no copy or file change',async t=>{
 const {f,origin,windows}=await nativeFixture(t,{writable:false}),before=treeHashes(f.vault),ui=editor(origin,windows);await ui.open();
 assert.equal(ui.w.document.getElementById('manuscript').getAttribute('contenteditable'),'false');
 assert.match(ui.w.document.getElementById('app').textContent,/read.only/i);ui.type('Changed opening cannot activate a readonly owner.');assert.equal((await ui.w.studyDraft.flush()).dirty,true);assert.deepEqual(treeHashes(f.vault),before);
 const unregistered=await nativeFixture(t,{registered:false}),second=editor(unregistered.origin,unregistered.windows);await assert.rejects(second.open(),error=>error.code===404);assert.equal(fs.existsSync(path.join(unregistered.f.data,'study-draft-copies')),false);
});

function caretAt(ui,node,offset=3){
 const manuscript=ui.w.document.getElementById('manuscript');manuscript.focus();
 const range=ui.w.document.createRange();range.setStart(node.firstChild,offset);range.collapse(true);
 const selection=ui.w.getSelection();selection.removeAllRanges();selection.addRange(range);
 ui.w.activeBlock=ui.w.keyboardBlock=node.dataset.block;
 ui.w.selected={anchor:node.dataset.block,endAnchor:node.dataset.block,range:range.cloneRange()};
 return {manuscript,text:node.firstChild,offset};
}
function assertCaret(ui,held){
 assert.equal(ui.w.document.getElementById('manuscript'),held.manuscript,'ordinary save keeps the same mounted manuscript');
 assert.equal(ui.w.document.activeElement,held.manuscript,'typing focus remains in the manuscript');
 assert.equal(ui.w.getSelection().anchorNode,held.text,'selection keeps its text node');
 assert.equal(ui.w.getSelection().anchorOffset,held.offset,'selection keeps its offset');
}
function pauseResponse(ui,action){
 const fetch=ui.w.fetch;let release,started;
 const gate=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});
 ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/working-draft/'+action)){started();await gate;}return result;};
 return {entered,release};
}

test('ordinary structural saves keep manuscript, caret and paragraph identities usable for continued writing',async t=>{
 const {f,origin,windows}=await nativeFixture(t),ui=editor(origin,windows);await ui.open();
 const manuscript=ui.w.document.getElementById('manuscript'),opening=[...manuscript.children].find(row=>row.textContent.startsWith('I met Mira'));
 const inserted=ui.w.document.createElement('p');inserted.textContent='An inserted paragraph before the opening.';opening.before(inserted);ui.w.onTyping(manuscript);
 let held=caretAt(ui,opening);assert.equal((await ui.w.studyDraft.flush()).dirty,false);assertCaret(ui,held);
 assert.equal(ui.w.activeBlock,opening.dataset.block);assert.equal(ui.w.selected.anchor,opening.dataset.block);
 assert.deepEqual([...manuscript.children].map(el=>el.dataset.block),ui.p.blocks.map(row=>row.id));
 opening.firstChild.insertData(3,' still');ui.w.onTyping(manuscript);held=caretAt(ui,opening,9);
 assert.equal((await ui.w.studyDraft.flush()).dirty,false);assertCaret(ui,held);
 inserted.remove();ui.w.onTyping(manuscript);held=caretAt(ui,opening);
 assert.equal((await ui.w.studyDraft.flush()).dirty,false);assertCaret(ui,held);
 opening.firstChild.appendData(' Continued after deletion.');ui.w.onTyping(manuscript);
 assert.equal((await ui.w.studyDraft.flush()).dirty,false);
 const saved=fs.readFileSync(path.join(f.vault,DEV),'utf8');assert.match(saved,/I m stillet Mira/);assert.match(saved,/Continued after deletion/);assert.doesNotMatch(saved,/An inserted paragraph/);
});

test('typing during a structural save retains mounted newer words and can save them against reconciled IDs',async t=>{
 const {f,origin,windows}=await nativeFixture(t),ui=editor(origin,windows);await ui.open();
 const manuscript=ui.w.document.getElementById('manuscript'),opening=[...manuscript.children].find(row=>row.textContent.startsWith('I met Mira'));
 const inserted=ui.w.document.createElement('p');inserted.textContent='Inserted before concurrent typing.';opening.before(inserted);ui.w.onTyping(manuscript);
 const paused=pauseResponse(ui,'save'),saving=ui.w.studyDraft.flush();await paused.entered;
 opening.firstChild.appendData(' Newer typing while saving.');ui.w.onTyping(manuscript);const held=caretAt(ui,opening);
 paused.release();await saving;assertCaret(ui,held);assert.match(manuscript.textContent,/Newer typing while saving/);
 assert.equal((await ui.w.studyDraft.flush()).dirty,false);
 assert.match(fs.readFileSync(path.join(f.vault,DEV),'utf8'),/Newer typing while saving/);
});

test('delayed Magazine open refuses a same-project stage change and retains interim browser words',async t=>{
 const {origin,windows}=await nativeFixture(t),ui=editor(origin,windows);
 ui.p.blocks=[{id:'browser-initial',tag:'p',html:'Initial browser words.'}];
 const paused=pauseResponse(ui,'read'),opening=ui.open();await paused.entered;
 ui.p.blocks[0].html='Interim browser words while opening.';
 ui.w.viewPhase(2);paused.release();assert.equal(await opening,null);
 assert.equal(ui.p.viewedStage,2);assert.equal(ui.p.view,'record');assert.equal(ui.w.studyDraft.currentOwner(),null);
 await ui.open();assert.match(ui.w.document.getElementById('app').textContent,/Interim browser words while opening/,'interim browser words remain available beside the DEV');
});

test('external words between save and confirmation refuse paragraph-ID rebasing over retained local words',async t=>{
 const {f,origin,windows}=await nativeFixture(t),ui=editor(origin,windows);await ui.open();
 ui.type('Changed opening saved before another writer.');
 const manuscript=ui.w.document.getElementById('manuscript'),opening=[...manuscript.children].find(row=>row.textContent.startsWith('Changed opening')),held=caretAt(ui,opening),beforeId=opening.dataset.block;
 const paused=pauseResponse(ui,'save'),saving=ui.w.studyDraft.flush();await paused.entered;
 const file=path.join(f.vault,DEV);fs.appendFileSync(file,'\nExternal words after the committed save.\n');const external=fs.readFileSync(file,'utf8');
 paused.release();assert.equal((await saving).dirty,true);assertCaret(ui,held);assert.equal(opening.dataset.block,beforeId);
 assert.doesNotMatch(manuscript.textContent,/External words/);assert.equal(fs.readFileSync(file,'utf8'),external);
 assert.match(ui.w.document.getElementById('app').textContent,/changed before confirmation/);
});


test('Magazine owner can open directly in Outputs without mounting intermediate writing or reading views',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows);ui.renderedStages.length=0;ui.p.viewedStage=12;
 const proof=await ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:12});
 assert.equal(ui.p.viewedStage,12);assert.equal(ui.p.view,'record');assert.ok(ui.renderedStages.length);assert.ok(ui.renderedStages.every(stage=>stage===12),JSON.stringify(ui.renderedStages));
 assert.equal(ui.w.document.querySelector('#manuscript'),null);assert.equal(proof.owner.kind,'magazine');assert.equal(proof.owner.pieceId,selection.pieceId);assert.equal(proof.dirty,false);assert.deepEqual(treeHashes(f.vault),before);
});
test('Magazine reader can hydrate directly without briefly exposing an editable manuscript',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows);ui.renderedStages.length=0;ui.p.viewedStage=6;
 const proof=await ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:6});
 assert.equal(ui.p.viewedStage,5);assert.equal(ui.p.view,'article');assert.equal(ui.w.studyDraft.viewMode(),'preview');assert.ok(ui.renderedStages.length);assert.ok(ui.renderedStages.every(stage=>stage===5),JSON.stringify(ui.renderedStages));assert.ok(ui.w.document.querySelector('#manuscript'));assert.equal(proof.dirty,false);assert.deepEqual(treeHashes(f.vault),before);
});
test('unsupported Magazine presentation targets refuse before changing the current work',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows);ui.renderedStages.length=0;const saved=JSON.stringify(ui.p);
 for(const presentationStage of [0,1,2,3,4,13,'12',null])await assert.rejects(ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage}),/section|presentation|stage/i);
 assert.equal(JSON.stringify(ui.p),saved);assert.equal(ui.renderedStages.length,0);assert.deepEqual(treeHashes(f.vault),before);
});

test('explicit Outputs presentation cannot override navigation during an in-flight owner read',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows),fetch=ui.w.fetch;let release,entered;const waiting=new Promise(resolve=>entered=resolve);
 ui.w.fetch=async(url,options)=>{const response=await fetch(url,options);if(String(url).includes('/working-draft/read')){entered();await new Promise(resolve=>release=resolve);}return response;};
 ui.renderedStages.length=0;const opening=ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:12});await waiting;ui.p.viewedStage=3;ui.p.view='record';release();assert.equal(await opening,null);assert.equal(ui.p.viewedStage,3);assert.equal(ui.p.view,'record');assert.equal(ui.renderedStages.length,0);assert.deepEqual(treeHashes(f.vault),before);
});
test('explicit Outputs hydration retains pending draft wording through the existing owner save',async t=>{
 const {f,origin,windows}=await nativeFixture(t),ui=editor(origin,windows);await ui.open();const published=fs.readFileSync(path.join(f.vault,'Writing/Published edition.md'),'utf8');ui.type('Changed opening retained while viewing Outputs.');await ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:12});assert.equal(ui.p.viewedStage,12);assert.ok(ui.p.blocks.some(b=>b.html.includes('retained while viewing Outputs')));await ui.w.studyDraft.flush();await wait(()=>ui.w.studyDraft.currentProof().dirty===false);assert.match(fs.readFileSync(path.join(f.vault,DEV),'utf8'),/retained while viewing Outputs/);assert.equal(fs.readFileSync(path.join(f.vault,'Writing/Published edition.md'),'utf8'),published);
});

test('direct Magazine Outputs continues writing through maintained action and navigation wrappers after pending reference resolves',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows),w=ui.w;
 const load=name=>w.eval(fs.readFileSync(new URL('../public/document-study/'+name+'.js',import.meta.url),'utf8'));
 for(const name of ['output-overview','output-connection','workspace-navigation','magazine-output-adapter'])load(name);
 let pauseNext=false,release,entered;
 const waiting=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 const adapter=w.createMagazineOutputAdapter({
  current:()=>{const proof=w.studyDraft.currentProof();return {projectId:ui.p.id,owner:w.studyDraft.currentOwner(),hash:proof?.draftHash,dirty:!!proof?.dirty};},
  resolve:async input=>{
   if(pauseNext){pauseNext=false;entered();await gate;}
   return {schema:'ar-create.magazine-publication-reference.v1',revision:'a'.repeat(64),nativeProjectId:ui.p.id,workingOwnerRef:{projectId:input.storyId,pieceId:input.pieceId,editionId:'working',artifactId:'synthetic-registered-dev',hash:input.expectedHash},publication:null};
  },
  // The production existing-work integration commits through this guarded wrapper.
  openWorking:async(_payload,assertCurrent)=>{assertCurrent();await w.viewPhase(5,{originGuard:assertCurrent});assertCurrent();}
 });
 w.studyOutputConnection.setMagazineAdapter(adapter);
 ui.renderedStages.length=0;
 const opened=await w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:12}),blocks=JSON.stringify(ui.p.blocks);
 await wait(()=>w.document.querySelector('#output-overview [data-output-action="native"]')?.disabled===false);
 assert.ok(ui.renderedStages.every(stage=>stage===12),JSON.stringify(ui.renderedStages));
 assert.equal(w.document.querySelector('#manuscript'),null);
 const button=w.document.querySelector('#output-overview [data-output-action="native"]');
 assert.equal(button.textContent,'Continue writing');
 const onAction=w.realOutputOverview.onAction;let action;
 w.realOutputOverview.onAction=(...args)=>(action=onAction(...args));
 pauseNext=true;button.click();await waiting;
 assert.equal(button.disabled,true,'the real delegated handler disables only while its action is in flight');
 assert.equal(ui.p.viewedStage,12,'a pending fresh reference cannot navigate before its owner is confirmed');
 assert.equal(w.document.querySelector('#manuscript'),null);
 assert.equal(JSON.stringify(ui.p.blocks),blocks);
 release();await action;
 await wait(()=>ui.p.viewedStage===5&&w.document.querySelector('#manuscript'));
 const proof=w.studyDraft.currentProof();
 assert.equal(ui.p.view,'article');assert.deepEqual(proof.owner,opened.owner);assert.equal(proof.draftHash,opened.draftHash);assert.equal(proof.dirty,false);
 assert.equal(JSON.stringify(ui.p.blocks),blocks);assert.equal(w.document.querySelectorAll('#manuscript [data-block]').length,ui.p.blocks.length);
 assert.equal(ui.renderedStages.includes(6),false,'Continue writing never mounts an intermediate Read view');
 assert.deepEqual(treeHashes(f.vault),before,'opening and continuing the synthetic owner changes no working or reference files');
});


async function arrangementEditor(t){
 const f=await nativeFixture(t),file=path.join(f.f.vault,DEV);fs.appendFileSync(file,'\n\n%%photos: invented.png · First | invented.png · Second%%\n\nA synthetic destination.\n');
 const ui=editor(f.origin,f.windows);await ui.open();ui.w.viewPhase(9);const calls=[],fetch=ui.w.fetch;
 ui.w.fetch=async(url,options)=>{calls.push({url:String(url),body:options?.body?JSON.parse(options.body):null});if(String(url).startsWith('/api/review/magazine-media/move-plan?')){const query=new URL(url,f.origin).searchParams,read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),model=nativePlacement.capture(read.document.text,selection.pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(selection.pieceId)+':'+i);const moved=model.blocks.find(b=>b.raw.includes('%%photos:')),operations=[{kind:'move',id:moved.id,beforeId:query.get('beforeId')}],candidate=nativePlacement.apply(model,read.document.text,operations);return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:'synthetic-artifact',hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:createHash('sha256').update(candidate.raw).digest('hex'),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:[query.get('placementId'),'d'.repeat(64)],operations})};}return fetch(url,options);};
 const read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),proof=ui.w.studyDraft.currentProof(),block=read.projection.find(b=>b.raw.includes('%%photos:')),before=read.projection.find(b=>b.words.startsWith('I met Mira'));
 const input={storyId:selection.storyId,pieceId:selection.pieceId,parentStudyId:ui.p.id,sequence:proof.sequence,expectedHash:proof.draftHash,artifactId:'synthetic-artifact',revision:'a'.repeat(64),placementId:'b'.repeat(64),blockId:block.id,beforeId:before.id};
 return {...f,ui,file,input,calls,original:fs.readFileSync(file,'utf8')};
}
test('Arrange uses the existing pending owner save and exact Undo without leaving Arrange',async t=>{
 const f=await arrangementEditor(t);assert.equal(typeof f.ui.w.studyDraft.moveMagazinePlacement,'function');const saved=await f.ui.w.studyDraft.moveMagazinePlacement(f.input);assert.equal(saved.dirty,false);assert.equal(f.ui.p.viewedStage,9);assert.equal(f.ui.p.view,'record');const raw=fs.readFileSync(f.file,'utf8');assert.notEqual(raw,f.original);assert.ok(raw.indexOf('%%photos:')<raw.indexOf('I met Mira'));assert.equal(f.ui.w.studyDraft.magazineArrangeState().canUndo,true);
 await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:saved.sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.ui.p.viewedStage,9);assert.equal(f.ui.w.studyDraft.currentProof().dirty,false);
});
test('Arrange save response loss retains the same pending operation for retry and later Undo',async t=>{
 const f=await arrangementEditor(t);f.ui.loseSave();const state=await f.ui.w.studyDraft.moveMagazinePlacement(f.input);assert.equal(state.dirty,true);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const first=f.calls.find(c=>c.url.endsWith('/save')).body;
 const retried=await f.ui.w.studyDraft.retryMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:state.sequence});assert.equal(retried.dirty,false);const saves=f.calls.filter(c=>c.url.endsWith('/save'));assert.equal(saves.length,2);assert.equal(saves[1].body.operationId,first.operationId);assert.equal(saves[1].body.content,first.content);assert.equal(f.ui.p.viewedStage,9);
 f.ui.loseUndo();await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:retried.sequence});assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);await f.ui.w.studyDraft.retryMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:f.ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.ui.p.viewedStage,9);
});
test('Arrange refuses a wrong prepared hash or wrong plan owner before any save or retained order change',async t=>{
 for(const wrong of ['hash','owner']){const f=await arrangementEditor(t),fetch=f.ui.w.fetch,prior=JSON.stringify(f.ui.p.blocks);f.ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/move-plan?')){const value=await result.json();if(wrong==='hash')value.expectedContentHash='0'.repeat(64);else value.ownerRef.pieceId='another-piece';return {ok:true,json:async()=>value};}return result;};await assert.rejects(f.ui.w.studyDraft.moveMagazinePlacement(f.input));assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);assert.equal(JSON.stringify(f.ui.p.blocks),prior);}
});
test('Arrange refuses dirty or stale active proof and navigation during plan preparation without saving',async t=>{
 for(const mode of ['dirty','sequence','navigation']){const f=await arrangementEditor(t);if(mode==='dirty'){f.ui.w.viewPhase(5);f.ui.type('Changed opening retained before arranging.');f.ui.w.viewPhase(9);}if(mode==='sequence')f.input.sequence++;if(mode==='navigation'){const fetch=f.ui.w.fetch;f.ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/move-plan?'))f.ui.w.viewPhase(8);return result;};}await assert.rejects(f.ui.w.studyDraft.moveMagazinePlacement(f.input));assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);if(mode==='navigation')assert.equal(f.ui.p.viewedStage,8);}
});

test('Arrange retains a lost save across a fresh browser context and replays its exact pending owner request',async t=>{
 const f=await arrangementEditor(t);f.ui.loseSave();await f.ui.w.studyDraft.moveMagazinePlacement(f.input);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;f.ui.dom.window.close();
 const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],fetch=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return fetch(url,options);};const proof=ui.w.studyDraft.currentProof();assert.equal(ui.w.studyDraft.magazineArrangeState().canRetry,true);await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:proof.sequence});assert.equal(replay.length,1);assert.deepEqual(replay[0],pending);assert.equal(ui.w.studyDraft.currentProof().dirty,false);assert.equal(ui.p.viewedStage,9);await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('Arrange cancels before saving if navigation changes during native preparation, and rejects overlapping moves',async t=>{
 const f=await arrangementEditor(t),gate=pauseResponse(f.ui,'prepare'),moving=f.ui.w.studyDraft.moveMagazinePlacement(f.input);await gate.entered;await assert.rejects(f.ui.w.studyDraft.moveMagazinePlacement(f.input),/current save/);f.ui.w.viewPhase(8);gate.release();await assert.rejects(moving,/current work changed/);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);assert.equal(f.ui.p.viewedStage,8);assert.equal(f.ui.w.studyDraft.currentProof().dirty,false);
});

test('Arrange Undo finishing after navigation preserves the chosen section and refreshed words',async t=>{
 const f=await arrangementEditor(t),saved=await f.ui.w.studyDraft.moveMagazinePlacement(f.input),gate=pauseResponse(f.ui,'undo'),undo=f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:saved.sequence});await gate.entered;f.ui.w.viewPhase(8);gate.release();await undo;assert.equal(f.ui.p.viewedStage,8);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);f.ui.w.viewPhase(5);assert.equal((await f.ui.w.studyDraft.flush()).dirty,false);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});

async function focusEditor(t){
 const f=await nativeFixture(t),file=path.join(f.f.vault,DEV),raw='%%photo: invented.png · Invented focus · wide aspect=4/5 narrow left x=0.2 y=0.8%%';
 fs.writeFileSync(file,['---','type: DEV','story: Clay Teacher','---','','Invented reader metadata.','','---','','I met Mira at the edge of the village, where the kilns stand in a row.','',raw,'','Invented retained paragraph.','','%%ending%%','','%%saying%%','> "An invented closing saying."','','Invented closing words.','','---','','Invented retained notes.',''].join('\n'));
 const ui=editor(f.origin,f.windows);await ui.open();ui.w.viewPhase(9);const calls=[],fetch=ui.w.fetch;
 ui.w.fetch=async(url,options)=>{calls.push({url:String(url),body:options?.body?JSON.parse(options.body):null});if(String(url).startsWith('/api/review/magazine-media/focus-plan?')){const query=new URL(url,f.origin).searchParams,read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),model=nativePlacement.capture(read.document.text,selection.pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(selection.pieceId)+':'+i);const chosen=model.blocks.find(b=>b.raw.includes('Invented focus')),operations=[{kind:'photoFocus',id:chosen.id,seenBlockHash:createHash('sha256').update(chosen.raw).digest('hex'),x:Number(query.get('x')),y:Number(query.get('y'))}],candidate=nativePlacement.apply(model,read.document.text,operations);return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:'synthetic-artifact',hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:createHash('sha256').update(candidate.raw).digest('hex'),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:[query.get('placementId')],operations})};}return fetch(url,options);};
 const read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),proof=ui.w.studyDraft.currentProof(),block=read.projection.find(b=>b.raw.includes('Invented focus'));
 return {...f,ui,file,calls,original:fs.readFileSync(file,'utf8'),input:{storyId:selection.storyId,pieceId:selection.pieceId,parentStudyId:ui.p.id,sequence:proof.sequence,expectedHash:proof.draftHash,artifactId:'synthetic-artifact',revision:'a'.repeat(64),placementId:'b'.repeat(64),blockId:block.id,x:.7,y:.3}};
}
test('Arrange focal change saves one exact occurrence through the writing owner and exact Undo remains in Arrange',async t=>{
 const f=await focusEditor(t),before=treeHashes(f.f.vault),result=await f.ui.w.studyDraft.focusMagazinePlacement(f.input);assert.equal(result.dirty,false);assert.equal(fs.readFileSync(f.file,'utf8'),f.original.replace('x=0.2 y=0.8','x=0.7 y=0.3'));assert.equal(f.ui.p.viewedStage,9);assert.equal(result.canUndo,true);
 await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:result.sequence});assert.deepEqual(treeHashes(f.f.vault),before);assert.equal(f.ui.p.viewedStage,9);
});
test('lost focal save survives fresh browser context and retries the identical operation before exact Undo',async t=>{
 const f=await focusEditor(t);f.ui.loseSave();await f.ui.w.studyDraft.focusMagazinePlacement(f.input);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;f.ui.dom.window.close();
 const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],fetch=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return fetch(url,options);};await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.deepEqual(replay,[pending]);assert.equal(ui.w.studyDraft.currentProof().dirty,false);
 await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('focal changes refuse dirty/stale/navigation/unsupported-owner and forged plans before a writer request',async t=>{
 for(const mode of ['dirty','sequence','navigation','hash','owner','coordinates','unknown-operation','unsupported-owner']){const f=await focusEditor(t),fetch=f.ui.w.fetch;
 if(mode==='dirty'){f.ui.w.viewPhase(5);f.ui.type('Changed opening kept before focus.');f.ui.w.viewPhase(9);}if(mode==='sequence')f.input.sequence++;
 if(mode==='unsupported-owner'){f.ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/working-draft/read?')){const value=await result.json();delete value.supportedNativeOperations;return {ok:true,json:async()=>value};}return result;};await f.ui.open();f.ui.w.viewPhase(9);}
 else f.ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/focus-plan?')){if(mode==='navigation'){f.ui.w.viewPhase(8);return result;}const value=await result.json();if(mode==='hash')value.expectedContentHash='0'.repeat(64);if(mode==='owner')value.ownerRef.pieceId='wrong';if(mode==='coordinates')value.operations[0].x=.9;if(mode==='unknown-operation')value.operations[0].kind='move';return {ok:true,json:async()=>value};}return result;};
 await assert.rejects(f.ui.w.studyDraft.focusMagazinePlacement(f.input));assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);
 }
 const f=await focusEditor(t),gate=pauseResponse(f.ui,'prepare'),focusing=f.ui.w.studyDraft.focusMagazinePlacement(f.input);await gate.entered;f.ui.w.viewPhase(8);gate.release();await assert.rejects(focusing,/current work changed/);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);
});

test('Magazine owner can open directly in Arrange without mounting intermediate writing or reading views',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows);ui.renderedStages.length=0;ui.p.viewedStage=9;
 const proof=await ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:9});
 assert.equal(ui.p.viewedStage,9);assert.equal(ui.p.view,'record');assert.ok(ui.renderedStages.length);assert.ok(ui.renderedStages.every(stage=>stage===9),JSON.stringify(ui.renderedStages));
 assert.equal(ui.w.document.querySelector('#manuscript'),null);assert.equal(proof.owner.kind,'magazine');assert.equal(proof.owner.pieceId,selection.pieceId);assert.equal(proof.dirty,false);assert.deepEqual(treeHashes(f.vault),before);
});


test('all Magazine Make and Deliver sections hydrate the same native owner without writes or intermediate Draft',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault);
 for(const presentationStage of [7,8,10,11]){
  const ui=editor(origin,windows);ui.p.viewedStage=presentationStage;ui.renderedStages.length=0;
  const proof=await ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage});
  assert.equal(proof.owner.pieceId,selection.pieceId);assert.equal(proof.owner.storyId,selection.storyId);assert.equal(proof.owner.kind,'magazine');assert.equal(proof.parentStudyId,ui.p.id);assert.equal(proof.dirty,false);
  assert.equal(ui.p.view,'record');assert.equal(ui.p.viewedStage,presentationStage);assert.ok(ui.p.blocks.some(b=>b.html.includes('I met Mira')));assert.ok(ui.renderedStages.length);assert.ok(ui.renderedStages.every(stage=>stage===presentationStage));assert.equal(ui.w.document.querySelector('#manuscript'),null);assert.deepEqual(treeHashes(f.vault),before);
 }
});

test('late Magazine section hydration cannot override a newer section choice',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault);
 for(const presentationStage of [7,8,10,11]){
  const ui=editor(origin,windows),fetch=ui.w.fetch;let release,entered;const waiting=new Promise(resolve=>entered=resolve);
  ui.w.fetch=async(url,options)=>{const response=await fetch(url,options);if(String(url).includes('/working-draft/read')){entered();await new Promise(resolve=>release=resolve);}return response;};
  ui.renderedStages.length=0;const opening=ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage});await waiting;ui.w.viewPhase(4);const renders=ui.renderedStages.length;release();assert.equal(await opening,null);assert.equal(ui.p.viewedStage,4);assert.equal(ui.p.view,'record');assert.equal(ui.renderedStages.length,renders);assert.deepEqual(treeHashes(f.vault),before);
 }
});


test('Arrange navigation identifies only the exact editable Magazine working draft as writable',async t=>{
 const workflowBar=()=>'<button aria-label="View step 9: Photos placed (read-only)" title="Photos placed · snapshot connection gap">Arrange</button><button aria-label="View step 10: Your look, then publish (read-only)">Audience</button>';
 for(const writable of [true,false]){
  const {origin,windows}=await nativeFixture(t,{writable}),ui=editor(origin,windows,{workflowBar});
  assert.match(ui.w.workflowBar(ui.p),/Photos placed \(read-only\)/);
  await ui.w.studyDraft.openMagazine({...selection,parentStudyId:ui.p.id,presentationStage:9});
  const html=ui.w.workflowBar(ui.p);assert.equal(html.includes('Photos placed (working draft)'),writable);assert.equal(html.includes('Photos placed · current working draft'),writable);assert.ok(html.includes('Your look, then publish (read-only)'));
  if(writable){const selected=ui.p.magazineDraft;ui.p.magazineDraft={...selected,pieceId:'another-piece'};assert.match(ui.w.workflowBar(ui.p),/Photos placed \(read-only\)/);ui.p.magazineDraft=selected;}
 }
});

test('saved Magazine wording and edition survive fresh native Check Media Audience and Share contexts',async t=>{
 const {f,origin,windows}=await nativeFixture(t),before=treeHashes(f.vault),ui=editor(origin,windows);await ui.open();
 ui.type('Changed opening carried through every selected piece section.');const saved=await ui.w.studyDraft.flush();assert.equal(saved.dirty,false);
 const savedTree=treeHashes(f.vault),savedBytes=fs.readFileSync(path.join(f.vault,DEV),'utf8'),storage=ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1');
 for(const presentationStage of [7,8,10,11]){
  const next=editor(origin,windows,{storage});next.p.viewedStage=presentationStage;next.renderedStages.length=0;
  const proof=await next.w.studyDraft.openMagazine({...selection,parentStudyId:next.p.id,presentationStage});
  assert.equal(proof.draftHash,saved.draftHash);assert.equal(proof.owner.path,saved.owner.path);assert.equal(proof.owner.pieceId,saved.owner.pieceId);assert.equal(proof.parentStudyId,saved.parentStudyId);assert.equal(proof.dirty,false);assert.equal(next.w.studyDraft.currentBinding(),null);
  assert.ok(next.p.blocks.some(b=>b.html.includes('carried through every selected piece section')));assert.ok(next.renderedStages.every(stage=>stage===presentationStage));assert.equal(fs.readFileSync(path.join(f.vault,DEV),'utf8'),savedBytes);assert.deepEqual(treeHashes(f.vault),savedTree);
 }
 const writer=editor(origin,windows,{storage});await writer.open();const undo=writer.w.document.querySelector('[data-draft-action="disk-undo"]');assert.ok(undo&&!undo.disabled);undo.click();await wait(()=>writer.w.studyDraft.currentProof()?.dirty===false&&fs.readFileSync(path.join(f.vault,DEV),'utf8').includes('I met Mira'));assert.deepEqual(treeHashes(f.vault),before,'the same owner restores exact saved bytes after section reloads');
});

async function aspectEditor(t){
 const f=await nativeFixture(t),file=path.join(f.f.vault,DEV),raw='%%photo: invented.png · Invented focus · wide aspect=4/5 narrow left x=0.2 y=0.8%%';
 fs.writeFileSync(file,['---','type: DEV','story: Clay Teacher','---','','Invented reader metadata.','','---','','I met Mira at the edge of the village, where the kilns stand in a row.','',raw,'','Invented retained paragraph.','','%%ending%%','','%%saying%%','> "An invented closing saying."','','Invented closing words.','','---','','Invented retained notes.',''].join('\n'));
 const ui=editor(f.origin,f.windows);await ui.open();ui.w.viewPhase(9);const calls=[],fetch=ui.w.fetch;
 ui.w.fetch=async(url,options)=>{calls.push({url:String(url),body:options?.body?JSON.parse(options.body):null});if(String(url).startsWith('/api/review/magazine-media/aspect-plan?')){const query=new URL(url,f.origin).searchParams,read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),model=nativePlacement.capture(read.document.text,selection.pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(selection.pieceId)+':'+i);const chosen=model.blocks.find(b=>b.raw.includes('Invented focus')),operations=[{kind:'photoAspect',id:chosen.id,seenBlockHash:createHash('sha256').update(chosen.raw).digest('hex'),aspect:query.get('aspect')}],candidate=nativePlacement.apply(model,read.document.text,operations);return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:'synthetic-artifact',hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:createHash('sha256').update(candidate.raw).digest('hex'),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:[query.get('placementId')],operations})};}return fetch(url,options);};
 const read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),proof=ui.w.studyDraft.currentProof(),block=read.projection.find(b=>b.raw.includes('Invented focus'));
 return {...f,ui,file,calls,original:fs.readFileSync(file,'utf8'),input:{storyId:selection.storyId,pieceId:selection.pieceId,parentStudyId:ui.p.id,sequence:proof.sequence,expectedHash:proof.draftHash,artifactId:'synthetic-artifact',revision:'a'.repeat(64),placementId:'b'.repeat(64),blockId:block.id,aspect:'1/1'}};
}

test('Arrange shape change keeps the writing owner, photo focus, saved recovery and exact Undo',async t=>{
 const f=await aspectEditor(t),before=treeHashes(f.f.vault);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canAspect,true);const result=await f.ui.w.studyDraft.aspectMagazinePlacement(f.input);assert.equal(result.dirty,false);assert.equal(fs.readFileSync(f.file,'utf8'),f.original.replace('aspect=4/5','aspect=1/1'));assert.equal(f.ui.p.viewedStage,9);assert.equal(result.canUndo,true);await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:result.sequence});assert.deepEqual(treeHashes(f.f.vault),before);assert.equal(f.ui.p.viewedStage,9);
});
test('lost shape save reopens with one retained owner request and exact Undo',async t=>{
 const f=await aspectEditor(t);f.ui.loseSave();await f.ui.w.studyDraft.aspectMagazinePlacement(f.input);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;f.ui.dom.window.close();const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],fetch=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return fetch(url,options);};await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.deepEqual(replay,[pending]);assert.equal(ui.w.studyDraft.currentProof().dirty,false);await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('shape changes reject stale, dirty, switched, unsupported and forged preparations before saving',async t=>{
 for(const mode of ['dirty','sequence','navigation','hash','owner','aspect','extra-field','unknown-operation','unsupported-owner','bad-ratio']){const f=await aspectEditor(t),fetch=f.ui.w.fetch;if(mode==='dirty'){f.ui.w.viewPhase(5);f.ui.type('Changed opening kept before shape.');f.ui.w.viewPhase(9);}if(mode==='sequence')f.input.sequence++;if(mode==='bad-ratio')f.input.aspect='2/0';
 if(mode==='unsupported-owner'){f.ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/working-draft/read?')){const value=await result.json();value.supportedNativeOperations=['photoFocus'];return {ok:true,json:async()=>value};}return result;};await f.ui.open();f.ui.w.viewPhase(9);}
 else f.ui.w.fetch=async(url,options)=>{const result=await fetch(url,options);if(String(url).includes('/aspect-plan?')){if(mode==='navigation'){f.ui.w.viewPhase(8);return result;}const value=await result.json();if(mode==='hash')value.expectedContentHash='0'.repeat(64);if(mode==='owner')value.ownerRef.pieceId='wrong';if(mode==='aspect')value.operations[0].aspect='4/3';if(mode==='extra-field')value.operations[0].x=.9;if(mode==='unknown-operation')value.operations[0].kind='photoFocus';return {ok:true,json:async()=>value};}return result;};await assert.rejects(f.ui.w.studyDraft.aspectMagazinePlacement(f.input));assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);
 }
 const f=await aspectEditor(t),gate=pauseResponse(f.ui,'prepare'),changing=f.ui.w.studyDraft.aspectMagazinePlacement(f.input);await gate.entered;f.ui.w.viewPhase(8);gate.release();await assert.rejects(changing,/current work changed/);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(c=>c.url.endsWith('/save')),false);
});

test('clean readonly Magazine Check reload flush stays clean and makes no manuscript request or write',async t=>{
 const {f,origin,windows}=await nativeFixture(t,{writable:false}),before=treeHashes(f.vault),initial=editor(origin,windows);
 await initial.w.studyDraft.openMagazine({...selection,parentStudyId:initial.p.id,presentationStage:7});
 assert.equal(initial.w.studyDraft.currentProof().dirty,false);assert.equal(initial.w.studyDraft.currentProof().editable,false);
 const storage=initial.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),project=structuredClone(initial.p);initial.dom.window.close();
 const restored=editor(origin,windows,{storage,project}),blocks=JSON.stringify(restored.p.blocks),requests=[],fetch=restored.w.fetch;
 restored.w.fetch=async(url,options)=>{requests.push({url,method:options?.method||'GET'});return fetch(url,options);};
 assert.equal(restored.w.studyDraft.currentProof().dirty,false,'retained read-only owner is initially clean');
 assert.equal((await restored.w.studyDraft.flush()).dirty,false,'startup may flush an unchanged readonly owner before exact Check pickup');
 assert.equal(requests.length,0);assert.equal(JSON.stringify(restored.p.blocks),blocks);assert.deepEqual(treeHashes(f.vault),before);
 await restored.w.studyDraft.openMagazine({...selection,parentStudyId:restored.p.id,presentationStage:7});assert.equal(restored.p.viewedStage,7);assert.equal(restored.w.studyDraft.currentProof().dirty,false);
});

test('readonly no-op recovery preserves pending requests, rejected paste and changed words as unsaved',async t=>{
 const {f,origin,windows}=await nativeFixture(t,{writable:false}),initial=editor(origin,windows);await initial.w.studyDraft.openMagazine({...selection,parentStudyId:initial.p.id,presentationStage:7});
 const stored=JSON.parse(initial.w.localStorage.getItem('ar-document-study-owned-drafts-v1')),project=structuredClone(initial.p),before=treeHashes(f.vault);initial.dom.window.close();
 for(const scenario of ['false-unavailable','pending','rejected','changed']){
  const disk=structuredClone(stored),d=disk.documents[selection.pieceId];d.status='Save unavailable';d.error='An earlier read-only flush was unavailable.';
  if(scenario==='pending')d.pending={request:{...selection,operationId:randomUUID(),expectedHash:d.expected.workflow.draft,content:d.serverRaw},sequence:d.sequence,blocks:structuredClone(d.blocks)};
  if(scenario==='rejected')d.rejectedPaste=true;
  if(scenario==='changed')d.blocks[0].html+=' Exact retained unsaved words.';
  const ui=editor(origin,windows,{storage:JSON.stringify(disk),project}),requests=[];ui.w.fetch=async(...args)=>{requests.push(args);throw Error('Read-only flush must not send a write.');};
  const words=JSON.stringify(ui.p.blocks),proof=await ui.w.studyDraft.flush(),after=JSON.parse(ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1')).documents[selection.pieceId];
  assert.equal(proof.dirty,scenario!=='false-unavailable',scenario);assert.equal(requests.length,0,scenario);assert.equal(JSON.stringify(ui.p.blocks),words,scenario);assert.deepEqual(treeHashes(f.vault),before,scenario);
  if(scenario==='pending')assert.deepEqual(after.pending,d.pending);
  if(scenario==='rejected')assert.equal(after.rejectedPaste,true);
  ui.dom.window.close();
 }
});

async function replacementEditor(t){
 const f=await nativeFixture(t),file=path.join(f.f.vault,DEV),target='%%photo: first.png · Target photo · wide aspect=4/5 narrow left x=0.2 y=0.8%%',replacement='%%photo: second.png · Replacement description · bleed x=0.7 y=0.4%%';
 const original=['---','type: DEV','story: Clay Teacher','---','','Invented metadata.','','---','','I met Mira at the edge of the village.','',target,'','Invented words between photographs.','',replacement,'','Invented final words.','','%%ending%%','','%%saying%%','> "An invented closing saying."','','Invented closing words.','','---','','Invented retained notes.',''].join('\n');fs.writeFileSync(file,original);
 const ui=editor(f.origin,f.windows);await ui.open();ui.w.viewPhase(9);const calls=[],fetch=ui.w.fetch,read=await(await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),targetBlock=read.projection.find(block=>block.raw.includes('Target photo')),replacementBlock=read.projection.find(block=>block.raw.includes('Replacement description'));
 const input={storyId:selection.storyId,pieceId:selection.pieceId,parentStudyId:ui.p.id,sequence:ui.w.studyDraft.currentProof().sequence,expectedHash:read.document.hash,artifactId:'synthetic-artifact',revision:'a'.repeat(64),placementId:'b'.repeat(64),blockId:targetBlock.id,replacementPlacementId:'d'.repeat(64),replacementBlockId:replacementBlock.id,sourceId:'e'.repeat(64),sourceHash:'f'.repeat(64)};
 ui.w.fetch=async(url,options)=>{calls.push({url:String(url),body:options?.body?JSON.parse(options.body):null});if(String(url).startsWith('/api/review/magazine-media/replace-plan?')){const query=new URL(url,f.origin).searchParams,operations=[{kind:'photoReplace',id:targetBlock.id,seenBlockHash:targetBlock.blockHash,replacementId:replacementBlock.id,seenReplacementHash:replacementBlock.blockHash}];return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:input.artifactId,hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:createHash('sha256').update(original.replace('first.png · Target photo','second.png · Replacement description')).digest('hex'),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:[query.get('placementId')],replacementPlacementId:query.get('replacementPlacementId'),sourceId:query.get('sourceId'),sourceHash:query.get('sourceHash'),operations})};}return fetch(url,options);};
 return {...f,ui,file,original,target,replacement,input,calls};
}
test('article photo replacement reuses the exact existing writer, preserves target crop and donor occurrence, and supports exact Undo',async t=>{
 const f=await replacementEditor(t),before=treeHashes(f.f.vault);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canReplace,true);const result=await f.ui.w.studyDraft.replaceMagazinePlacement(f.input);assert.equal(result.dirty,false);assert.equal(result.canUndo,true);assert.equal(f.ui.p.viewedStage,9);assert.equal(fs.readFileSync(f.file,'utf8'),f.original.replace('first.png · Target photo','second.png · Replacement description'));
 const plan=f.calls.find(call=>call.url.includes('/replace-plan?'));assert.deepEqual([...new URL(plan.url,f.origin).searchParams.keys()].sort(),['storyId','pieceId','expectedHash','revision','placementId','replacementPlacementId','sourceId','sourceHash'].sort());assert.equal('file' in f.calls.find(call=>call.url.endsWith('/prepare')).body.operations[0],false);
 await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:result.sequence});assert.deepEqual(treeHashes(f.f.vault),before);
});
test('photo replacement refuses forged operations, wrong revisions or sources, dirty words and switched work before saving',async t=>{
 for(const scenario of ['foreign-owner','target-block','donor-block','target-hash','donor-hash','source-id','source-hash','donor-placement','multiple-targets','extra-operation-field','uploaded-file','input-extra','wrong-sequence','dirty','navigation','content-hash']){
  const f=await replacementEditor(t),fetch=f.ui.w.fetch;
  if(scenario==='input-extra')f.input.file='forged.png';if(scenario==='wrong-sequence')f.input.sequence++;if(scenario==='dirty'){f.ui.w.viewPhase(5);f.ui.type('Changed opening preserved before replacing a photo.');f.ui.w.viewPhase(9);}
  f.ui.w.fetch=async(url,options)=>{const response=await fetch(url,options);if(!String(url).includes('/replace-plan?'))return response;if(scenario==='navigation'){f.ui.w.viewPhase(8);return response;}const value=await response.json();if(scenario==='foreign-owner')value.ownerRef.pieceId='foreign';if(scenario==='target-block')value.operations[0].id=f.input.replacementBlockId;if(scenario==='donor-block')value.operations[0].replacementId=f.input.blockId;if(scenario==='target-hash')value.operations[0].seenBlockHash='0'.repeat(64);if(scenario==='donor-hash')value.operations[0].seenReplacementHash='0'.repeat(64);if(scenario==='source-id')value.sourceId='0'.repeat(64);if(scenario==='source-hash')value.sourceHash='0'.repeat(64);if(scenario==='donor-placement')value.replacementPlacementId=f.input.placementId;if(scenario==='multiple-targets')value.placementIds.push(f.input.replacementPlacementId);if(scenario==='extra-operation-field')value.operations[0].x=.9;if(scenario==='uploaded-file')value.operations[0].file='forged.png';if(scenario==='content-hash')value.expectedContentHash='0'.repeat(64);return {ok:true,json:async()=>value};};
  await assert.rejects(f.ui.w.studyDraft.replaceMagazinePlacement(f.input),scenario);assert.equal(fs.readFileSync(f.file,'utf8'),f.original,scenario);assert.equal(f.calls.some(call=>call.url.endsWith('/save')),false,scenario);
 }
});

test('lost photo replacement response reopens one retained save and exact Undo without choosing again',async t=>{
 const f=await replacementEditor(t);f.ui.loseSave();await f.ui.w.studyDraft.replaceMagazinePlacement(f.input);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;f.ui.dom.window.close();const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],fetch=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return fetch(url,options);};await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.deepEqual(replay,[pending]);assert.equal(ui.w.studyDraft.currentProof().dirty,false);await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('photo replacement cannot apply a delayed plan or preparation after navigation, typing, or an external draft change',async t=>{
 for(const boundary of ['plan','prepare'])for(const change of ['navigation','typing','external']){const f=await replacementEditor(t),fetch=f.ui.w.fetch;let release,entered;const waiting=new Promise(resolve=>entered=resolve);f.ui.w.fetch=async(url,options)=>{const response=await fetch(url,options);if(String(url).includes(boundary==='plan'?'/replace-plan?':'/working-draft/prepare')){entered();await new Promise(resolve=>release=resolve);}return response;};const changing=f.ui.w.studyDraft.replaceMagazinePlacement(f.input);await waiting;if(change==='navigation')f.ui.w.viewPhase(8);if(change==='typing'){f.ui.w.viewPhase(5);f.ui.type('Changed opening kept while a photo replacement was pending.');f.ui.w.viewPhase(9);}if(change==='external')fs.appendFileSync(f.file,'\nExact external words remain.\n');release();if(boundary==='prepare'&&change==='external'){const retained=await changing;assert.equal(retained.dirty,true);assert.equal(retained.canRetry,true);}else{await assert.rejects(changing);assert.equal(f.calls.some(call=>call.url.endsWith('/save')),false,boundary+' '+change);}assert.equal(fs.readFileSync(f.file,'utf8'),change==='external'?f.original+'\nExact external words remain.\n':f.original);}
});

async function libraryPhotoEditor(t){
 const f=await aspectEditor(t),photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),name='unplaced-cross-story.png';fs.writeFileSync(path.join(f.f.files,'River Potter','Photos',name),photo);
 const catalogResponse=await fetch(f.origin+'/api/magazine/library-photos'),catalog=await catalogResponse.json();assert.equal(catalogResponse.status,200,JSON.stringify(catalog));const asset=catalog.items.find(item=>item.name===name);assert.ok(asset,'the real owner catalogs the unplaced photo from another story');
 const input={...f.input,assetRootId:asset.rootId,assetSourceId:asset.sourceId,assetRevision:asset.revision,assetHash:asset.sourceHash,description:''};delete input.aspect;
 const fetchUI=f.ui.w.fetch;f.ui.w.fetch=async(url,options)=>{if(String(url).startsWith('/api/review/magazine-media/library-replace-plan?')){f.calls.push({url:String(url),body:null});const query=new URL(url,f.origin).searchParams,read=await(await fetchUI('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),model=nativePlacement.capture(read.document.text,selection.pieceId);model.blocks.forEach((block,i)=>block.id='magazine:'+encodeURIComponent(selection.pieceId)+':'+i);const block=model.blocks.find(row=>row.id===input.blockId),op={kind:'photoReplaceAsset',id:block.id,seenBlockHash:block.origin.blockHash,rootId:query.get('assetRootId'),sourceId:query.get('assetSourceId'),revision:query.get('assetRevision'),sourceHash:query.get('assetHash'),description:query.get('description')},candidate=nativePlacement.apply(model,read.document.text,[op],{photoAssets:[{...op,file:'library-photo-'+op.sourceHash+'.png'}]});return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:input.artifactId,hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:createHash('sha256').update(candidate.raw).digest('hex'),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:[input.placementId],operations:[op]})};}return fetchUI(url,options);};
 return {...f,input,asset,photo};
}
test('unplaced library photo uses immutable owned bytes, optional description and the existing saved Undo',async t=>{
 const f=await libraryPhotoEditor(t),before=treeHashes(f.f.vault),dataBefore=treeHashes(f.f.data);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canReplaceAsset,true);assert.equal(Object.keys(dataBefore).some(name=>name.includes('library/originals')),false);const result=await f.ui.w.studyDraft.replaceMagazineAsset(f.input);assert.equal(result.dirty,false);assert.equal(result.canUndo,true);const saved=fs.readFileSync(f.file,'utf8');assert.match(saved,new RegExp('library-photo-'+f.asset.sourceHash+'\\.png'));assert.ok(saved.includes(' ·  · wide aspect=4/5 narrow left x=0.2 y=0.8%%'),'blank description does not borrow the earlier photo’s description');const index=JSON.parse(fs.readFileSync(path.join(f.f.data,'library-index.json'))),retained=index.sources.filter(source=>source.provenance?.kind==='magazine-library-photo');assert.equal(retained.length,1);const preview=await fetch(f.origin+'/api/magazine/library-photos/asset?'+new URLSearchParams({file:'library-photo-'+f.asset.sourceHash+'.png'}));assert.deepEqual(Buffer.from(await preview.arrayBuffer()),f.photo);await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:result.sequence});assert.deepEqual(treeHashes(f.f.vault),before);
});
test('library asset hook refuses forged selectors, target proofs, hidden fields and invalid descriptions before saving',async t=>{
 for(const scenario of ['source','root','asset-revision','asset-hash','description','target-hash','target-id','owner','extra-op','extra-input','invalid-description','sequence']){const f=await libraryPhotoEditor(t),fetchUI=f.ui.w.fetch;if(scenario==='extra-input')f.input.file='uploaded.png';if(scenario==='invalid-description')f.input.description='100% unsupported';if(scenario==='sequence')f.input.sequence++;
 f.ui.w.fetch=async(url,options)=>{const response=await fetchUI(url,options);if(!String(url).includes('/library-replace-plan?'))return response;const value=await response.json();if(scenario==='source')value.operations[0].sourceId='0'.repeat(64);if(scenario==='root')value.operations[0].rootId='0'.repeat(64);if(scenario==='asset-revision')value.operations[0].revision='0'.repeat(64);if(scenario==='asset-hash')value.operations[0].sourceHash='0'.repeat(64);if(scenario==='description')value.operations[0].description='A forged description';if(scenario==='target-hash')value.operations[0].seenBlockHash='0'.repeat(64);if(scenario==='target-id')value.operations[0].id='foreign';if(scenario==='owner')value.ownerRef.pieceId='foreign';if(scenario==='extra-op')value.operations[0].file='uploaded.png';return {ok:true,json:async()=>value};};await assert.rejects(f.ui.w.studyDraft.replaceMagazineAsset(f.input),scenario);assert.equal(fs.readFileSync(f.file,'utf8'),f.original,scenario);assert.equal(f.calls.some(call=>call.url.endsWith('/save')),false,scenario);}
});

test('lost library photo save replays one retained request and immutable photo bytes survive removal of the original',async t=>{
 const f=await libraryPhotoEditor(t);f.input.description='A chosen description 瓷 😀';f.ui.loseSave();await f.ui.w.studyDraft.replaceMagazineAsset(f.input);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;fs.unlinkSync(path.join(f.f.files,'River Potter','Photos',f.asset.name));f.ui.dom.window.close();const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],fetchUI=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return fetchUI(url,options);};await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.deepEqual(replay,[pending]);assert.equal(ui.w.studyDraft.currentProof().dirty,false);assert.match(fs.readFileSync(f.file,'utf8'),/A chosen description 瓷 😀/);const preview=await fetch(f.origin+'/api/magazine/library-photos/asset?'+new URLSearchParams({file:'library-photo-'+f.asset.sourceHash+'.png'}));assert.deepEqual(Buffer.from(await preview.arrayBuffer()),f.photo);await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('lost prepare response reuses its retained Library asset without a duplicate copy or manuscript change',async t=>{
 const f=await libraryPhotoEditor(t),fetchUI=f.ui.w.fetch;let lose=true;f.ui.w.fetch=async(url,options)=>{const response=await fetchUI(url,options);if(lose&&String(url).endsWith('/prepare')){lose=false;throw Error('Synthetic lost preparation response.');}return response;};await assert.rejects(f.ui.w.studyDraft.replaceMagazineAsset(f.input));assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.ui.w.studyDraft.currentProof().dirty,false);const retained=()=>JSON.parse(fs.readFileSync(path.join(f.f.data,'library-index.json'))).sources.filter(source=>source.provenance?.kind==='magazine-library-photo');assert.equal(retained().length,1);const id=retained()[0].id;await f.ui.w.studyDraft.replaceMagazineAsset(f.input);assert.equal(retained().length,1);assert.equal(retained()[0].id,id);await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:f.ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('library photo selection retains no bytes after a delayed plan sees changed source or local work',async t=>{
 for(const change of ['source','navigation','typing']){const f=await libraryPhotoEditor(t),fetchUI=f.ui.w.fetch;let release,entered;const waiting=new Promise(resolve=>entered=resolve);f.ui.w.fetch=async(url,options)=>{const response=await fetchUI(url,options);if(String(url).includes('/library-replace-plan?')){entered();await new Promise(resolve=>release=resolve);}return response;};const changing=f.ui.w.studyDraft.replaceMagazineAsset(f.input);await waiting;if(change==='source')fs.writeFileSync(path.join(f.f.files,'River Potter','Photos',f.asset.name),Buffer.from('changed synthetic bytes'));if(change==='navigation')f.ui.w.viewPhase(8);if(change==='typing'){f.ui.w.viewPhase(5);f.ui.type('Changed opening remains while choosing a library photo.');f.ui.w.viewPhase(9);}release();await assert.rejects(changing);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);assert.equal(f.calls.some(call=>call.url.endsWith('/save')),false);const index=fs.existsSync(path.join(f.f.data,'library-index.json'))?JSON.parse(fs.readFileSync(path.join(f.f.data,'library-index.json'))):{sources:[]};assert.equal(index.sources.some(source=>source.provenance?.kind==='magazine-library-photo'),false);}
});
test('library hook refuses ambiguous descriptions and caller-selected destinations without issuing any request',async t=>{
 const f=await libraryPhotoEditor(t),before=f.calls.length;for(const description of ['% hidden','A · delimiter','Two\nlines','\u0000','\ud800','x'.repeat(2001),' untrimmed '])await assert.rejects(f.ui.w.studyDraft.replaceMagazineAsset({...f.input,description}));for(const extra of [{file:'chosen.png'},{path:'/private/secret'},{content:'raw bytes'},{assetSourceId:'../../foreign'}])await assert.rejects(f.ui.w.studyDraft.replaceMagazineAsset({...f.input,...extra}));assert.equal(f.calls.length,before);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});

async function descriptionEditor(t){
 const f=await nativeFixture(t),file=path.join(f.f.vault,DEV),raw='%%photo: invented.png · Invented focus · wide aspect=4/5 narrow left x=0.2 y=0.8%%';
 fs.writeFileSync(file,['---','type: DEV','story: Clay Teacher','---','','Invented reader metadata.','','---','','I met Mira at the edge of the village, where the kilns stand in a row.','',raw,'','Invented retained paragraph.','','%%ending%%','','%%saying%%','> "An invented closing saying."','','Invented closing words.','','---','','Invented retained notes.',''].join('\n'));
 const ui=editor(f.origin,f.windows);await ui.open();ui.w.viewPhase(9);const calls=[],fetch=ui.w.fetch;
 ui.w.fetch=async(url,options)=>{calls.push({url:String(url),body:options?.body?JSON.parse(options.body):null});if(String(url).startsWith('/api/review/magazine-media/description-plan?')){const query=new URL(url,f.origin).searchParams,read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),model=nativePlacement.capture(read.document.text,selection.pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(selection.pieceId)+':'+i);const chosen=model.blocks.find(b=>b.raw.includes('Invented focus')),operations=[{kind:'photoDescription',id:chosen.id,seenBlockHash:createHash('sha256').update(chosen.raw).digest('hex'),description:query.get('description')}],candidate=nativePlacement.apply(model,read.document.text,operations);return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:'synthetic-artifact',hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:createHash('sha256').update(candidate.raw).digest('hex'),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:[query.get('placementId')],operations})};}return fetch(url,options);};
 const read=await (await fetch('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),proof=ui.w.studyDraft.currentProof(),block=read.projection.find(b=>b.raw.includes('Invented focus'));
 return {...f,ui,file,calls,original:fs.readFileSync(file,'utf8'),input:{storyId:selection.storyId,pieceId:selection.pieceId,parentStudyId:ui.p.id,sequence:proof.sequence,expectedHash:proof.draftHash,artifactId:'synthetic-artifact',revision:'a'.repeat(64),placementId:'b'.repeat(64),blockId:block.id,description:'Exact description 瓷 😀'}};
}

test('Arrange description change keeps the writing owner, photo focus, saved recovery and exact Undo',async t=>{
 const f=await descriptionEditor(t),before=treeHashes(f.f.vault);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canDescribe,true);const result=await f.ui.w.studyDraft.describeMagazinePlacement(f.input);assert.equal(result.dirty,false);assert.equal(fs.readFileSync(f.file,'utf8'),f.original.replace('Invented focus','Exact description 瓷 😀'));assert.equal(f.ui.p.viewedStage,9);assert.equal(result.canUndo,true);await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:result.sequence});assert.deepEqual(treeHashes(f.f.vault),before);assert.equal(f.ui.p.viewedStage,9);
});
test('lost description save reopens with one retained owner request and exact Undo',async t=>{
 const f=await descriptionEditor(t);f.ui.loseSave();await f.ui.w.studyDraft.describeMagazinePlacement(f.input);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;f.ui.dom.window.close();const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],fetch=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return fetch(url,options);};await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.deepEqual(replay,[pending]);assert.equal(ui.w.studyDraft.currentProof().dirty,false);await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});

test('native owner composition directives stay out of editorial notes without changing canonical bytes or anchors',async t=>{
 const {f,origin,windows}=await nativeFixture(t),file=path.join(f.vault,DEV);
 const composition=['%%photo: trial.png · Invented photo · wide%%','%%photos: one.png · First | two.png · Second · stagger%%','%%side: side.png · Side · flip%%','%%/side%%','%%glyph: 缘分%%','%%/glyph%%','%%on-photo: overlay.png · Overlay · aspect=4/5 ink=#fff accent=#111%%','%%ending%%','%%saying: close.png · Closing · aspect=4/5%%\n> "Exact saying."','%%saying%%\n> "Another saying."'];
 const retained=['%%you: Is this the right passage?%%','%%was: Exact earlier wording.%%','%%pull: l%%\n> "Whole thought."','%%check: Confirm this source.%%','%%photo: consider another photograph%%','%%ending: consider a different close%%','%%glyph: consider another word%%','A human sentence %%photo: note.png · A deliberate inline annotation%%'];
 const raw=fs.readFileSync(file,'utf8')+'\n'+[...composition,...retained].join('\n\n')+'\n';fs.writeFileSync(file,raw);const before=treeHashes(f.vault),ui=editor(origin,windows);await ui.open();
 assert.deepEqual(structuredClone(ui.p.originalNotes).map(n=>[n.kind,n.text]),[['Author question','Is this the right passage?'],['Earlier wording','Exact earlier wording.'],['Layout note','l'],['Working note','Confirm this source.'],['Working note','consider another photograph'],['Working note','consider a different close'],['Working note','consider another word'],['Working note','note.png · A deliberate inline annotation']]);
 const first=structuredClone(ui.p.originalNotes);assert.ok(first.every(note=>ui.p.blocks.some(block=>block.id===note.anchor)),'every retained note keeps its native projection anchor');
 ui.w.viewPhase(1);await ui.open();assert.deepEqual(structuredClone(ui.p.originalNotes),first);assert.deepEqual(treeHashes(f.vault),before);assert.equal(fs.readFileSync(file,'utf8'),raw);
});

test('composition-only native owner has no recorded editorial notes',async t=>{
 const {f,origin,windows}=await nativeFixture(t),file=path.join(f.vault,DEV);fs.appendFileSync(file,'\n%%photo: trial.png · Invented photo · wide%%\n\n%%ending%%\n\n%%saying%%\n> "An invented close."\n');const before=treeHashes(f.vault),ui=editor(origin,windows);await ui.open();assert.deepEqual(Array.from(ui.p.originalNotes),[]);assert.deepEqual(treeHashes(f.vault),before);
});

async function annotationEditor(t,{credits=false}={}){
 const f=await descriptionEditor(t),transport=f.ui.w.fetch;delete f.input.description;
 f.input[credits?'credits':'annotation']=credits?['Invented photographer 瓷','Invented translation credit']:{caption:'An invented caption with 100% 瓷 😀',credit:'Invented photographer'};
 f.ui.w.fetch=async(url,options)=>{if(String(url).startsWith('/api/review/magazine-media/'+(credits?'credits-plan':'annotation-plan')+'?')){const query=new URL(url,f.origin).searchParams,read=await (await transport('/api/magazine/working-draft/read?'+new URLSearchParams(selection))).json(),model=nativePlacement.capture(read.document.text,selection.pieceId);model.blocks.forEach((block,index)=>block.id='magazine:'+encodeURIComponent(selection.pieceId)+':'+index);const block=model.blocks.find(b=>b.raw.includes('Invented focus')),op=credits?{kind:'articleCredits',credits:JSON.parse(query.get('credits'))}:{kind:'photoAnnotation',id:block.id,seenBlockHash:shaNative(block.raw),annotation:JSON.parse(query.get('annotation'))},operations=[op],candidate=nativePlacement.apply(model,read.document.text,operations);return {ok:true,json:async()=>({schema:'ar-create.magazine-placement-plan.v1',ownerRef:{projectId:selection.storyId,pieceId:selection.pieceId,editionId:'working',artifactId:'synthetic-artifact',hash:read.document.hash},expectedHash:read.document.hash,expectedContentHash:shaNative(candidate.raw),revision:query.get('revision'),scope:'c'.repeat(64),placementIds:credits?[]:[query.get('placementId')],operations})};}return transport(url,options);};
 if(credits){delete f.input.placementId;delete f.input.blockId;}return f;
}
const shaNative=value=>createHash('sha256').update(value).digest('hex');
test('Arrange captions and article credits keep the same canonical writer and exact Undo',async t=>{
 for(const credits of [false,true]){const f=await annotationEditor(t,{credits}),before=treeHashes(f.f.vault),method=credits?'saveMagazineCredits':'annotateMagazinePlacement';assert.equal(f.ui.w.studyDraft.magazineArrangeState()[credits?'canCredits':'canAnnotate'],true);const saved=await f.ui.w.studyDraft[method](f.input);assert.equal(saved.dirty,false,JSON.stringify({credits,status:saved.status,error:JSON.parse(f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1')).documents[selection.pieceId].error}));assert.equal(f.ui.p.viewedStage,9);assert.match(fs.readFileSync(f.file,'utf8'),credits?/ar-create-credits:/ : /ar-create-photo:/);assert.equal(f.ui.p.originalNotes.some(n=>/ar-create-|caption|photographer/.test(n.text)),false,'supplemental metadata never becomes an editorial note');assert.equal(saved.canUndo,true);await f.ui.w.studyDraft.undoMagazinePlacement({parentStudyId:f.ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:saved.sequence});assert.deepEqual(treeHashes(f.f.vault),before);}
});
test('lost caption save retains one exact owner request through reopen and Undo',async t=>{
 const f=await annotationEditor(t);f.ui.loseSave();await f.ui.w.studyDraft.annotateMagazinePlacement(f.input);assert.equal(f.ui.w.studyDraft.magazineArrangeState().canRetry,true);const storage=f.ui.w.localStorage.getItem('ar-document-study-owned-drafts-v1'),pending=JSON.parse(storage).documents[selection.pieceId].pending.request;f.ui.dom.window.close();const ui=editor(f.origin,f.windows,{storage});await ui.open();ui.w.viewPhase(9);const replay=[],transport=ui.w.fetch;ui.w.fetch=async(url,options)=>{if(String(url).endsWith('/save'))replay.push(JSON.parse(options.body));return transport(url,options);};await ui.w.studyDraft.retryMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.deepEqual(replay,[pending]);assert.equal(ui.w.studyDraft.currentProof().dirty,false);await ui.w.studyDraft.undoMagazinePlacement({parentStudyId:ui.p.id,storyId:selection.storyId,pieceId:selection.pieceId,sequence:ui.w.studyDraft.currentProof().sequence});assert.equal(fs.readFileSync(f.file,'utf8'),f.original);
});
test('caption planning refuses mismatched prepared wording and oversized Unicode before any owner save',async t=>{for(const mode of ['tampered','long']){const f=await annotationEditor(t),transport=f.ui.w.fetch;let prepares=0,plans=0;f.ui.w.fetch=async(url,options)=>{if(String(url).includes('/working-draft/prepare'))prepares++;if(String(url).includes('/annotation-plan?')){plans++;const response=await transport(url,options),value=await response.json();value.operations[0].annotation.credit='Unexpected replacement';return {ok:true,json:async()=>value};}return transport(url,options);};if(mode==='long')f.input.annotation={caption:'瓷'.repeat(4000),credit:''};await assert.rejects(f.ui.w.studyDraft.annotateMagazinePlacement(f.input),mode==='long'?/too long/:/different/);assert.equal(prepares,0);assert.equal(plans,mode==='long'?0:1);assert.equal(fs.readFileSync(f.file,'utf8'),f.original);}});
test('ordinary prose edits preserve canonical article credits without treating their hidden block as deleted wording',async t=>{const f=await annotationEditor(t,{credits:true});await f.ui.w.studyDraft.saveMagazineCredits(f.input);f.ui.w.studyDraft.edit();f.ui.type('Changed opening words while keeping the exact article credits.');await f.ui.w.studyDraft.flush();assert.equal(f.ui.w.studyDraft.currentProof().dirty,false);const raw=fs.readFileSync(f.file,'utf8');assert.match(raw,/Changed opening words while keeping the exact article credits/);assert.equal((raw.match(/%%ar-create-credits:/g)||[]).length,1);assert.match(raw,/Invented photographer/);assert.equal(f.ui.p.originalNotes.some(n=>/ar-create-credits/.test(n.text)),false);});
test('unrecognized or malformed caption-like notes remain visible as human notes',async t=>{const {f,origin,windows}=await nativeFixture(t),file=path.join(f.vault,DEV),raw=fs.readFileSync(file,'utf8')+'\n\n%%ar-create-credits: consider asking the photographer%%\n\n%%ar-create-photo: {bad JSON}%%\n';fs.writeFileSync(file,raw);const ui=editor(origin,windows);await ui.open();assert.ok(ui.p.originalNotes.some(note=>note.text.includes('consider asking the photographer')));assert.ok(ui.p.originalNotes.some(note=>note.text.includes('{bad JSON}')));assert.equal(fs.readFileSync(file,'utf8'),raw);});
