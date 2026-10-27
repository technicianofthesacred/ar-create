import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),code=fs.readFileSync(new URL('../public/document-study/share-stage.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15)),H='a'.repeat(64),F='b'.repeat(64);
function fixture({references=[{path:'Workflow/6-Feedback/FEEDBACK - Invented.md',currentHash:F,readable:true,state:'current'}],gate=null,legacy=null}={}){
 const dom=new JSDOM('<div id="app"><section class="oss-surface" data-output-stage-surface="11"></section></div>',{runScripts:'outside-only',url:'http://localhost'}),w=dom.window,calls=[];
 let state={id:'project',view:'record',viewedStage:11};const output={id:'working',kind:'magazine-working',title:'Invented article',format:'Working article',workingHash:H};
 w.current=()=>state;w.studyDraft={currentOwner:()=>({kind:'magazine'})};w.realOutputOverview={read:async()=>{throw Error('Publication/photo preview is unavailable; Share must not depend on it.');}};w.studyReadableMarkdown={render:md=>'<p>'+md.replaceAll('<','&lt;')+'</p>'};w.viewPhase=stage=>calls.push({stage});
 w.fetch=()=>{throw Error('Magazine must never use native Study Share APIs.');};
 w.studyOutputConnection={readMagazineShareEntry:async q=>({output,context:{draft:{hash:H},references:{feedback:references,context:[],research:[]}}}),selectOutput:()=>{throw Error('Magazine must not select a native UUID output.');},readMagazineShareContext:async q=>{calls.push({context:q});return {draft:{hash:H},references:{feedback:references,context:[],research:[]}};},readMagazineShareFeedback:async q=>{calls.push({feedback:q});if(gate)await gate;return {feedback:{hash:q.expectedFeedbackHash,changedSinceRegistration:false},document:{text:'---\ntype: FEEDBACK\n---\n\n## Invented invitation\n\nHello <script>bad</script>.'},mapping:{structured:false,reason:'No explicit mapping.'},readOnly:true};}};
 if(legacy)w.document.querySelector('section').innerHTML='<textarea data-oss-field="message"></textarea>';if(legacy)w.document.querySelector('textarea').value=legacy;w.eval(code);return {w,calls,change:()=>state={id:'another',view:'record',viewedStage:5},async loaded(){await tick();await tick();},close:()=>w.close()};
}
test('Magazine Share opens its registered canonical correspondence without native output coercion or copies',async t=>{
 const f=fixture();t.after(f.close);await f.loaded();const text=f.w.document.querySelector('[data-output-stage-surface]').textContent;
 assert.match(text,/Saved correspondence/);assert.match(text,/Hello/);assert.match(text,/Editing.*not connected/i);assert.doesNotMatch(text,/ar-create-share|FEEDBACK - Invented/);
 assert.equal(f.calls.filter(c=>c.feedback).length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c=>c.feedback).feedback)),{projectId:'project',outputId:'working',expectedHash:H,registeredFeedbackPath:'Workflow/6-Feedback/FEEDBACK - Invented.md',expectedFeedbackHash:F});
 assert.equal(f.w.document.querySelector('script'),null);assert.equal(f.w.document.querySelector('textarea'),null);assert.equal(f.w.sessionStorage.length,0);
});
test('Magazine Share requires explicit choice between registered feedback files',async t=>{
 const f=fixture({references:[{path:'one',currentHash:F,readable:true,state:'current'},{path:'two',currentHash:F,readable:true,state:'current'}]});t.after(f.close);await f.loaded();assert.equal(f.calls.some(c=>c.feedback),false);
 const select=f.w.document.querySelector('[data-magazine-feedback]');assert.ok(select);select.value='1';select.dispatchEvent(new f.w.Event('change'));await f.loaded();assert.equal(f.calls.find(c=>c.feedback).feedback.registeredFeedbackPath,'two');
});
test('Magazine Share keeps unavailable references explicit and ignores delayed reads after navigation',async t=>{
 const missing=fixture({references:[{path:'missing',currentHash:null,readable:false,state:'missing'}]});t.after(missing.close);await missing.loaded();assert.equal(missing.calls.some(c=>c.feedback),false);assert.match(missing.w.document.body.textContent,/unavailable/i);
 let release;const f=fixture({gate:new Promise(r=>release=r)});t.after(f.close);await f.loaded();f.change();release();await f.loaded();assert.doesNotMatch(f.w.document.body.textContent,/Hello/);
});


test('earlier tab invitation text remains separate and visible without being saved into Magazine',async t=>{
 const f=fixture({legacy:'Exact earlier <words> from this tab'});t.after(f.close);await f.loaded();
 assert.match(f.w.document.body.textContent,/Exact earlier <words> from this tab/);assert.match(f.w.document.body.textContent,/Kept separately/);assert.equal(f.w.document.querySelector('words'),null);assert.equal(f.w.sessionStorage.length,0);
});

function editorFixture({lostSave=false}={}){
 const f=fixture(),w=f.w,root='d'.repeat(64);let words='Old invitation.',fileHash=F,saveId=null,loss=lostSave,readOnly=false;const saves=[];
 w.AR_CREATE_REVIEW_MODE={magazineFeedbackCorrections:true};
 w.studyOutputConnection.readMagazineShareEntry=async()=>({output:{id:'working',kind:'magazine-working',title:'Invented article',workingHash:H},context:{references:{feedback:[{path:'Workflow/6-Feedback/FEEDBACK - Invented.md',currentHash:fileHash,readable:true,state:'current'}]}}});
 const model=()=>({rootIdentity:{fingerprint:root},draft:{hash:H},feedback:{path:'Workflow/6-Feedback/FEEDBACK - Invented.md',hash:fileHash},document:{text:words},mapping:{structured:false},editable:!readOnly,unavailableReason:readOnly?'Correspondence is read-only.':null,paragraphs:[{index:0,seen:'a'.repeat(12),raw:words,text:words,editable:true}]});
 w.studyOutputConnection.readMagazineShareFeedbackEditModel=async()=>model();
 w.studyOutputConnection.readMagazineShareFeedbackHistory=async()=>({history:saveId?[{operationId:saveId,canUndo:words!=='Old invitation.'}]:[]});
 w.studyOutputConnection.prepareMagazineShareFeedbackParagraph=async q=>{if(q.expectedFeedbackHash!==fileHash)throw Object.assign(Error('Saved correspondence changed.'),{status:409});return {content:q.text};};
 w.studyOutputConnection.saveMagazineShareFeedback=async q=>{saves.push(q);words=q.content;fileHash='c'.repeat(64);saveId=q.operationId;if(loss){loss=false;throw Error('Save response unavailable.');}return {written:true,hash:fileHash,operationId:q.operationId};};
 w.studyOutputConnection.undoMagazineShareFeedback=async q=>{assert.equal(q.undoOperationId,saveId);words='Old invitation.';fileHash=F;return {undone:saveId,operationId:q.operationId};};
 return {...f,saves,words:()=>words,readOnly(){readOnly=true;},drift(){fileHash='e'.repeat(64);words='Newer saved words.';}};
}
const enterParagraph=async f=>{await f.loaded();f.w.document.querySelector('[data-share-action="magazine-edit-mode"]').click();f.w.document.querySelector('[data-feedback-edit="0"]').click();};
const typeParagraph=(f,text)=>{const el=f.w.document.querySelector('[data-feedback-text]');el.value=text;el.dispatchEvent(new f.w.Event('input',{bubbles:true}));};
test('the human paragraph editor saves through the existing owner and discovers exact Undo after remount',async t=>{
 const f=editorFixture();t.after(f.close);await enterParagraph(f);assert.equal(f.w.document.querySelector('[data-feedback-text]').value,'Old invitation.');typeParagraph(f,'Human changed invitation.');
 f.w.document.querySelector('[data-share-action="magazine-save-paragraph"]').click();await f.loaded();assert.equal(f.words(),'Human changed invitation.');assert.equal(f.saves.length,1);assert.equal(f.w.sessionStorage.length,1);
 f.w.document.getElementById('app').innerHTML='<section data-output-stage-surface="11"></section>';await f.loaded();f.w.document.querySelector('[data-share-action="magazine-undo"]').click();await f.loaded();assert.equal(f.words(),'Old invitation.');
});
test('a lost save response retains an exact retry and never regenerates a second operation',async t=>{
 const f=editorFixture({lostSave:true});t.after(f.close);await enterParagraph(f);typeParagraph(f,'Exact retained human copy.');f.w.document.querySelector('[data-share-action="magazine-save-paragraph"]').click();await f.loaded();
 assert.ok(f.w.document.querySelector('[data-share-action="magazine-retry"]'));const id=f.saves[0].operationId;
 f.w.document.getElementById('app').innerHTML='<section data-output-stage-surface="11"></section>';await f.loaded();assert.match(f.w.document.body.textContent,/retained|recover|entered/i);f.w.document.querySelector('[data-share-action="magazine-retry"]').click();await f.loaded();assert.equal(f.saves[1].operationId,id);assert.equal(f.saves[1].content,f.saves[0].content);assert.equal(f.words(),'Exact retained human copy.');
});
test('a changed saved record refuses paragraph save while preserving entered words',async t=>{
 const f=editorFixture();t.after(f.close);await enterParagraph(f);typeParagraph(f,'Unsaved human words.');f.drift();f.w.document.querySelector('[data-share-action="magazine-save-paragraph"]').click();await f.loaded();assert.equal(f.saves.length,0);assert.equal(f.w.document.querySelector('[data-feedback-text]').value,'Unsaved human words.');assert.equal(f.words(),'Newer saved words.');
});

test('unavailable browser recovery storage blocks submission and leaves entered words visible',async t=>{
 const f=editorFixture();t.after(f.close);await enterParagraph(f);f.w.Storage.prototype.setItem=()=>{throw Error('Quota exceeded');};typeParagraph(f,'Words that must stay in the open editor.');f.w.document.querySelector('[data-share-action="magazine-save-paragraph"]').click();await f.loaded();assert.equal(f.saves.length,0);assert.equal(f.w.document.querySelector('[data-feedback-text]').value,'Words that must stay in the open editor.');assert.match(f.w.document.body.textContent,/storage|keep this tab open/i);
});


test('retained entered words stay visible when the owner becomes read-only on remount',async t=>{
 const f=editorFixture();t.after(f.close);await enterParagraph(f);typeParagraph(f,'Retain this separate unsaved paragraph.');f.readOnly();f.w.document.getElementById('app').innerHTML='<section data-output-stage-surface="11"></section>';await f.loaded();assert.equal(f.w.document.querySelector('[data-feedback-text]').value,'Retain this separate unsaved paragraph.');assert.equal(f.w.document.querySelector('[data-share-action="magazine-save-paragraph"]').disabled,true);assert.equal(f.saves.length,0);
});
