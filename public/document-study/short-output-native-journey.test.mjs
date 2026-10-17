/* Synthetic native editor → real HTTP/file proof; no browser pixels or live content. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from '../../runtime/server.mjs';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./draft-flow.js',import.meta.url),'utf8');
const wait=async(fn,label)=>{for(let n=0;n<160;n++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out: '+label);};
function editor(origin,parent,transport,{retained=null}={}){
 const dom=new JSDOM('<main id="app"></main>',{url:origin+'/document-study/',runScripts:'outside-only'}),w=dom.window;
 const p={id:parent,name:'Invented tea collection',view:'record',viewedStage:1,blocks:[],title:'Collection',history:[],note:null,originalNotes:[],rev:1};
 w.state={projects:[p]};w.current=()=>p;w.selected=null;w.activeBlock=null;w.keyboardBlock=null;w.typingSession=null;w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;
 w.studyCollectionWorkspace={supports:id=>id===parent};w.fetch=transport;
 w.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.readonlyHTML=x=>x;w.shortRecordName=x=>x;w.WORKFLOW_RECORDS={};
 for(const name of ['toast','commitTyping','rememberPosition','save','undo','refreshDiscussion','wireDocument','openInstruction'])w[name]=()=>{};
 w.blockHTML=b=>'<'+b.tag+' data-block="'+b.id+'">'+b.html+'</'+b.tag+'>';
 w.article=x=>'<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">'+x.blocks.map(w.blockHTML).join('')+'</div><aside id="margin"></aside><div class="marginHint"></div>';
 w.phaseReader=()=>'<p>Collection material</p>';w.render=()=>{w.document.getElementById('app').innerHTML=p.view==='article'?w.article(p):w.phaseReader(p);};
 w.onTyping=el=>{p.blocks=[...el.children].map(child=>({id:child.dataset.block,tag:child.tagName.toLowerCase(),html:child.innerHTML,source:'Owned'}));};
 w.viewPhase=stage=>{p.viewedStage=stage;p.view='record';w.render();};w.setView=view=>{p.view=view;w.render();};w.workflowBar=()=>'';w.historicalNotice=()=>'';
 if(retained){p.ownedDraft={bindingId:retained.binding.id,sequence:retained.sequence};w.localStorage.setItem('ar-document-study-owned-drafts-v1',JSON.stringify({projects:{[parent]:{active:retained.binding.id,browser:null}},documents:{[retained.binding.id]:retained}}));}
 w.eval(code);
 return {dom,w,p,type(words){const el=w.document.getElementById('manuscript');el.innerHTML='<p></p>';el.firstElementChild.textContent=words;w.onTyping(el);assert.equal(w.studyDraft.currentProof().dirty,true);}};
}
test('blank collection Post and Product listing type, save, switch, reload and exact native Undo through real HTTP',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-short-native-ui-')));fs.mkdirSync(path.join(dir,'vault'));fs.mkdirSync(path.join(dir,'files'));const server=await createServer({dataDir:path.join(dir,'owned'),publicDir:path.join(dir,'public'),studyOriginalRoots:{vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')},sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,calls=[],windows=[];
 t.after(async()=>{for(const dom of windows)dom.window.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const transport=(url,options)=>{const u=new URL(url,origin),body=options?.body?JSON.parse(options.body):null;calls.push({path:u.pathname,body});return fetch(u,options?.method==='POST'?{...options,headers:{...options.headers,Origin:origin}}:options);};
 const get=async route=>{const response=await transport(route),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
 const post=async(route,input)=>{const response=await transport(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
 const parent='collection-'+randomUUID(),root=await post('/api/study-draft/create-collection',{parentStudyId:parent,title:'Invented tea collection',operationId:randomUUID()}),scope={rootBindingId:root.binding.id,parentStudyId:parent};
 const rootRead=()=>get('/api/study-draft/read?'+new URLSearchParams({bindingId:root.binding.id,parentStudyId:parent})),before=await rootRead();
 const readOutputs=()=>get('/api/study/outputs?'+new URLSearchParams(scope));let view=await readOutputs();const outputs=[];
 for(const kind of ['post','product-listing']){const made=await post('/api/study/outputs/create',{...scope,kind,expectedOutput:view.expectedOutput,operationId:randomUUID()});view=made.view;outputs.push({id:view.output.id,kind,bindingId:view.wordOwner.bindingId});}
 assert.equal(view.outputs.length,2);assert.equal(view.outputs.some(o=>o.kind==='article'),false);assert.notEqual(outputs[0].bindingId,outputs[1].bindingId);
 let f=editor(origin,parent,transport);windows.push(f.dom);const blank=new Map(),saved=new Map();
 const readNative=o=>get('/api/study-draft/read?'+new URLSearchParams({bindingId:o.bindingId,parentStudyId:parent}));
 const open=o=>f.w.studyDraft.openBinding({bindingId:o.bindingId,parentStudyId:parent,canonicalOutputId:o.id});
 for(const o of outputs){const initial=await readNative(o);blank.set(o.id,initial.raw);assert.equal(initial.binding.sourceBindingId,root.binding.id);assert.equal(initial.context.parentStudyId,parent);assert.equal(initial.context.originalId,before.context.originalId);assert.equal(initial.context.origin,before.context.origin);assert.deepEqual(initial.context.records.map(({copiedPath,...record})=>record),before.context.records.map(({copiedPath,...record})=>record));
  await open(o);assert.equal(f.w.document.getElementById('manuscript').textContent,'');assert.equal(f.p.blocks.length,1);assert.equal(f.p.blocks[0].html,'<br>');const callsBefore=calls.filter(c=>c.path==='/api/study-draft/save').length;assert.equal((await f.w.studyDraft.flush()).dirty,false);assert.equal(calls.filter(c=>c.path==='/api/study-draft/save').length,callsBefore);
  f.type('Independent '+o.kind+' words from the same tea collection.');const proof=await f.w.studyDraft.flush();assert.equal(proof.dirty,false,JSON.stringify(proof));
  const stored=await readNative(o);saved.set(o.id,stored.raw);assert.equal(fs.readFileSync(stored.paths.draft,'utf8'),stored.raw);assert.match(stored.raw,new RegExp('Independent '+o.kind));
  const request=calls.filter(c=>c.path==='/api/study-draft/save').at(-1).body;assert.equal(request.bindingId,o.bindingId);assert.ok(request.operations.some(op=>op.kind==='insert'));assert.equal(request.operations.some(op=>op.kind==='text'),false);
 }
 for(const o of outputs){await open(o);assert.match(f.w.document.getElementById('manuscript').textContent,new RegExp('Independent '+o.kind));assert.equal((await readNative(o)).raw,saved.get(o.id));}
 // Replay a legacy cache containing the real correspondence's existing empty ID beside safe words.
 const native=await readNative(outputs[0]),placeholder=native.projection.find(row=>row.safe===false&&row.raw===''&&row.words==='');assert.ok(placeholder);
 const legacyBlocks=[...native.projection.filter(row=>row.safe!==false).map(row=>({id:row.id,tag:'p',html:row.words,source:'Owned'})),{id:placeholder.id,tag:'div',html:'',source:'Legacy empty',draftOpaque:true,draftOpaqueVersion:2}];
 const retained={binding:native.binding,base:native.projection,blocks:legacyBlocks,expected:native.expected,serverRaw:native.raw,paths:native.paths,context:native.context,serverHistory:native.history,approvalReview:native.approvalReview,history:[],note:null,sequence:3,status:'Saved to working file'};
 const legacy=editor(origin,parent,transport,{retained});windows.push(legacy.dom);const beforeCalls=calls.length;legacy.w.studyDraft.resumeCurrent({bindingId:native.binding.id,parentStudyId:parent});assert.equal((await legacy.w.studyDraft.flush()).dirty,false);assert.equal(calls.length,beforeCalls,'Unchanged legacy blank must not submit a split or read');assert.equal(fs.readFileSync(native.paths.draft,'utf8'),native.raw);legacy.dom.window.close();
 // A fresh JS context has no device cache: all content and Undo eligibility come from the native service.
 f.dom.window.close();f=editor(origin,parent,transport);windows.push(f.dom);
 for(const o of outputs){await open(o);assert.match(f.w.document.getElementById('manuscript').textContent,new RegExp('Independent '+o.kind));const button=f.w.document.querySelector('[data-draft-action="disk-undo"]');assert.ok(button&&!button.disabled);button.click();
  await wait(async()=>(await readNative(o)).raw===blank.get(o.id),'native Undo '+o.kind);await wait(()=>f.w.studyDraft.currentProof()?.dirty===false&&f.w.document.getElementById('manuscript')?.textContent==='','blank editor after Undo');
  assert.equal((await readNative(o)).raw,blank.get(o.id));const index=outputs.indexOf(o);for(const later of outputs.slice(index+1))assert.equal((await readNative(later)).raw,saved.get(later.id),'Undo must retain sibling saved words');
 }
 const after=await rootRead();assert.equal(after.raw,before.raw);assert.deepEqual(after.expected,before.expected);assert.deepEqual(after.context,before.context);
 assert.equal((await readOutputs()).outputs.some(o=>o.kind==='article'),false);assert.equal(calls.filter(c=>c.path==='/api/study-draft/undo').length,2);
});
