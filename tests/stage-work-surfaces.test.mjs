import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const adapter=fs.readFileSync(new URL('../public/document-study/stage-work-surfaces.js',import.meta.url),'utf8');
const material=fs.readFileSync(new URL('../public/document-study/material-surface.js',import.meta.url),'utf8');
function fixture(t,stage=1){
 const dom=new JSDOM('<div id="app"><main id="stage-working-lane"></main><section id="current-draft-check"></section></div>',{runScripts:'outside-only',url:'http://localhost'});t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 const project={id:'synthetic-a',view:'record',viewedStage:stage};w.current=()=>project;w.render=()=>{};w.viewPhase=s=>{project.viewedStage=s};w.NodeFilter=w.NodeFilter;
 w.eval(material);w.eval(adapter);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const records=[{name:'RAW · Invented visit',path:'synthetic/raw.md',raw:'Original invented words. %%editorial only%%'},{name:'SRC · Invented visit',path:'synthetic/src.md',raw:'Corrected invented words.'}];
 const c={id:project.id,local:{drafts:{},reviews:{},selected:[]},live:{flow:{materials:[]},failed:[]}};
 const h={esc,button:(key,label)=>`<button data-flow-action="${key}">${label}</button>`,field:(c,key,label)=>`<label>${label}<textarea data-draft="${key}"></textarea></label>`,originalsAt:(_,s)=>s===1?[records[0]]:s===2?[records[1]]:[],recordWords:r=>`<p>${esc(r.raw)}</p>`,material:()=>'<div data-native-material></div>',transcript:()=>'<div class="flow-transcript"><button data-flow-action="save-transcript">Save transcript</button><textarea data-segment-text="0">Native source</textarea></div>',originalAudio:()=>''};
 const paint=()=>{d.getElementById('stage-working-lane').innerHTML=w.MaterialSurface.render(c,project.viewedStage,h);w.studyStageWorkSurfaces.decorate()};
 return {w,d,project,c,h,records,paint};
}
const input=(f,key,value)=>{const n=f.d.querySelector(`[data-sws-input="${key}"]`);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new f.w.Event('input',{bubbles:true}));return n};
test('Material is collection-first and preserves every connected intake/source control',t=>{
 const f=fixture(t);f.paint();const root=f.d.querySelector('.sws-material');assert.ok(root);assert.equal(root.querySelector('h2').textContent,'Material');assert.ok(root.querySelector('[data-flow-action="files"]'));assert.ok(root.querySelector('[data-files]'));assert.ok(root.querySelector('[data-flow-action="note"]'));assert.ok(root.querySelector('[data-flow-action="links"]'));assert.ok(root.querySelector('[data-flow-action="save-transcript"]'));assert.ok(root.querySelector('[data-segment-text="0"]'));assert.equal(root.querySelector('.material-reading').parentElement.tagName,'DETAILS');assert.equal(root.querySelectorAll('[data-sws-input^="resource:"]').length,2);
 const checkbox=input(f,'resource:0',true);input(f,'group','Invented visit');f.d.querySelector('[data-sws-action="group"]').click();assert.match(f.d.querySelector('[data-sws-result]').textContent,/Prepared 1 resource/);assert.match(f.d.querySelector('[data-sws-result]').textContent,/nothing has been saved/);assert.deepEqual(f.c.local.selected,[]);assert.equal(f.records[0].raw,'Original invented words. %%editorial only%%');
 f.paint();assert.equal(f.d.querySelector('[data-sws-input="group"]').value,'Invented visit');assert.equal(f.d.querySelector('[data-sws-input="resource:0"]').checked,true);
});
test('Source is words-first, compares actual records without inferred versions and preserves native edits',t=>{
 const f=fixture(t,2);f.paint();const root=f.d.querySelector('.sws-source');assert.equal(root.querySelector('h2').textContent,'Transcripts & sources');assert.equal(root.querySelector('.material-tools').parentElement.tagName,'DETAILS');assert.equal(root.querySelector('.material-reading').parentElement.className,'material-layout');assert.ok(root.querySelector('[data-segment-text]'));assert.match(root.textContent,/No playable recording is connected/);assert.equal(root.querySelectorAll('audio').length,0);
 f.d.querySelector('[data-sws-action="versions"]').click();const comparison=f.d.querySelector('[data-sws-comparison]');assert.match(comparison.textContent,/Original invented words/);assert.match(comparison.textContent,/Corrected invented words/);assert.doesNotMatch(comparison.textContent,/editorial only/);assert.equal(comparison.querySelectorAll('article').length,2);assert.match(root.textContent,/version relationship is not inferred/);assert.match(root.textContent,/Version-history comparison is not connected/);
 input(f,'term','invented');input(f,'replacement','proposed');f.d.querySelector('[data-sws-action="correction"]').click();assert.match(f.d.querySelector('[data-sws-tool="correction"] [data-sws-result]').textContent,/no occurrences were changed/);assert.equal(f.d.querySelector('[data-segment-text]').value,'Native source');
});
test('source preparation is separated by project and does not mutate saved input',t=>{
 const f=fixture(t,2);f.paint();input(f,'term','Only A');f.project.id='synthetic-b';f.c.id='synthetic-b';f.paint();assert.equal(f.d.querySelector('[data-sws-input="term"]').value,'');f.project.id='synthetic-a';f.c.id='synthetic-a';f.paint();assert.equal(f.d.querySelector('[data-sws-input="term"]').value,'Only A');assert.equal(f.c.local.drafts.term,undefined);
});
test('Checked decoration is idempotent, retains check/jump nodes and gives honest unconnected reviews',async t=>{
 const f=fixture(t,7);let jumps=0,checks=0;const host=f.d.querySelector('#current-draft-check');host.innerHTML='<div class="draft-check-status">Outdated check</div><div class="draft-check-results"></div><div class="draft-check-proof"></div><button data-current-check="run">Recheck</button><button data-current-issue="0">Go to passage</button>';const jump=host.querySelector('[data-current-issue]');jump.onclick=()=>jumps++;host.querySelector('[data-current-check]').onclick=()=>checks++;f.w.studyDraft={currentProof:()=>({parentStudyId:'synthetic-a',sequence:7,dirty:false}),currentBinding:()=>({title:'Invented part'})};f.w.studyStageWorkSurfaces.decorate();f.w.studyStageWorkSurfaces.decorate();await new Promise(r=>setTimeout(r,0));assert.equal(host.querySelectorAll('[data-sws-check]').length,1);assert.equal(host.querySelector('[data-current-issue]'),jump);jump.click();host.querySelector('[data-current-check]').click();assert.equal(jumps,1);assert.equal(checks,1);assert.match(host.textContent,/No current findings to show/);assert.match(host.textContent,/revision 7/);assert.match(host.textContent,/no editorial check has run/i);input(f,'editorial-question','Does this preserve the opening?');host.querySelector('[data-sws-action="editorial"]').click();assert.match(host.querySelector('[data-sws-result]').textContent,/no check has run or been saved/);
 host.innerHTML='<div class="draft-check-status">Mechanical checks complete</div><div class="draft-check-results"></div><div class="draft-check-proof"></div>';await new Promise(r=>setTimeout(r,0));assert.equal(host.querySelectorAll('[data-sws-check]').length,1);assert.match(host.textContent,/No findings recorded by these named mechanical checks/);assert.equal(host.querySelector('[data-sws-input="editorial-question"]').value,'Does this preserve the opening?');
});
test('other stages and non-record views receive no new stage UI',t=>{
 const f=fixture(t,3);const html='<div data-original>Existing research</div>';f.d.querySelector('#stage-working-lane').innerHTML=html;f.w.studyStageWorkSurfaces.decorate();assert.equal(f.d.querySelector('#stage-working-lane').innerHTML,'<div data-original="">Existing research</div>');f.project.viewedStage=7;f.project.view='draft';f.w.studyStageWorkSurfaces.decorate();assert.equal(f.d.querySelector('[data-sws-check]'),null);
});
test('Material review-source action navigates to Source after the original control runs',async t=>{
 const f=fixture(t);f.paint();let original=0;const b=f.d.querySelector('[data-sws-open-source]');b.onclick=()=>original++;b.click();await new Promise(r=>setTimeout(r,0));assert.equal(original,1);assert.equal(f.project.viewedStage,2);
});
