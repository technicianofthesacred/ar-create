import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {MessageChannel} from 'node:worker_threads';
import {build} from '../../node_modules/esbuild/lib/main.js';
import {JSDOM} from '../../node_modules/jsdom/lib/api.js';

test('whole portrait sequence edits, templates and photos retain the actual output owner',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'arc-sequence-'));
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 const keys=['window','document','navigator','HTMLElement','Element','Node','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT','MessageChannel'];
 const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='requestAnimationFrame'?(fn)=>setTimeout(fn,0):dom.window[key]});
 const channels=[];globalThis.MessageChannel=class extends MessageChannel{constructor(){super();channels.push(this);}};
 let root;
 try{
  const outfile=join(temp,'fixture.cjs');
  await build({stdin:{contents:"export {default as React,act} from 'react'; export {createRoot} from 'react-dom/client'; export {CarouselWorkspace} from './CarouselWorkspace';",resolveDir:dirname(fileURLToPath(import.meta.url)),loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile,loader:{'.css':'empty'}});
  const {React,act,createRoot,CarouselWorkspace}=createRequire(import.meta.url)(outfile);
  const makeSlide=(id,text)=>({id,role:'inner',text,credit:'',template:'H1',photos:[{src:'',x:50,y:50}],paragraphIds:[]});
  const original={schema:'ar-create.document.v1',id:'synthetic-doc',revision:2,title:'Synthetic sequence',paragraphs:[],outputs:[{id:'carousel',kind:'carousel',stage:'look',wordsReview:{hash:'prior'},manuscriptRevision:1,outputRevision:3,placements:[],createdAt:'2026-10-21',slides:[makeSlide('one','First words'),makeSlide('two','Second words')]}]};
  let current=structuredClone(original),changes=0;
  const api=async(path)=>path.includes('sources')?{sources:[{id:'synthetic-photo',name:'Synthetic photo',rel_path:'photo.jpg'}]}:{exports:[]};
  root=createRoot(document.getElementById('root'));
  const render=()=>root.render(React.createElement(CarouselWorkspace,{doc:current,output:current.outputs[0],options:{api},change:next=>{current=next;changes++;render();}}));
  await act(async()=>render());
  assert.equal(document.querySelectorAll('.car-sequence-card').length,2);
  assert.equal(document.querySelectorAll('.tseq .slide2').length,2);
  assert.equal(document.querySelector('.car-stage-label'),null);
  assert.ok(document.querySelector('.car-add-slide button').disabled);
  assert.equal(document.querySelector('.car-photo-sheet'),null);
  assert.equal(document.querySelectorAll('.car-sequence-preview .car-frame').length,2);
  assert.deepEqual([...document.querySelectorAll('.car-sequence-words')].map(el=>el.value),['First words','Second words']);
  const click=async(label)=>{const el=document.querySelector('[aria-label="'+label+'"]');assert.ok(el,label);await act(async()=>el.click());};
  const words=document.querySelectorAll('.car-sequence-preview [data-edit="text"]')[1];
  await act(async()=>{words.textContent='Second revised inline';words.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  assert.equal(current.outputs[0].slides[1].text,'Second revised inline');
  assert.equal(current.outputs[0].slides[0].text,'First words');
  assert.equal(current.outputs[0].stage,'words');
  assert.equal(current.outputs[0].wordsReview,undefined);
  const firstWords=document.querySelector('.car-sequence-words');
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(firstWords,'First revised below the portrait');firstWords.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  assert.equal(current.outputs[0].slides[0].text,'First revised below the portrait');
  await click('Change template for slide 2');
  const template=[...document.querySelectorAll('.car-layout-option')].find(el=>!el.disabled&&el.getAttribute('aria-pressed')==='false');
  assert.ok(template);
  assert.ok(document.querySelector('.car-stage>.tpick .tph'));
  assert.ok(document.querySelector('.car-tools .car-more-menu [aria-label="Enlarge slide"]'));
  await act(async()=>template.click());
  assert.equal(current.outputs[0].slides[0].template,'H1');
  assert.notEqual(current.outputs[0].slides[1].template,'H1');
  await click('Choose photograph 1 for slide 1');
  await click('Use Synthetic photo for photograph 1');
  assert.equal(current.outputs[0].slides[0].photos[0].src,'/api/sources/blob?id=synthetic-photo');
  assert.equal(current.outputs[0].slides[1].photos[0]?.src||'','');
  await click('Move slide 2 earlier');
  assert.deepEqual(current.outputs[0].slides.map(s=>s.id),['two','one']);
  assert.ok(changes>=4);
  assert.equal(current.id,original.id);
  assert.deepEqual(current.paragraphs,original.paragraphs);
  await click('Close slide controls');
  assert.equal(document.querySelector('.car-body').dataset.panel,'canvas');
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  await act(async()=>window.studyCompositionFocus.focus({kind:'carousel',slideId:'one',photoIndex:0}));
  assert.equal(document.activeElement.closest('.car-sequence-card').dataset.slideId,'one');
 }finally{
  if(root){const {act}=createRequire(import.meta.url)(join(temp,'fixture.cjs'));await act(async()=>root.unmount());}
  for(const channel of channels){channel.port1.close();channel.port2.close();}
  dom.window.close();
  for(const [key,descriptor]of previous)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];
  await rm(temp,{recursive:true,force:true});
 }
});
