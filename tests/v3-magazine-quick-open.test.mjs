import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');
const source=fs.readFileSync(new URL('../public/v3/screens/write.js',import.meta.url),'utf8');
const id='mag-invented-maker',piece=id+':article';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
const read=()=>({selection:{storyId:id,pieceId:piece,edition:'working'},authority:{kind:'magazine',storyId:id,pieceId:piece,partKey:'article',path:'Workflow/3-Develop/DEV - Invented.md',title:'Invented article'},document:{text:'Invented saved words.',hash:'a'.repeat(64)},projection:[{id:'p',words:'Invented saved words.',safe:true,blockHash:'b'.repeat(64)}],paragraphs:[]});
const form={key:'mag:'+piece,id:piece,kind:'article',name:'Article',title:'Invented article',owner:{kind:'magazine',storyId:id,pieceId:piece}};
const standing=()=>({title:'Full invented subject',forms:[form,{key:'other',id:'other',kind:'carousel',name:'Carousel'}],facts:{}});
const questions={editable:true,questions:[{index:0,title:'When was the invented visit?',text:true,options:[],context:[],other:false,answered:false},{index:1,title:'Which invented title?',text:true,options:[],context:[],other:false,answered:true,value:'A saved invented answer'}]};
function page(t,{subject=id,selected=piece,answer=read(),standingResult}={}){
 const dom=new JSDOM('<div id="mount"></div>',{url:'http://invented.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[],wait=deferred();let screen;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.V2Client={uuid:()=> 'invented-uuid'};
 w.v2={shared:{},ui:{esc,icon:()=>'',say(){},notBuilt:()=>''},screen:s=>screen=s,isHuman:()=>true,href:(route,params,query)=>'#/'+route.replace(':id',params?.id||'')+(query?.piece?'?piece='+query.piece:''),advanced:()=> '#/advanced',brand(){},call:async(name,input)=>{calls.push({name,input});if(name==='subject.standing')return standingResult||wait.promise;if(name==='magazine.working-draft.read'){if(answer instanceof Error)throw answer;return structuredClone(typeof answer==='function'?answer():answer);}if(name==='magazine.article-questions')return questions;throw Error('Unexpected call: '+name);}};
 w.eval(source);
 const controller=new w.AbortController(),ctx={params:{id:subject},query:{piece:selected},signal:controller.signal,setTitle:title=>w.document.title=title,setAdvanced(){},on(){}};
 const el=w.document.getElementById('mount');el.innerHTML=screen.render();const ready=screen.mount(el,ctx);
 t.after(()=>{controller.abort();screen.unmount();dom.window.close();});
 return {w,el,calls,ready,release:value=>wait.resolve(value),screen};
}
test('exact registered Magazine words and questions open while full standing is pending, with one working read',async t=>{
 const p=page(t);await tick();await tick();
 assert.match(p.el.querySelector('[data-wr-text]')?.textContent||'',/Invented saved words/);
 assert.ok(p.el.querySelector('[data-wr-question-toggle]'));
 assert.equal(p.calls.filter(c=>c.name==='magazine.working-draft.read').length,1);
 assert.deepEqual(p.calls.map(c=>c.name),['magazine.working-draft.read','magazine.article-questions','subject.standing']);
 const input=p.el.querySelector('[name=answer]'),manuscript=p.el.querySelector('[data-wr-text]'),answered=p.el.querySelector('.wr-question-answer');
 p.el.querySelector('[data-wr-question-toggle]').click();input.value='An unfinished invented answer';input.focus();input.setSelectionRange(3,8);
 p.release(standing());await p.ready;await tick();await tick();
 assert.equal(p.el.querySelector('[name=answer]'),input);assert.equal(input.value,'An unfinished invented answer');assert.equal(p.w.document.activeElement,input);assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,8);
 assert.equal(p.el.querySelector('.wr-question-answer'),answered);assert.match(answered.textContent,/A saved invented answer/);
 assert.equal(p.el.querySelector('[data-wr-text]'),manuscript);assert.match(p.el.querySelector('.wr-back').textContent,/Full invented subject/);assert.match(p.el.querySelector('.wr-tabs').textContent,/Carousel/);
 assert.equal(p.calls.filter(c=>c.name==='magazine.working-draft.read').length,1);
 assert.doesNotMatch(p.el.textContent,/Edit in Magazine/);
});
for(const [label,alter]of [['selection story',r=>r.selection.storyId='mag-foreign'],['selection piece',r=>r.selection.pieceId='foreign:article'],['selection edition',r=>r.selection.edition='published'],['owner kind',r=>r.authority.kind='native'],['owner story',r=>r.authority.storyId='mag-foreign'],['owner piece',r=>r.authority.pieceId='foreign:article'],['owner part',r=>r.authority.partKey='caption'],['missing owner',r=>delete r.authority],['missing document',r=>delete r.document]]){
 test('unverified '+label+' falls back to standing before rendering',async t=>{const r=read();alter(r);const p=page(t,{answer:r});await tick();await tick();assert.equal(p.el.querySelector('[data-wr-text]'),null);assert.equal(p.calls.filter(c=>c.name==='subject.standing').length,1);});
}
for(const [label,opts]of [['ordinary native subject',{subject:'native-invented',selected:'native-invented:article'}],['omitted piece',{selected:null}],['another piece',{selected:id+':caption'}],['foreign piece',{selected:'mag-foreign:article'}]]){
 test(label+' keeps the existing standing path',async t=>{const p=page(t,opts);await tick();assert.equal(p.calls[0].name,'subject.standing');assert.equal(p.calls.filter(c=>c.name==='magazine.working-draft.read').length,0);});
}
test('a failed native owner read falls back to the existing locate path',async t=>{const p=page(t,{answer:new Error('Invented read failure')});await tick();await tick();assert.deepEqual(p.calls.map(c=>c.name),['magazine.working-draft.read','subject.standing']);assert.equal(p.el.querySelector('[data-wr-text]'),null);});
test('late standing after leaving the screen cannot hydrate a replacement screen',async t=>{const p=page(t);await tick();await tick();p.screen.unmount();p.el.innerHTML='<p>Another invented screen</p>';p.release(standing());await tick();await tick();assert.equal(p.el.textContent,'Another invented screen');});

test('a rejected quick owner read still opens through the existing standing owner and normal working read',async t=>{
 let reads=0;const p=page(t,{answer:()=>{const r=read();if(++reads===1)r.authority.storyId='mag-foreign';return r;}});
 await tick();assert.equal(p.el.querySelector('[data-wr-text]'),null);p.release(standing());await p.ready;await tick();
 assert.match(p.el.querySelector('[data-wr-text]').textContent,/Invented saved words/);assert.equal(reads,2);
});
test('foreign background forms and metadata cannot replace the verified owner navigation',async t=>{
 const p=page(t);await tick();await tick();const manuscript=p.el.querySelector('[data-wr-text]'),input=p.el.querySelector('[name=answer]');
 p.release({title:'Foreign metadata',forms:[{...form,owner:{kind:'magazine',storyId:'mag-foreign',pieceId:piece}}]});await tick();await tick();
 assert.equal(p.el.querySelector('[data-wr-text]'),manuscript);assert.equal(p.el.querySelector('[name=answer]'),input);assert.doesNotMatch(p.el.querySelector('.wr-back').textContent,/Foreign/);
});
