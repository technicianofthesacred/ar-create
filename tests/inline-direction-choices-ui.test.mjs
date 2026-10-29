import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createInlineDirectionChoices} from '../public/document-study/inline-direction-choices.js';
import {readDirectionChoices,applyDirectionChoice} from '../public/lib/direction-choice.js';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const options={angles:[{id:'angle:1',text:'Synthetic garden',description:'The full explanation.\n\nAnother paragraph.'},{id:'angle:2',text:'Synthetic attention',description:'Another invented approach.'}],titles:[{id:'title:1',text:'Synthetic title'}],source:{artifactId:'synthetic-map',hash:'a'.repeat(64)}};
async function fixture(t,{canMutate=true,dirty=false}={}){
 const dom=new JSDOM('<div id="choices"></div>',{url:'http://localhost'});t.after(()=>dom.window.close());const w=dom.window;
 let record={bound:true,body:'Author exact words.\n保留原文。',revision:4,hash:'b'.repeat(64)},fresh=structuredClone(options),hold=null;
 const calls=[],events=[];w.studyHumanDirection={isDirty:()=>dirty};w.addEventListener('study-direction-choice-change',event=>events.push(event.detail));
 const api=createInlineDirectionChoices({window:w,fetch:async(url,init)=>{if(init){const body=JSON.parse(init.body);calls.push(body);if(hold)await hold;assert.equal(body.expectedRevision,record.revision);assert.equal(body.expectedHash,record.hash);record={...record,body:body.body,revision:record.revision+1,hash:'c'.repeat(64)};}return {ok:true,json:async()=>record};}});
 await api.mount({container:w.document.getElementById('choices'),parentStudyId:'synthetic-project',loadOptions:async({fresh:again})=>again?fresh:options,canMutate,isCurrent:()=>true});
 return {w,api,calls,events,get record(){return record;},setFresh(next){fresh=next;},setHold(next){hold=next;},setRecord(next){record={...record,...next};}};
}
test('inline choices save edited human intent with exact guard and original source; title is initially unchosen',async t=>{
 const f=await fixture(t),d=f.w.document;
 assert.equal(d.querySelector('details'),null);assert.match(d.body.textContent,/Another paragraph/);assert.doesNotMatch(d.body.textContent,/Chosen by you/);
 const row=d.querySelector('[data-choice-kind="angle"]');row.querySelector('[data-choice-words]').value='My changed emphasis';row.querySelector('[data-choice-words]').dispatchEvent(new f.w.Event('input'));row.querySelector('[data-choice-action="use"]').click();await tick();
 assert.equal(f.calls.length,1);const state=readDirectionChoices(f.record.body);assert.equal(state.selectedAngle.text,'My changed emphasis');assert.deepEqual(state.selectedAngle.source,options.source);assert.equal(state.selectedTitle,null);assert.equal(state.selectedAngle.optionId,'angle:1');assert.ok(f.record.body.startsWith('Author exact words.\n保留原文。'));assert.equal(f.events[0].parentStudyId,'synthetic-project');
 const title=d.querySelector('[data-choice-kind="title"]');title.querySelector('[data-choice-action="use"]').click();await tick();assert.equal(readDirectionChoices(f.record.body).selectedTitle.text,'Synthetic title');
});
test('rejection requires visible reason and retains earlier chosen history',async t=>{
 const f=await fixture(t),d=f.w.document;d.querySelector('[data-choice-action="reject"]').click();await tick();assert.equal(f.calls.length,0);assert.match(d.body.textContent,/Add a reason/);
 d.querySelector('[data-choice-action="use"]').click();await tick();const reason=d.querySelector('[data-choice-reason]');reason.value='This leads away from my experience.';reason.dispatchEvent(new f.w.Event('input'));d.querySelector('[data-choice-action="reject"]').click();await tick();const state=readDirectionChoices(f.record.body);assert.equal(state.selectedAngle,null);assert.equal(state.rejections[0].reason,'This leads away from my experience.');assert.equal(state.events.length,2);assert.match(d.body.textContent,/Earlier choices and reasons/);
});
test('changed source, read-only actor, dirty notes and invalid managed records never write',async t=>{
 const changed=await fixture(t);changed.setFresh({...options,source:{...options.source,hash:'d'.repeat(64)}});changed.w.document.querySelector('[data-choice-action="use"]').click();await tick();assert.equal(changed.calls.length,0);assert.match(changed.w.document.body.textContent,/changed/);
 for(const settings of [{canMutate:false},{dirty:true}]){const f=await fixture(t,settings);assert.ok(f.w.document.querySelector('[data-choice-action]').disabled);f.w.document.querySelector('[data-choice-action]').click();await tick();assert.equal(f.calls.length,0);}
 const malformed=await fixture(t);malformed.setRecord({body:'Author words\n<!-- ar-create:direction-choices:v1 -->'});await malformed.api.refresh();assert.ok(malformed.w.document.querySelector('[data-choice-action]').disabled);assert.match(malformed.w.document.body.textContent,/need review/);
});
test('fresh saved owner is appended without overwriting concurrent saved notes; project switch blocks in-flight choice',async t=>{
 const f=await fixture(t);f.setRecord({body:'Newly saved exact notes.',revision:8,hash:'f'.repeat(64)});f.w.document.querySelector('[data-choice-action="use"]').click();await tick();assert.ok(f.record.body.startsWith('Newly saved exact notes.'));assert.equal(f.calls[0].expectedRevision,8);
 const g=await fixture(t);let release;g.setFresh(new Promise(resolve=>release=resolve));g.w.document.querySelector('[data-choice-action="use"]').click();g.api.unmount();release(options);await tick();assert.equal(g.calls.length,0);
});

test('the existing prose editor preserves managed choices and exposes Direction actions without a disclosure',async t=>{
 const fs=await import('node:fs');
 const codec=await import('../public/lib/direction-choice.js');
 const dom=new JSDOM('<div id="app"><div class="material-surface"></div></div>',{url:'http://localhost',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 const event={operationId:w.crypto.randomUUID(),kind:'angle',action:'use',optionId:'angle:1',text:'Synthetic chosen angle',reason:'',source:options.source};
 let record={bound:true,body:applyDirectionChoice('Author original words.',event),hash:'a'.repeat(64),revision:1},saved;
 w.directionChoiceCodec=codec;w.current=()=>({id:'synthetic-project',view:'record',viewedStage:4});w.state={projects:[{id:'synthetic-project',name:'Synthetic project'}]};w.render=()=>{};
 w.fetch=async(url,init)=>{if(url.includes('catalog'))return {ok:true,json:async()=>({drafts:[]})};if(init){saved=JSON.parse(init.body);record={...record,body:saved.body,revision:2};}return {ok:true,json:async()=>record};};
 w.eval(fs.readFileSync(new URL('../public/document-study/human-direction.js',import.meta.url),'utf8'));await tick();
 const input=w.document.querySelector('[data-human-direction]');assert.equal(input.value,'Author original words.');assert.equal(w.document.querySelector('[data-direction-editor]').tagName,'SECTION');assert.ok(w.document.querySelector('[data-direction-save]'));input.value='Changed author words.';input.dispatchEvent(new w.Event('input'));w.document.querySelector('[data-direction-save]').click();await tick();assert.equal(codec.stripDirectionChoices(saved.body),'Changed author words.');assert.deepEqual(codec.readDirectionChoices(saved.body).events,[event]);
});
