import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from '../../node_modules/esbuild/lib/main.js';
import {selectedOutputChanges} from '../../../public/document-study/study-output-host.mjs';
const para=(id,text,heading=false)=>({id,text,doc:{type:'doc',content:[{type:heading?'heading':'paragraph',...(heading?{attrs:{level:2}}:{}),content:[{type:'text',text}]}]},attributions:[],kept:[],origin:'source'});
function fixture(){const manuscript=[para('intro','Exact intro'),para('a','Exact protected words'),para('b','Exact answer'),para('title','A heading',true),para('c','Third passage'),para('next','Next heading',true),para('d','Last passage')];return {schema:'ar-create.document.v1',id:'doc',revision:9,title:'Article',paragraphs:structuredClone(manuscript),outputs:[{id:'article',kind:'article',manuscriptRevision:9,title:'Exact title',placements:[{slot:'side',url:'/api/sources/blob?id=photo',x:.2,y:.8,zoom:1,alt:'Exact alt',caption:'Exact caption'}],manuscript,articleComposition:{schema:'ar-create.article-composition.v1',form:'story',introId:'intro',opening:[{kind:'side',slot:'side',blocks:[{kind:'q',paragraphId:'a'}]},{kind:'a',paragraphId:'b'}],parts:[{titleId:'title',blocks:[{kind:'n',paragraphId:'c'}]},{titleId:'next',blocks:[{kind:'n',paragraphId:'d'}]}],ending:{blocks:[]}},createdAt:'2026-10-22'}, {id:'sibling',kind:'article',manuscript:structuredClone(manuscript),placements:[],manuscriptRevision:9,createdAt:'2026-10-22'}]};}
test('layout reorder saves only existing arrangement references, preserving words, sibling and atomic photo frames',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'arc-article-order-'));
 try{
  const outfile=join(temp,'helper.cjs');await build({entryPoints:[fileURLToPath(new URL('./article-layout-order.ts',import.meta.url))],bundle:true,platform:'node',format:'cjs',outfile});const {moveArticleLayoutUnit,articleOrderBaseline,articleOrderGroups}=createRequire(import.meta.url)(outfile);
  const before=fixture(),frozen=structuredClone(before),stamp=articleOrderBaseline(before,before.outputs[0]);
  const next=moveArticleLayoutUnit(before,'article',{container:'opening',index:0},{container:'opening',index:1},stamp);
  assert.deepEqual(before,frozen);assert.deepEqual(next.paragraphs,before.paragraphs);assert.deepEqual(next.outputs[0].manuscript,before.outputs[0].manuscript);assert.deepEqual(next.outputs[1],before.outputs[1]);assert.deepEqual(next.outputs[0].placements,before.outputs[0].placements);
  assert.deepEqual(next.outputs[0].articleComposition.opening,[before.outputs[0].articleComposition.opening[1],before.outputs[0].articleComposition.opening[0]],'entire photo/quotation frame moves together');
  assert.deepEqual(Object.keys(selectedOutputChanges(before.outputs,next.outputs,'article')),['articleComposition'],'actual transport accepts only the original composition field');
  const restored=moveArticleLayoutUnit(next,'article',{container:'opening',index:1},{container:'opening',index:0},articleOrderBaseline(next,next.outputs[0]));assert.deepEqual(restored,before);
  const sections=moveArticleLayoutUnit(before,'article',{container:'parts',index:0},{container:'parts',index:1},stamp);assert.equal(sections.outputs[0].articleComposition.parts[0].titleId,'next');assert.deepEqual(sections.outputs[0].articleComposition.parts[1],before.outputs[0].articleComposition.parts[0]);
  assert.throws(()=>moveArticleLayoutUnit(before,'article',{container:'opening',index:0},{container:'part:title',index:0},stamp),/same layout group/);
  assert.throws(()=>moveArticleLayoutUnit(before,'article',{container:'intro',index:0},{container:'intro',index:1},stamp),/fixed layout role/);
  assert.throws(()=>moveArticleLayoutUnit(before,'article',{container:'opening',index:0},{container:'opening',index:5},stamp),/no longer available/);
  const changed=structuredClone(before);changed.outputs[0].placements[0].caption='New caption';assert.throws(()=>moveArticleLayoutUnit(changed,'article',{container:'opening',index:0},{container:'opening',index:1},stamp),/changed during/);
  const groups=articleOrderGroups(before,before.outputs[0]);assert.equal(groups.find(g=>g.container==='opening').rows[0].label.includes('Exact protected words'),true);assert.equal(groups.find(g=>g.container==='fixed:introId').fixed,true);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('actual outline handles keyboard and pointer moves; cross-role, stale and cancelled gestures cannot mutate',async()=>{
 const {JSDOM}=await import('../../node_modules/jsdom/lib/api.js'),{MessageChannel}=await import('node:worker_threads');
 const temp=await mkdtemp(join(tmpdir(),'arc-article-outline-')),dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),keys=['window','document','navigator','HTMLElement','Element','Node','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT','MessageChannel'],previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),channels=[];let root,act;
 for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='requestAnimationFrame'?fn=>setTimeout(fn,0):dom.window[key]});
 globalThis.MessageChannel=class extends MessageChannel{constructor(){super();channels.push(this);}};
 try{
  const outfile=join(temp,'outline.cjs');await build({stdin:{contents:"export {default as React,act} from 'react';export {createRoot} from 'react-dom/client';export {ArticleLayoutOutline} from './CompositionWorkspace';",resolveDir:dirname(fileURLToPath(import.meta.url)),loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile,loader:{'.css':'empty'}});
  const bundled=createRequire(import.meta.url)(outfile);act=bundled.act;const {React,createRoot,ArticleLayoutOutline}=bundled;let current=fixture(),changes=0;const statuses=[];root=createRoot(document.getElementById('root'));
  const render=()=>root.render(React.createElement(ArticleLayoutOutline,{doc:current,output:current.outputs[0],change:next=>{changes++;current=next;render();},onStatus:message=>statuses.push(message)}));
  const row=(container,index)=>[...document.querySelectorAll('[data-article-order-container]')].find(el=>el.dataset.articleOrderContainer===container&&Number(el.dataset.articleOrderIndex)===index);
  const pointer=(type,target,x=0,y=0)=>{const event=new dom.window.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y,cancelable:true});Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);};
  await act(async()=>render());const original=structuredClone(current);
  assert.equal(row('fixed:introId',0).querySelector('button'),null,'fixed roles are honest, without a fake drag handle');
  await act(async()=>row('opening',0).querySelector('button').dispatchEvent(new dom.window.KeyboardEvent('keydown',{bubbles:true,key:'ArrowDown',altKey:true})));assert.equal(changes,1);assert.equal(current.outputs[0].articleComposition.opening[1].kind,'side');assert.deepEqual(current.outputs[0].manuscript,original.outputs[0].manuscript);
  document.elementFromPoint=()=>row('parts',1);
  await act(async()=>{pointer('pointerdown',row('parts',0).querySelector('button'));pointer('pointermove',window,0,30);pointer('pointerup',window,0,30);});assert.equal(changes,2);assert.equal(current.outputs[0].articleComposition.parts[0].titleId,'next');
  document.elementFromPoint=()=>row('opening',0);
  await act(async()=>{pointer('pointerdown',row('parts',0).querySelector('button'));pointer('pointermove',window,0,30);pointer('pointerup',window,0,30);});assert.equal(changes,2);assert.match(statuses.at(-1),/same layout group/);
  document.elementFromPoint=()=>row('parts',1);
  await act(async()=>pointer('pointerdown',row('parts',0).querySelector('button')));
  current=structuredClone(current);current.outputs[0].outputRevision=10;await act(async()=>render());
  await act(async()=>{pointer('pointermove',window,0,30);pointer('pointerup',window,0,30);});assert.equal(changes,2);assert.match(statuses.at(-1),/changed during/);
  await act(async()=>{pointer('pointerdown',row('parts',0).querySelector('button'));pointer('pointermove',window,0,30);pointer('pointercancel',window,0,30);pointer('pointerup',window,0,30);});assert.equal(changes,2);
  await act(async()=>pointer('pointerdown',row('parts',0).querySelector('button')));await act(async()=>root.unmount());root=null;pointer('pointermove',window,0,30);pointer('pointerup',window,0,30);assert.equal(changes,2,'unmounted outline removes all gesture callbacks');
  assert.deepEqual(current.outputs[0].placements,original.outputs[0].placements);assert.deepEqual(current.outputs[1],original.outputs[1]);
 }finally{if(root)await act(async()=>root.unmount());for(const channel of channels){channel.port1.close();channel.port2.close();}dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}await rm(temp,{recursive:true,force:true});}
});

test('layout labels show words without quotation or emphasis marks, leaving the manuscript unchanged',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'ar-layout-label-'));
 try{
  const outfile=join(temp,'labels.cjs');await build({entryPoints:[fileURLToPath(new URL('./article-layout-order.ts',import.meta.url))],bundle:true,platform:'node',format:'cjs',outfile});const {articleOrderGroups}=createRequire(import.meta.url)(outfile);
  const doc=fixture();doc.outputs[0].manuscript[0]={...doc.outputs[0].manuscript[0],text:'> "It\'s not the tea, **it\'s the storage.**"'};const before=JSON.stringify(doc);
  const labels=articleOrderGroups(doc,doc.outputs[0]).flatMap(g=>g.rows.map(r=>r.label));
  assert.ok(labels.includes('"It\'s not the tea, it\'s the storage."'),labels.join(' | '));assert.ok(!labels.some(l=>/\*\*|^>/.test(l)));assert.equal(JSON.stringify(doc),before);
 }finally{await rm(temp,{recursive:true,force:true});}
});
