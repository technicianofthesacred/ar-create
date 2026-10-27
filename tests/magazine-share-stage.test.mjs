import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),code=fs.readFileSync(new URL('../public/document-study/share-stage.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15)),H='a'.repeat(64),F='b'.repeat(64);
function fixture({references=[{path:'Workflow/6-Feedback/FEEDBACK - Invented.md',currentHash:F,readable:true,state:'current'}],gate=null,legacy=null}={}){
 const dom=new JSDOM('<div id="app"><section class="oss-surface" data-output-stage-surface="11"></section></div>',{runScripts:'outside-only',url:'http://localhost'}),w=dom.window,calls=[];
 let state={id:'project',view:'record',viewedStage:11};const output={id:'working',kind:'magazine-working',title:'Invented article',format:'Working article',workingHash:H};
 w.current=()=>state;w.studyDraft={currentOwner:()=>({kind:'magazine'})};w.realOutputOverview={read:async()=>({outputs:[output]})};w.studyReadableMarkdown={render:md=>'<p>'+md.replaceAll('<','&lt;')+'</p>'};w.viewPhase=stage=>calls.push({stage});
 w.fetch=()=>{throw Error('Magazine must never use native Study Share APIs.');};
 w.studyOutputConnection={selectOutput:()=>{throw Error('Magazine must not select a native UUID output.');},readMagazineShareContext:async q=>{calls.push({context:q});return {draft:{hash:H},references:{feedback:references,context:[],research:[]}};},readMagazineShareFeedback:async q=>{calls.push({feedback:q});if(gate)await gate;return {feedback:{hash:q.expectedFeedbackHash,changedSinceRegistration:false},document:{text:'---\ntype: FEEDBACK\n---\n\n## Invented invitation\n\nHello <script>bad</script>.'},mapping:{structured:false,reason:'No explicit mapping.'},readOnly:true};}};
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
