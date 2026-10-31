import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(new URL('../public/document-study/draft-flow.js',import.meta.url),'utf8');
const rendering=source.slice(source.indexOf(' let approvalObserver=null;'),source.indexOf(' function wireControls()'));

function setup(t,{margin='',priority=''}={}){
 const dom=new JSDOM('<style>#manuscript p{margin-bottom:20px!important}</style><div><div id="manuscript"><p data-block="first">Original words.</p><p data-block="next">Next words.</p></div></div>',{runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window,paragraph=w.document.querySelector('[data-block="first"]'),editor=w.document.getElementById('manuscript');
 if(margin)paragraph.style.setProperty('margin-bottom',margin,priority);
 const doc={expected:{revision:'one'},approvalReview:{blocks:[{id:'first',spans:[{preview:'Pending words'}]}]}};
 w.clone=structuredClone;w.current=()=>({});w.isDraft=()=>true;w.activeDoc=()=>doc;w.approvalClean=()=>true;
 let observer;
 w.ResizeObserver=class{constructor(callback){this.callback=callback;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
 Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{get(){return this.className==='draft-mark-approvals'?48:0;}});
 paragraph.getBoundingClientRect=()=>({bottom:100});
 w.eval(rendering+';window.renderApprovals=renderApprovals;');
 return {w,doc,paragraph,editor,resize:()=>observer.callback(),observer:()=>observer};
}

test('approval space outranks stylesheet important margins and stays stable through resize and rerender',t=>{
 const {w,doc,paragraph,editor,resize,observer}=setup(t);
 w.renderApprovals();
 const group=w.document.querySelector('.draft-mark-approvals'),button=group.querySelector('button');
 assert.equal(paragraph.style.getPropertyValue('margin-bottom'),'64px');
 assert.equal(paragraph.style.getPropertyPriority('margin-bottom'),'important','inline reservation must beat shared important paragraph spacing');
 assert.equal(button.textContent,'Keep wording');assert.equal(button.disabled,false);
 assert.equal(editor.children.length,2);assert.equal(editor.firstElementChild,paragraph);assert.equal(paragraph.textContent,'Original words.');
 for(let i=0;i<3;i++)resize();
 assert.equal(paragraph.style.marginBottom,'64px');
 const prior=observer();w.renderApprovals();assert.equal(prior.disconnected,true);
 assert.equal(paragraph.style.marginBottom,'64px');assert.equal(w.document.querySelectorAll('.draft-approval-rail').length,1);
 doc.approvalReview.blocks=[];w.renderApprovals();
 assert.equal(paragraph.style.getPropertyValue('margin-bottom'),'');assert.equal(paragraph.style.getPropertyPriority('margin-bottom'),'');
 assert.equal(w.document.querySelector('.draft-approval-rail'),null);assert.equal(paragraph.hasAttribute('data-approval-margin'),false);
});

test('a retained mark explains its origin and missing comparison instead of pretending to be a replacement',t=>{
 const {w,doc,paragraph}=setup(t);w.renderApprovals();
 const row=w.document.querySelector('.draft-mark-approval'),context=row.querySelector('section.draft-mark-context');
 assert.ok(context,'review context is shown in place');assert.equal(row.querySelector('details'),null);
 assert.match(context.textContent,/Marked in the saved draft/);
 assert.match(context.textContent,/Earlier wording and suggestion author were not recorded with this mark/);
 assert.match(context.textContent,/removes the review highlight/);
 assert.equal(row.querySelector('.draft-mark-preview').textContent,'Pending words');
 assert.ok(context.contains(row.querySelector('.draft-mark-preview')),'exact wording stays with its visible context');
 assert.equal(paragraph.textContent,'Original words.');
 assert.equal(doc.approvalReview.blocks.length,1,'rendering never approves or invents a proposal');
 let history=0;w.studyDraft={showHistory:()=>history++};row.querySelector('[data-draft-mark-history]').click();
 assert.equal(history,1,'use the existing history owner');
});

test('marked wording history uses the visible Workbench history panel when present',t=>{
 const {w}=setup(t);const visible=w.document.createElement('button');visible.dataset.wbfTool='history';
 let opened=0;visible.onclick=()=>opened++;w.document.body.append(visible);
 w.renderApprovals();w.document.querySelector('[data-draft-mark-history]').click();assert.equal(opened,1);
});

for(const priority of ['','important'])test('cleanup restores the original inline margin and '+(priority||'normal')+' priority',t=>{
 const {w,doc,paragraph}=setup(t,{margin:'7px',priority});
 w.renderApprovals();w.renderApprovals();
 doc.approvalReview.blocks=[];w.renderApprovals();
 assert.equal(paragraph.style.getPropertyValue('margin-bottom'),'7px');
 assert.equal(paragraph.style.getPropertyPriority('margin-bottom'),priority);
 assert.equal(paragraph.hasAttribute('data-approval-margin-priority'),false);
});
