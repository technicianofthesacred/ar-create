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
 assert.equal(st.textOnly,true,'an article with no photographs is words only');
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

test('Read-only always says why',()=>{
 const {ps}=fixture({stage:6,status:'Published'});
 assert.match(ps.readOnlyReason(6),/Published copy · open the draft to edit/);
 assert.equal(fixture({stage:5}).ps.readOnlyReason(5),'');
});
