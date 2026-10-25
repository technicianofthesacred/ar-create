import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
let source=await readFile(new URL('../public/document-study/source-imported.js',import.meta.url),'utf8');
for(const [from,to] of [['source-dialogue.js','source-dialogue.mjs'],['translation-readiness.js','translation-readiness.js'],['interpretation-view.js','interpretation-view.js']])source=source.replace(`'./${from}'`,JSON.stringify(new URL(`../public/document-study/${to}`,import.meta.url).href));
const {installSourceReader}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('large conversations bound DOM identity reads while preserving every editable remark and its evidence',async()=>{
 const turns=Array.from({length:1100},(_,i)=>({id:`invented-turn-${i}`,speaker:`Speaker ${i%3+1}`,language:'zh',text:`Invented current wording ${i}.`,originalText:`虚构原文 ${i}`}));
 const session={id:'invented-session',sourceId:'11111111-1111-4111-8111-111111111111',sourceHash:'a'.repeat(64),version:1,title:'Invented long conversation',interpretation:true,turns};
 const data={revision:7,sessions:[session],notes:{}},before=JSON.stringify(data),requests=[];
 const dom=new JSDOM('<main id="app"><div id="stage-working-lane"><section class="material-surface"><header class="material-heading"></header><div class="material-layout"><div class="material-reading"></div></div></section></div></main>',{url:'http://localhost/'}),{window}=dom,doc=window.document;
 const storageKey='ar-create:source-reader:v1';
 window.localStorage.setItem(storageKey,JSON.stringify({projects:{'invented-project':{sessionId:session.id}},drafts:{}}));
 // Count DOM identity access rather than assert a machine-dependent elapsed time.
 let identityReads=0;const dataset=Object.getOwnPropertyDescriptor(window.HTMLElement.prototype,'dataset');
 Object.defineProperty(window.HTMLElement.prototype,'dataset',{...dataset,get(){if(this.hasAttribute('data-source-reader-turn'))identityReads++;return dataset.get.call(this);}});
 const api=installSourceReader({document:doc,getProject:()=>({id:'invented-project',view:'record',viewedStage:2}),fetch:async(url,options={})=>{requests.push({url,options});assert.equal(options.method,undefined,'rendering and typing never save to the owner');return url==='/api/source-sessions'?{ok:true,json:async()=>structuredClone(data)}:{ok:false,status:404};}});
 try{
  await new Promise(resolve=>setTimeout(resolve,0));
  const nodes=[...doc.querySelectorAll('[data-source-reader-turn]')];
  assert.equal(nodes.length,turns.length);
  assert.ok(identityReads<=turns.length*2,`one render should read DOM turn identity a bounded number of times, saw ${identityReads} for ${turns.length} remarks`);
  for(const [i,node] of nodes.entries()){
   const turn=turns[i];assert.equal(node.dataset.sourceReaderTurn,turn.id);assert.equal(node.dataset.sourceReaderSession,session.id);assert.equal(node.textContent,turn.text);
   assert.equal(node.getAttribute('contenteditable'),'plaintext-only');assert.equal(node.getAttribute('aria-readonly'),'false');assert.equal(node.getAttribute('role'),'textbox');
   assert.equal(node.closest('.source-dialogue-group').querySelector('.source-speaker').textContent,turn.speaker);
   const pair=node.closest('[data-source-reader-pair]');assert.equal(pair.dataset.sourceReaderPair,turn.id);assert.equal(pair.dataset.sourceReaderPairKind,'translated');
   const original=pair.querySelector('[data-source-reader-original-for]');assert.equal(original.dataset.sourceReaderOriginalFor,turn.id);assert.ok(original.textContent.endsWith(turn.originalText));assert.equal(original.hidden,true);
  }
  const target=nodes[517];let clicks=0;target.addEventListener('click',()=>clicks++);target.click();
  assert.equal(clicks,1);assert.deepEqual(api.getState().drafts,{},'click alone creates no correction');
  const wording='Invented unsaved first line.\n\nInvented third line.';target.textContent=wording;target.dispatchEvent(new window.Event('input',{bubbles:true}));
  api.mount();await new Promise(resolve=>setTimeout(resolve,0));
  const retained=[...doc.querySelectorAll('[data-source-reader-turn]')];assert.ok(nodes.every((node,i)=>retained[i]===node),'mount preserves all original editable nodes and their handlers');
  assert.equal(target.textContent,wording);assert.equal(target.dataset.sourceReaderField,'text');target.click();assert.equal(clicks,2);
  const draft=Object.values(api.getState().drafts)[0];assert.equal(draft.text,wording);assert.equal(draft.speaker,turns[517].speaker);assert.equal(draft.sourceId,session.sourceId);assert.equal(draft.baseSourceHash,session.sourceHash);assert.equal(draft.baseRevision,7);
  assert.equal(JSON.stringify(api.getState().data),before,'canonical words and source identities remain unchanged');assert.equal(JSON.parse(window.localStorage.getItem(storageKey)).drafts[JSON.stringify(['invented-project',session.id,turns[517].id])].text,wording);
 }finally{api.dispose();window.close();}
});
