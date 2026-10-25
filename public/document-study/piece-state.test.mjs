import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./piece-state.js',import.meta.url),'utf8');
function fixture({stage=5,view,blocks=[{tag:'p',html:'Words'}],status='Draft',binding=null,dirty=false,outputs=[],check=null,work=''}={}){
 const dom=new JSDOM(`<div id="app"><div class="shell"><main class="workspace" id="workspace"><nav class="workbar"><span class="saved">Saved 07:05</span></nav>${work}</main></div></div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.state={project:'p1',projects:[{id:'p1',name:'Piece',status,view:view||(stage===5?'article':'record'),viewedStage:stage,blocks,rev:2}]};
 w.current=()=>w.state.projects[0];w.phases=[];w.viewPhase=n=>{w.phases.push(n);};
 if(binding)w.studyDraft={currentBinding:()=>binding,currentProof:()=>({bindingId:binding.id,dirty,sequence:7}),flush:async()=>{w.flushed=true;return {dirty:false};}};
 w.workspaceNavigation={outputs:()=>outputs};
 if(check)w.studyDraftCheck={state:()=>check};
 w.eval(code);
 return {w,d:w.document,ps:w.c3PieceState};
}

test('one read answers every surface: words, binding, outputs, published and save state from their owners',()=>{
 const {ps}=fixture({binding:{id:'b1',title:'Clay'},outputs:[{id:'o1',format:'Article',status:'review-needed',nextAction:{kind:'review'}}],status:'Published · feedback not yet sent'});
 const st=ps.read();
 assert.equal(st.manuscript.bound,true);assert.equal(st.manuscript.revision,7);assert.equal(st.save.word,'Saved');
 assert.equal(st.outputs.length,1);assert.equal(st.waiting.length,1);
 assert.equal(st.published.label,'Published outside AR Create');
 assert.equal(st.textOnly,false,'a saved article still has a composition and audience edition');
});

test('a published piece with no saved draft says why Check cannot run instead of "nothing yet"',()=>{
 const {ps}=fixture({stage:7,status:'Published',blocks:[]});
 const p=ps.primary(7);
 assert.equal(p.label,'Save a draft first');assert.equal(p.disabled,true);
 assert.match(p.reason,/published outside AR Create/);
});

test('Write: empty asks to start, dirty asks to save, otherwise one Ask about words',()=>{
 assert.equal(fixture({blocks:[]}).ps.primary(5).label,'Start writing');
 const dirty=fixture({binding:{id:'b1'},dirty:true});assert.equal(dirty.ps.primary(5).label,'Save');
 const ask=fixture({binding:{id:'b1'},work:'<button onclick="openInstruction()">Discuss wording</button>'});assert.equal(ask.ps.primary(5).label,'Ask about words');
});

test('Check runs on the saved revision and turns into Resolve N findings, then Next: Media',()=>{
 const run=fixture({stage:7,binding:{id:'b1'},work:'<button data-current-check="run">Check saved draft</button>'});assert.equal(run.ps.primary(7).label,'Run checks');
 const found=fixture({stage:7,binding:{id:'b1'},check:{current:true,complete:true,findings:2}});assert.equal(found.ps.primary(7).label,'Resolve 2 findings');
 const clean=fixture({stage:7,binding:{id:'b1'},check:{current:true,complete:true,findings:0}});assert.deepEqual({...clean.ps.primary(7)},{label:'Next: Media',phase:8});
 const unsaved=fixture({stage:7,binding:{id:'b1'},dirty:true});assert.equal(unsaved.ps.primary(7).disabled,true);
});

test('Arrange and Share are not applicable to a words-only piece; the reason is one line and the step stays reachable',()=>{
 const {ps}=fixture({stage:9,binding:{id:'b1'}});
 assert.match(ps.notApplicable(9),/words only/);assert.equal(ps.word(9).word,'n/a');
 assert.equal(ps.primary(9).label,'Next: Audience');
 assert.match(ps.notApplicable(11),/no one recorded/);
 const visual=fixture({stage:9,binding:{id:'b1'},outputs:[{id:'c',format:'Carousel',status:'draft'}]});
 assert.equal(visual.ps.notApplicable(9),'');assert.equal(visual.ps.notApplicable(11),'');
 const unknown=fixture({stage:9});unknown.w.workspaceNavigation={outputs:()=>null};
 assert.equal(unknown.ps.notApplicable(9),'','unknown outputs never count as words-only');
});

test('state words: needs you lands on the step of the output’s next action; Outputs shows its count',()=>{
 const {ps}=fixture({binding:{id:'b1'},outputs:[{id:'o1',format:'Article',status:'correction-needed',nextAction:{kind:'native'}},{id:'o2',format:'Carousel',status:'draft'}]});
 assert.equal(ps.word(5).word,'needs you');assert.equal(ps.word(12).word,'2');
 const none=fixture({blocks:[]});assert.equal(none.ps.word(5).word,'empty');assert.equal(none.ps.word(12).word,'none');
});

test('run presses the owner’s control, opens a step, or asks the save owner; never a disabled action',async()=>{
 const {w,ps,d}=fixture({stage:1,work:'<button data-flow-action="files" onclick="window.pressed=1">Add files</button>'});
 const p=ps.primary(1);assert.equal(p.label,'Add files');await ps.run(p);assert.equal(w.pressed,1);
 await ps.run({label:'Next: Source',phase:2});assert.deepEqual([...w.phases],[2]);
 await ps.run({label:'x',disabled:true,phase:3});assert.deepEqual([...w.phases],[2]);
 const s=fixture({binding:{id:'b1'},dirty:true});await s.ps.run(s.ps.primary(5));assert.equal(s.w.flushed,true);
 void d;
});

test('retained context in a published project remains a read-only record, preserving its words and identity',()=>{
 const f=fixture({stage:5,view:'record',status:'Published',work:'<section class="phaseReader"><article class="recordPage compactRecord"><div class="recordBody"><h1>Context</h1><p>Author context retained exactly.</p></div></article></section>'});
 const before=JSON.stringify(f.w.current()),body=f.d.querySelector('.recordBody'),words=body.textContent;
 assert.equal(f.ps.readOnlyReason(5),'Retained record · read-only');
 assert.equal(f.d.querySelector('.recordBody'),body);assert.equal(body.textContent,words);assert.equal(JSON.stringify(f.w.current()),before);
});
test('read-only reason follows the actual view and never infers a published copy from project status',()=>{
 const owned=fixture({stage:5,status:'Published',binding:{id:'bound-draft'}});assert.equal(owned.ps.readOnlyReason(5),'');
 const reading=fixture({stage:6,view:'article',status:'Published',binding:{id:'bound-draft'}});assert.equal(reading.ps.readOnlyReason(6),'Reading view · open the draft to edit');
 for(const stage of [5,6,7]){const retained=fixture({stage,view:'record',status:'Published',binding:{id:'bound-draft'}});assert.equal(retained.ps.readOnlyReason(stage),'Retained record · read-only');}
});

test('C1: each step’s first answer when it is empty, from the one table',()=>{
 const want={1:'Add files',2:'Add a recording',3:'Research these sources',4:'Write my own angle',5:'Start writing',6:'Write first',7:'Save a draft first',8:'Add media',10:'Make an output',12:'New output'};
 const work={1:'<section class="material-surface sws-material"><span class="mrb-count">0</span><button data-flow-action="files">Add files</button></section>',2:'<section class="material-surface sws-source"></section>',3:'<section id="stage-working-lane"><button data-flow-action="analyze" disabled title="Add a source in Material first.">Research these sources</button></section>',4:'<section id="stage-working-lane"><div class="flow-directions"></div><button data-dwt-action="angle">Write my own angle</button></section>',8:'<section id="owned-photo-stage">No photos added yet</section><section class="study-photos"><button data-add>Upload photos</button></section>'};
 for(const [n,label] of Object.entries(want)){const {ps}=fixture({stage:Number(n),blocks:[],work:work[n]||''});assert.equal(ps.primary(Number(n))?.label,label,'step '+n);}
});
test('C1: New output opens the bar’s More where the kinds of output live',async()=>{
 const {w,ps}=fixture({stage:12});let opened=null;w.surfaceBar={openMore:s=>{opened=s;}};
 await ps.run(ps.primary(12));assert.equal(opened,'New output');
});

test('saved Article composition remains applicable even without photographs',()=>{const {ps,w}=fixture({stage:9,binding:{id:'b1'},outputs:[{id:'a',format:'Article'}]});assert.equal(ps.notApplicable(9),'');assert.equal(ps.read().textOnly,false);w.close();});
test('shared output state keeps delayed reads unknown and failures distinct from empty',async()=>{for(const failure of [false,true]){const {ps,w}=fixture({stage:12,outputs:null});let settle;const pending=new Promise(resolve=>settle=resolve);w.realOutputOverview={read:async()=>{await pending;if(failure)throw Error('Saved reader offline.');return {projectId:'p1',outputs:[{id:'saved',format:'Article'}]};}};const loading=ps.load();assert.equal(ps.read().loading,true);assert.equal(ps.read().textOnly,null);assert.equal(ps.primary(12).label,'Reading saved outputs…');settle();await loading;assert.equal(ps.read().loading,false);if(failure){assert.equal(ps.read().outputs,null);assert.equal(ps.primary(12).label,'Outputs unavailable');assert.match(ps.primary(12).reason,/offline/);}else{assert.equal(ps.read().outputs[0].id,'saved');assert.equal(ps.notApplicable(9),'');}w.close();}});
test('unavailable output reader never establishes text-only empty outputs',async()=>{const {ps,w}=fixture({stage:9,outputs:null});w.realOutputOverview={read:async()=>({projectId:'p1',outputs:[],availability:{state:'unsupported',message:'Not connected here.'}})};await ps.load();assert.equal(ps.read().outputs,null);assert.equal(ps.read().textOnly,null);assert.equal(ps.notApplicable(9),'');assert.match(ps.read().outputError,/Not connected/);w.close();});

function magazineFixture(){
 const f=fixture({stage:12,outputs:[]}),owner={kind:'magazine',storyId:'story',pieceId:'part',path:'Workflow/3-Develop/DEV - Synthetic.md'},proof={parentStudyId:'p1',owner:{...owner},draftHash:'a'.repeat(64),expected:{workflow:{draft:'a'.repeat(64)}},dirty:false,sequence:9};
 f.w.studyDraft={currentOwner:()=>owner,currentProof:()=>proof,currentBinding:()=>null};
 const projection=()=>({projectId:'p1',existingDraft:{kind:'magazine-working',owner:{...owner},hash:proof.draftHash},outputs:[{id:'magazine-working:'+owner.storyId+':'+owner.pieceId,kind:'magazine-working',format:'Working article',workingOwner:{...owner},workingHash:proof.draftHash},{id:'reference',kind:'publication-reference',format:'Publication reference'}]});
 let reads=0;f.w.realOutputOverview={read:async()=>{reads++;return projection();}};return {...f,owner,proof,projection,reads:()=>reads};
}
test('maintained Magazine proof marks the exact saved manuscript bound and dirty changes remain unsaved',()=>{
 const f=magazineFixture();assert.equal(f.ps.read().manuscript.bound,true);assert.equal(f.ps.read().manuscript.local,false);assert.equal(f.ps.word(5).word,'saved');assert.equal(f.ps.read().save.word,'Saved');f.proof.dirty=true;assert.equal(f.ps.read().manuscript.bound,true);assert.equal(f.ps.word(5).word,'unsaved');assert.equal(f.ps.read().save.word,'Unsaved');f.w.close();
 for(const change of [f=>f.proof.parentStudyId='other',f=>f.proof.owner.pieceId='other',f=>f.proof.owner.storyId='other',f=>f.proof.owner.path='Workflow/3-Develop/DEV - Other.md',f=>f.proof.expected.workflow.draft='b'.repeat(64),f=>f.proof.draftHash='invalid']){const g=magazineFixture();change(g);assert.equal(g.ps.read().manuscript.bound,false);assert.equal(g.ps.read().outputs,null);g.w.close();}
});
test('Magazine ignores native navigation empty outputs and counts only validated working projection',async()=>{
 const f=magazineFixture();assert.equal(f.ps.read().outputs,null);assert.equal(f.ps.read().textOnly,null);assert.notEqual(f.ps.word(12).word,'none');await f.ps.load();assert.equal(f.ps.read().outputs.length,1);assert.equal(f.ps.read().outputs[0].kind,'magazine-working');assert.equal(f.ps.word(12).word,'1');assert.equal(f.ps.read().textOnly,false);await f.ps.load();assert.equal(f.reads(),1,'same scoped projection retains TTL');f.w.close();
});
test('Magazine part, source path, project and hash switches cannot reuse cached projection or error',async()=>{
 for(const change of [f=>{f.owner.pieceId='part-two';f.proof.owner={...f.owner};},f=>{f.owner.path='Workflow/3-Develop/DEV - Other.md';f.proof.owner={...f.owner};},f=>{f.owner.storyId='other-source';f.proof.owner={...f.owner};},f=>{f.proof.draftHash='b'.repeat(64);f.proof.expected.workflow.draft=f.proof.draftHash;},f=>{f.w.current().id='other-project';f.proof.parentStudyId='other-project';}]){const f=magazineFixture();await f.ps.load();assert.equal(f.ps.read().outputs.length,1);change(f);assert.equal(f.ps.read().outputs,null);assert.equal(f.ps.read().outputError,'');f.w.close();}
 const f=magazineFixture();f.w.realOutputOverview.read=async()=>{throw Error('Old part unavailable');};await f.ps.load();assert.match(f.ps.read().outputError,/Old part/);f.owner.pieceId='other';f.proof.owner={...f.owner};assert.equal(f.ps.read().outputError,'');assert.equal(f.ps.read().outputs,null);f.w.close();
});
test('Magazine rejects wrong scoped projections and late earlier-owner responses, retaining one inflight read',async()=>{
 const f=magazineFixture(),old=f.projection();let release,calls=0;f.w.realOutputOverview.read=async()=>{calls++;await new Promise(resolve=>release=resolve);return old;};const pending=f.ps.load();assert.equal(f.ps.load(),pending);f.owner.pieceId='other';f.proof.owner={...f.owner};release();await pending;assert.equal(f.ps.read().outputs,null);assert.equal(f.ps.read().outputError,'');assert.equal(calls,1);f.w.realOutputOverview.read=async()=>old;await f.ps.load();assert.equal(f.ps.read().outputs,null);assert.match(f.ps.read().outputError,/different working part/);f.w.close();
});
test('Magazine dirty state cannot reuse the saved output projection; native output and binding behavior stays intact',async()=>{
 const f=magazineFixture();await f.ps.load();f.proof.dirty=true;assert.equal(f.ps.read().outputs,null);assert.equal(f.ps.read().textOnly,null);f.w.close();const native=fixture({binding:{id:'native-binding'},outputs:[{id:'native',format:'Article'}]});assert.equal(native.ps.read().manuscript.bound,true);assert.equal(native.ps.read().outputs[0].id,'native');native.w.close();
});

test('Magazine cannot inherit a leftover native binding or selected native output',async()=>{const f=magazineFixture();f.w.studyDraft.currentBinding=()=>({id:'old-native',title:'Other document'});f.proof.owner.pieceId='foreign';assert.equal(f.ps.read().manuscript.bound,false);assert.notEqual(f.ps.read().manuscript.title,'Other document');f.proof.owner={...f.owner};await f.ps.load();f.w.workspaceNavigation.selectedOutput=()=>({id:'old-native',title:'Other output'});const action=f.ps.primary(12);assert.equal(action.output,'magazine-working:story:part');assert.equal(action.expectedHash,f.proof.draftHash);assert.equal(action.edition,'working');f.w.close();});

test('Magazine Save dispatches only to its maintained draft owner, leaving native output saving separate',async()=>{const f=magazineFixture();f.proof.dirty=true;let magazine=0,native=0;f.w.studyDraft.flush=async()=>{magazine++;return{dirty:false};};f.w.studyOutputConnection={flush:async()=>native++};await f.ps.run(f.ps.primary(5));assert.equal(magazine,1);assert.equal(native,0);f.w.close();});
