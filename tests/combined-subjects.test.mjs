import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/combined-subjects.js',import.meta.url),'utf8');
const piecesCode=fs.readFileSync(new URL('../public/document-study/workbench-pieces.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
const hash='a'.repeat(64);
function boot({refuse=false}={}){
 const dom=new JSDOM('<dialog id="project-library"><input id="original" value="Unsent human words"></dialog><p id="wn-message"></p>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document;
 const p={id:'p',name:'Invented test subject',folder:'Travel',view:'article',viewedStage:5,ownedDraft:{id:'binding'},blocks:[]},catalog={mode:'existing-work-read-only',stories:[{id:'story-p',nativeProjectId:'p',name:'Invented test subject',artifacts:[{artifactId:'raw',kind:'RAW',hash,title:'Recorded conversation'},{artifactId:'research',kind:'RESEARCH',hash,title:'Retained evidence'},{artifactId:'article',kind:'DEV',hash,title:'Existing article'}],latestDraft:{artifactId:'article',hash,title:'Existing article'}}],excludedProjectIds:['fixture']};
 const calls=[];w.state={projects:[p,{id:'fixture',name:'Hidden fixture',collectionBindingId:'fixture-binding'}]};w.current=()=>p;w.save=()=>{throw Error('Navigation must not save state');};w.projectLibrary={open:async options=>{calls.push(['open',options]);if(refuse)throw Error('Save refused');d.querySelector('dialog').open=true;},close:async()=>{calls.push(['close']);if(refuse)throw Error('Save refused');d.querySelector('dialog').open=false;d.querySelector('dialog').dispatchEvent(new w.Event('close'));},whenIdle:async()=>{}};
 w.existingWork={catalog:()=>catalog,load:async()=>catalog,openStory:async(...args)=>calls.push(['story',...args]),openArtifact:async(...args)=>calls.push(['artifact',...args]),openWorkingDraft:async(...args)=>calls.push(['draft',...args])};
 w.workspaceNavigation={lastLocation:id=>({projectId:id,item:{anchor:{index:5}}})};w.switchProject=async id=>calls.push(['switch',id]);w.viewPhase=async stage=>calls.push(['stage',stage]);w.matchMedia=()=>({matches:false});w.nativeDraftCatalog={read:async()=>({drafts:[],excludedProjectIds:['fixture']})};
 let output={id:'carousel',title:'Independent carousel',format:'Carousel',kind:'carousel',edition:'working',rootBindingId:'root-p',status:'draft',revision:2,actions:[{kind:'words'}]};
 w.realOutputOverview={read:async({projectId})=>({projectId,outputs:[output]}),onAction:async input=>calls.push(['action',input])};w.studyDraft={flush:async()=>({dirty:false})};w.eval(piecesCode);w.eval(code);
 return {w,d,p,catalog,calls,get output(){return output;},set output(o){output=o;},close:()=>w.close()};
}
test('Subjects and board preserve unsent owner nodes, pickup, real metadata and fixture exclusions',async()=>{
 const f=boot();try{const original=f.d.querySelector('#original'),before=JSON.stringify(f.w.state);await f.w.combinedSubjects.open();assert.equal(f.d.querySelector('dialog').dataset.combinedSubjects,'true');assert.doesNotMatch(f.d.querySelector('.combined-subjects').textContent,/Hidden fixture/);assert.match(f.d.querySelector('.combined-subjects').textContent,/Continue at ¶6/);f.d.querySelector('[data-cs-subject="p"]').click();await tick();await tick();assert.match(f.d.querySelector('.cs-board').textContent,/Recorded conversation/);assert.match(f.d.querySelector('.cs-board').textContent,/Retained evidence/);assert.match(f.d.querySelector('.cs-board').textContent,/Independent carousel/);assert.match(f.d.querySelector('.cs-board').textContent,/preview not connected/);assert.equal(f.d.querySelector('#original'),original);assert.equal(original.value,'Unsent human words');assert.equal(JSON.stringify(f.w.state),before);assert.deepEqual(f.calls.map(c=>c[0]),['open']);await f.w.projectLibrary.close();assert.equal(f.d.querySelector('[data-combined-subjects]'),null);assert.equal(f.d.querySelector('.combined-subjects'),null);}finally{f.close();}
});
test('dirty owner refusal stops Subjects before opening or replacing anything',async()=>{
 const f=boot({refuse:true});try{await assert.rejects(f.w.combinedSubjects.open(),/Save refused/);assert.equal(f.d.querySelector('.combined-subjects'),null);assert.equal(f.d.querySelector('#original').value,'Unsent human words');}finally{f.close();}
});
test('board source buttons use exact artifact identity and retain source ownership',async()=>{
 const f=boot();try{await f.w.combinedSubjects.open({projectId:'p'});f.d.querySelector('[data-cs-artifact="raw"]').click();await tick();await tick();assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))),['artifact','story-p','raw']);assert.equal(f.calls.some(c=>['switch','draft','action'].includes(c[0])),false);}finally{f.close();}
});
test('piece references are detached, tokenized and use the existing exact output action',async()=>{
 const f=boot();try{const list=await f.w.workbenchPieces.listForProject('p');const piece=list.pieces.find(r=>r.title==='Independent carousel');assert.ok(piece.reference);assert.equal(piece.rootBindingId,undefined);piece.title='Changed detached copy';const opened=await f.w.workbenchPieces.openReference(piece.reference);assert.equal(opened,true);assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c=>c[0]==='action'))),['action',{projectId:'p',outputId:'carousel',edition:'working',kind:'words'}]);}finally{f.close();}
});
test('a changed output revision refuses a stale board token before opening',async()=>{
 const f=boot();try{const list=await f.w.workbenchPieces.listForProject('p');f.output={...f.output,revision:3};await assert.rejects(f.w.workbenchPieces.openReference(list.pieces.find(r=>r.title==='Independent carousel').reference),/changed/);assert.equal(f.calls.some(c=>['close','switch','action'].includes(c[0])),false);}finally{f.close();}
});
test('a changed source hash refuses the board source action',async()=>{
 const f=boot();try{await f.w.combinedSubjects.open({projectId:'p'});const story=f.catalog.stories[0];f.catalog.stories=[{...story,artifacts:story.artifacts.map(a=>a.artifactId==='raw'?{...a,hash:'b'.repeat(64)}:a)}];f.d.querySelector('[data-cs-artifact="raw"]').click();await tick();assert.match(f.d.querySelector('[role=status]').textContent,/changed/);assert.equal(f.calls.some(c=>c[0]==='artifact'),false);}finally{f.close();}
});
test('native fixture exclusion is confirmed before reading its outputs',async()=>{
 const f=boot();try{let reads=0;f.w.nativeDraftCatalog.read=async()=>({drafts:[],excludedProjectIds:['p']});f.w.realOutputOverview.read=async()=>{reads++;throw Error('Must not read excluded outputs');};await assert.rejects(f.w.workbenchPieces.listForProject('p'),/excluded/);assert.equal(reads,0);}finally{f.close();}
});
test('piece opening refuses a changed active section during its fresh identity read',async()=>{
 const f=boot();try{const list=await f.w.workbenchPieces.listForProject('p');const before=f.w.nativeDraftCatalog.read;f.w.nativeDraftCatalog.read=async options=>{f.p.viewedStage=3;return before(options);};await assert.rejects(f.w.workbenchPieces.openReference(list.pieces.find(r=>r.title==='Independent carousel').reference),/selected work changed/);assert.equal(f.calls.some(c=>['close','action'].includes(c[0])),false);}finally{f.close();}
});
test('board source snapshot also refuses an in-place catalogue hash change',async()=>{
 const f=boot();try{await f.w.combinedSubjects.open({projectId:'p'});f.catalog.stories[0].artifacts[0].hash='c'.repeat(64);f.d.querySelector('[data-cs-artifact="raw"]').click();await tick();assert.match(f.d.querySelector('[role=status]').textContent,/changed/);assert.equal(f.calls.some(c=>c[0]==='artifact'),false);}finally{f.close();}
});
function workspaceFixture(f){
 const target={parentStudyId:'p',rootBindingId:'root-p',partKey:'article',originalId:'original-p',originalHash:hash,kind:'native-root',cataloguedOutputs:[],role:'root-owned-workspace',workspaceId:'workspace-p',documentId:'document-p'};
 f.catalog.workspacePieces=[{id:'workspace-p',documentId:'document-p',title:'Saved original root'}];f.catalog.workspaceLinks={pieces:[{workspaceId:'workspace-p',documentId:'document-p',state:'verified',targets:[target]}]};
 const output={id:'native-carousel',name:'Saved eight slides',title:'Native carousel',kind:'carousel',stage:'words',outputRevision:4,slides:Array.from({length:8},(_,i)=>({id:'slide-'+i,text:'Test slide '+i}))};
 f.w.studyOutputConnection={readWorkspaceGroup:async scope=>({scope,documentId:'root-p',outputs:[output],output,outputBindings:[{outputId:output.id,wordOwner:{kind:'carousel-words',projectId:'workspace-p',documentId:'document-p',outputId:output.id}}],writingProof:{wordsHash:hash}})};
 f.w.existingWork.openWorkspaceTarget=async(...args)=>f.calls.push(['workspace',...args]);return {target,output};
}
test('verified native root discovers its exact independent Carousel despite a Magazine-only overview',async()=>{
 const f=boot();try{workspaceFixture(f);const list=await f.w.workbenchPieces.listForProject('p'),piece=list.pieces.find(r=>r.title==='Saved eight slides');assert.ok(piece);assert.equal(piece.kind,'workspace-reference');assert.match(piece.edition,/8 slides/);assert.equal(piece.editionRole,'current');await f.w.workbenchPieces.openReference(piece.reference);assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c=>c[0]==='workspace'))),['workspace','workspace-p',0,{stage:9,outputId:'native-carousel'}]);assert.equal(f.calls.some(c=>c[0]==='action'),false);}finally{f.close();}
});
test('workspace index/revision changes refuse a stale piece without opening another owner',async()=>{
 for(const change of ['revision','index','word-owner']){const f=boot();try{const {target,output}=workspaceFixture(f),list=await f.w.workbenchPieces.listForProject('p'),piece=list.pieces.find(r=>r.kind==='workspace-reference');if(change==='revision')output.outputRevision++;if(change==='index')f.catalog.workspaceLinks.pieces[0].targets=[{...target,parentStudyId:'other'},target];if(change==='word-owner')f.catalog.workspacePieces[0].documentId='foreign-document';await assert.rejects(f.w.workbenchPieces.openReference(piece.reference),/changed/);assert.equal(f.calls.some(c=>c[0]==='workspace'),false);}finally{f.close();}}
});
test('same Magazine owner has one current entrance while the native and browser copies remain separate editions',async()=>{
 const f=boot();try{workspaceFixture(f);const a=f.catalog.stories[0].artifacts.find(a=>a.kind==='DEV');a.magazineWorkingTarget={kind:'magazine',nativeProjectId:'p',storyId:'owner',pieceId:'owner:article',partKey:'article',edition:'working',artifactId:a.artifactId,hash,editable:true};f.output={id:'magazine-working:owner:owner:article',title:'Current Article',format:'Article',kind:'magazine-working',edition:'Working article',actions:[{kind:'native'}]};f.w.nativeDraftCatalog.read=async()=>({drafts:[{bindingId:'root-p',parentStudyId:'p',bindingStatus:'ready',originalHash:hash,partKey:'article',title:'Native saved copy'}]});const list=await f.w.workbenchPieces.listForProject('p');assert.equal(list.pieces.filter(p=>p.kind==='magazine-working').length,1);assert.equal(list.pieces.filter(p=>p.kind==='output'&&p.title==='Current Article').length,0);assert.equal(list.pieces.find(p=>p.kind==='magazine-working').title,a.title);assert.equal(list.pieces.find(p=>p.title==='Native saved copy').editionRole,'alternate');assert.equal(list.pieces.find(p=>p.kind==='workspace-reference').editionRole,'current');}finally{f.close();}
});
test('genuine new browser subjects stay in the directory before material is added',async()=>{
 const f=boot();try{f.w.state.projects.push({id:'new-browser',name:'New human idea',folder:'Ideas'});await f.w.combinedSubjects.open();assert.match(f.d.querySelector('.combined-subjects').textContent,/New human idea/);assert.doesNotMatch(f.d.querySelector('.combined-subjects').textContent,/Hidden fixture/);}finally{f.close();}
});

test('board defaults to current pieces and retains earlier exact references in ordinary navigation',async()=>{
 const f=boot();try{
  const opened=[];f.w.workbenchPieces.listForProject=async()=>({pieces:[{reference:'current-exact',title:'Current Article',format:'Article',status:'Draft',editionRole:'current'},...Array.from({length:4},(_,i)=>({reference:'earlier-exact-'+i,title:'Earlier copy '+i,format:'Article',status:'Saved',editionRole:i?'earlier':'alternate'}))]});f.w.workbenchPieces.openReference=async ref=>opened.push(ref);
  await f.w.combinedSubjects.open({projectId:'p'});assert.equal(f.d.querySelectorAll('.cs-piece').length,1);assert.match(f.d.querySelector('.cs-pieces').textContent,/Current Article/);assert.doesNotMatch(f.d.querySelector('.cs-pieces').textContent,/Earlier copy/);f.d.querySelector('[data-cs-editions="earlier"]').click();assert.equal(f.d.querySelectorAll('.cs-piece').length,4);assert.equal(f.d.querySelectorAll('.cs-pieces details').length,0);f.d.querySelector('[data-cs-piece="earlier-exact-2"]').click();await tick();assert.deepEqual(opened,['earlier-exact-2']);
 }finally{f.close();}
});
test('Origins and Understanding lead with record kinds and show only supplied dates and durations',async()=>{
 const f=boot();try{const story=f.catalog.stories[0];story.artifacts=[{artifactId:'raw',kind:'RAW',hash,title:story.name,recordedAt:'2026-10-29T10:00:00Z',durationSeconds:125},{artifactId:'research',kind:'RESEARCH',hash,title:story.name}];await f.w.combinedSubjects.open({projectId:'p'});const records=f.d.querySelectorAll('.cs-record');assert.match(records[0].textContent,/Raw source/);assert.match(records[0].textContent,/29 Oct 2026/);assert.match(records[0].textContent,/2m 5s/);assert.match(records[1].textContent,/Research/);assert.doesNotMatch(records[1].textContent,/Unknown|2026|0m/);assert.equal(records[1].querySelector('.cs-title').textContent,'Research');}finally{f.close();}
});
test('Subjects shows an exact saved writing excerpt and only an evidenced matching last editor',async()=>{
 const f=boot();try{const owner={kind:'magazine',storyId:'owner',pieceId:'piece',partKey:'article',path:'Workflow/DEV.md'},a=f.catalog.stories[0].artifacts.find(a=>a.kind==='DEV');a.magazineWorkingTarget={...owner};f.w.workspaceNavigation.lastLocation=id=>({projectId:id,excerpt:'Actual last saved words.',item:{proof:{owner,draftHash:hash},anchor:{index:2}}});f.w.arLive={state:()=>({committedLines:[{status:'committed',kind:'study-draft.save',scope:{kind:'draft',id:'foreign'},actor:'agent:codex',ts:'2026-10-29T10:00:00Z'}]})};await f.w.combinedSubjects.open();assert.match(f.d.querySelector('.cs-subject-row').textContent,/Actual last saved words/);assert.match(f.d.querySelector('.cs-subject-row').textContent,/Last editor not recorded/);assert.doesNotMatch(f.d.querySelector('.cs-subject-row').textContent,/Codex/);f.w.arLive.state=()=>({committedLines:[{status:'committed',kind:'magazine.working-draft.save',scope:{kind:'draft',id:'piece'},actor:'human:adrian',ts:'2026-10-29T10:00:00Z'}]});await f.w.combinedSubjects.open();assert.equal(f.d.querySelector('[data-cs-last-actor]').dataset.csLastActor,'human:adrian');assert.match(f.d.querySelector('.cs-subject-row').textContent,/Last editor · Adrian/);}finally{f.close();}
});


test('first inherited Home mount cannot conceal the same Subjects owner or lose its search selection',async()=>{
 const f=boot();try{
  await f.w.combinedSubjects.open();const dialog=f.d.querySelector('dialog'),root=f.d.querySelector('.combined-subjects'),input=root.querySelector('[data-cs-search]');
  input.value='Invented';input.focus();input.setSelectionRange(1,6,'backward');const original=f.d.getElementById('original');
  // Reproduce home-tabs decorateHome's first-mount wrapping after Subjects opens.
  const body=f.d.createElement('div');body.className='ht-home-body';body.hidden=true;const main=f.d.createElement('section');main.className='ht-home-main';for(const child of [...dialog.children])main.append(child);body.append(main);dialog.append(body);dialog.classList.add('wbf-home','c3-home');dialog.dataset.wbfHome='bench';
  assert.equal(root.closest('.ht-home-body'),body);f.w.combinedSubjects.decorate();
  assert.equal(root.parentElement,dialog);assert.equal(f.d.querySelector('.combined-subjects'),root);assert.equal(root.closest('[hidden]'),null);assert.equal(root.querySelector('[data-cs-search]'),input);assert.equal(input.value,'Invented');assert.equal(input.selectionStart,1);assert.equal(input.selectionEnd,6);assert.equal(input.selectionDirection,'backward');assert.equal(original.value,'Unsent human words');assert.equal(original.parentElement,main);
  f.w.combinedSubjects.decorate();assert.equal(root.parentElement,dialog);assert.equal(f.calls.some(c=>['action','switch','story','draft'].includes(c[0])),false);
 }finally{f.close();}
});
test('Subjects owner repair mounts after inherited Home and does not revive a closed view',async()=>{
 const f=boot();try{await f.w.combinedSubjects.open();await f.w.projectLibrary.close();f.w.combinedSubjects.decorate();assert.equal(f.d.querySelector('.combined-subjects'),null);assert.equal(f.d.querySelector('dialog').dataset.combinedSubjects,undefined);const source=code.match(/register\('Combined Subjects owner',decorate,\{order:(\d+)/);assert.ok(source);assert.ok(Number(source[1])>25);assert.ok(Number(source[1])>95);}finally{f.close();}
});
