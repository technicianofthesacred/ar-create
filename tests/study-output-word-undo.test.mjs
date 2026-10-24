import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createStudyOutputHost} from '../public/document-study/study-output-host.mjs';

const clone=x=>structuredClone(x),scope={rootBindingId:'11111111-1111-4111-8111-111111111111',parentStudyId:'hk'},undoId='22222222-2222-4222-8222-222222222222',route='/api/study/outputs/undo-words';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let revision=1,operation=0,lose=false,gate=null,transport,remembered=[],selected=[];
 const calls=[],outputs=[{id:'carousel',kind:'carousel',caption:'Saved caption',stage:'words',slides:[{id:'slide',role:'cover',text:'Saved words',credit:'Credit',label:'Heading',template:'M12',photos:[]}]},{id:'sibling',kind:'carousel',caption:'Independent sibling',slides:[{id:'other',role:'cover',text:'Sibling words',credit:'',label:'',template:'M12',photos:[]}]}];
 let wordsUndo={operationId:undoId};const receipts=new Map();
 const owner=id=>({kind:'carousel-words',projectId:'physical',documentId:'document',outputId:id});
 const view=id=>({scope:clone(scope),documentId:scope.rootBindingId,document:{id:scope.rootBindingId,paragraphs:[],outputs:clone(outputs)},outputs:clone(outputs),output:clone(outputs.find(o=>o.id===id)),outputBindings:outputs.map(o=>({outputId:o.id,wordOwner:owner(o.id)})),writingProof:{...owner(id),expected:{hash:'words-'+revision},wordsHash:'words-'+revision},expectedOutput:{revision,hash:'output-'+revision},wordsUndo:id==='carousel'?clone(wordsUndo):null,freshness:{stale:false,writingStale:false,sourceStale:false}});
 const request=async(path,options)=>{calls.push([path,options]);if(options?.method==='POST'){const body=JSON.parse(options.body);if(!receipts.has(body.operationId)){if(path===route){outputs[0].slides[0].text='Exact earlier words';outputs[0].caption='Exact earlier caption';wordsUndo=null;}else if(path.endsWith('/save')){Object.assign(outputs.find(o=>o.id===body.selectedOutputId),clone(body.changes));wordsUndo={operationId:body.operationId};}revision++;receipts.set(body.operationId,{receipt:{operationId:body.operationId},view:view(body.selectedOutputId)});}if(lose){lose=false;throw Error('Synthetic lost reply');}return {ok:true,json:async()=>clone(receipts.get(body.operationId))};}return {ok:true,json:async()=>view(new URL(path,'http://local').searchParams.get('selectedOutputId'))};};
 const start=extra=>createStudyOutputHost({scope,selectedOutputId:'carousel',request,uuid:()=>`33333333-3333-4333-8333-${String(++operation).padStart(12,'0')}`,rememberPending:p=>remembered.push(p),onSelectionChange:id=>selected.push(id),mount:(_element,input)=>{transport=input.transport;return {update:()=>{},flush:async()=>{if(gate)await gate();},destroy:()=>{}};},...extra});
 return {start,calls,view,get transport(){return transport},get remembered(){return remembered},get selected(){return selected},set lose(value){lose=value},set gate(value){gate=value},set wordsUndo(value){wordsUndo=value}};
}

test('host retains validated selected wording Undo and sends only exact existing owner fields',async()=>{
 const f=fixture(),host=await f.start();assert.deepEqual(host.model.wordsUndo,{operationId:undoId});
 await assert.rejects(host.undoWords('foreign-operation'),/wording changed|wording Undo/i);assert.equal(f.calls.length,1);
 const before=host.model,next=await host.undoWords(undoId),body=JSON.parse(f.calls[1][1].body);
 assert.equal(f.calls[1][0],route);assert.deepEqual(body,{...scope,selectedOutputId:'carousel',operationId:body.operationId,expectedOutput:before.expectedOutput,undoOperationId:undoId});assert.equal(next.outputs[0].slides[0].text,'Exact earlier words');assert.equal(next.wordsUndo,null);assert.equal(f.selected.at(-1),'carousel');assert.equal(host.pending,null);host.destroy();
});

test('lost wording Undo reply retains exact operation for existing recovery',async()=>{
 const f=fixture(),host=await f.start();f.lose=true;await assert.rejects(host.undoWords(undoId),/lost reply/);const pending=host.pending;assert.equal(pending.path,route);assert.equal(pending.body.undoOperationId,undoId);await assert.rejects(host.undoWords(undoId),/retained|unconfirmed/i);
 await host.recoverPending();assert.deepEqual(JSON.parse(f.calls.at(-1)[1].body),pending.body);assert.equal(host.pending,null);assert.equal(host.model.wordsUndo,null);assert.equal(host.model.outputs[0].caption,'Exact earlier caption');host.destroy();
});

test('host flush waits for the exact in-flight wording Undo before navigation can replace it',async()=>{
 const f=fixture();let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 const host=await f.start({request:async(path,options)=>{const view=f.view('carousel');if(path===route){entered();await gate;view.wordsUndo=null;view.expectedOutput={revision:2,hash:'output-2'};return {ok:true,json:async()=>({view,receipt:{operationId:JSON.parse(options.body).operationId}})};}return {ok:true,json:async()=>view};}});
 const undo=host.undoWords(undoId);await started;let finished=false;const flushed=host.flush().then(()=>finished=true);await tick();assert.equal(finished,false);assert.equal(host.pending.path,route);release();await undo;await flushed;assert.equal(finished,true);assert.equal(host.pending,null);host.destroy();
});

test('selection changes and a newer flushed save invalidate the displayed wording Undo before dispatch',async()=>{
 const f=fixture(),host=await f.start();let release,first=true;const wait=new Promise(resolve=>release=resolve);f.gate=()=>{if(first){first=false;return wait;}};
 const old=host.undoWords(undoId);await tick();await host.select('sibling');release();await assert.rejects(old,/selection changed|wording changed/i);assert.equal(f.calls.some(([,options])=>options?.method==='POST'),false);host.destroy();
 const g=fixture(),second=await g.start();let saved=false;g.gate=async()=>{if(saved)return;saved=true;const model=second.model,outputs=clone(model.outputs);outputs[0].caption='New saved words before Undo';await g.transport.save({...scope,selectedOutputId:'carousel',expectedOutput:model.expectedOutput,writingProof:model.writingProof,outputs});};
 await assert.rejects(second.undoWords(undoId),/wording changed/i);assert.equal(g.calls.filter(([path])=>path===route).length,0);assert.equal(second.model.outputs[0].caption,'New saved words before Undo');assert.equal(g.selected.at(-1),'carousel','A confirmed save refreshes the surrounding current Undo control');second.destroy();
});

test('malformed or foreign wording receipt and retained browser edits cannot become Undo actions',async()=>{
 for(const invalid of [{operationId:'not-an-operation'},{operationId:undoId,extra:'foreign'},null]){const f=fixture();f.wordsUndo=invalid;const host=await f.start();assert.equal(host.model.wordsUndo,null);await assert.rejects(host.undoWords(undoId),/wording changed|wording Undo/i);assert.equal(f.calls.length,1);host.destroy();}
 const f=fixture(),host=await f.start({readBrowserDraft:()=>({selectedOutputId:'carousel',token:'retained',output:{caption:'Unsaved words'}})});await assert.rejects(host.undoWords(undoId),/unsaved|retained/i);assert.equal(f.calls.length,1);host.destroy();
});

const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),connectionCode=fs.readFileSync(new URL('../public/document-study/output-connection.js',import.meta.url),'utf8');
async function domFixture(){
 const dom=new JSDOM('<body><div id="app"></div></body>',{url:'http://127.0.0.1/',runScripts:'outside-only'}),w=dom.window,d=w.document;let p={id:'hk',view:'record',viewedStage:9},mounted,options;const undone=[];
 w.crypto.randomUUID=()=> '44444444-4444-4444-8444-444444444444';w.current=()=>p;w.phaseReader=()=>'<p>Native editor</p>';w.render=()=>{d.querySelector('#app').innerHTML='<main id="workspace">'+w.phaseReader(p)+'</main>';};w.viewPhase=async stage=>{p.viewedStage=stage;return w.render();};w.switchProject=async id=>{p={...p,id};return w.render();};w.setView=()=>{};w.studyDraft={flush:async()=>({dirty:false}),currentBinding:()=>({id:scope.rootBindingId,parentStudyId:'hk'})};
 const f=fixture();w.fetch=async(url,init)=>{const path=new URL(url,w.location.origin);if(path.pathname==='/api/study-draft/catalog')return {ok:true,json:async()=>({drafts:[{bindingId:scope.rootBindingId,parentStudyId:'hk',bindingStatus:'ready',title:'Synthetic root'}]})};if(path.pathname==='/api/study/outputs')return {ok:true,json:async()=>({...f.view(path.searchParams.get('selectedOutputId')||'carousel'),photoScope:{projectId:'physical',documentId:'document'}})};throw Error('Unexpected '+path.pathname);};
 w.ArStudyOutputHost={mountStudyOutputHost:async(_element,input)=>{options=input;mounted={model:{scope:clone(scope),selectedOutputId:'carousel',outputs:clone(f.view('carousel').outputs),writingProof:clone(f.view('carousel').writingProof),expectedOutput:{revision:1},wordsUndo:{operationId:undoId},outputRelationships:{carousel:{stale:false}}},pending:null,flush:async()=>{},destroy:()=>{},undoWords:async operationId=>{undone.push(operationId);mounted.model.wordsUndo=null;options.onSelectionChange('carousel');return clone(mounted.model);}};return mounted;}};
 w.eval(connectionCode);await tick();await tick();return {dom,w,d,undone,get mounted(){return mounted},get options(){return options}};
}

test('native canvas offers one compact Undo wording action only for its exact current eligible owner',async()=>{
 const f=await domFixture();try{const button=f.d.querySelector('[data-output-undo-words]');assert.ok(button);assert.equal(button.textContent,'Undo wording');assert.equal(button.closest('#study-output-notice')?.id,'study-output-notice');button.click();await tick();assert.deepEqual(f.undone,[undoId]);assert.equal(f.d.querySelector('[data-output-undo-words]'),null);
  f.mounted.model.wordsUndo={operationId:undoId};f.options.onSelectionChange('carousel');const stale=f.d.querySelector('[data-output-undo-words]');assert.ok(stale);f.mounted.model.selectedOutputId='sibling';f.options.onSelectionChange('sibling');assert.equal(f.d.querySelector('[data-output-undo-words]'),null);stale.click();await tick();assert.deepEqual(f.undone,[undoId],'A detached old owner action cannot call Undo on the new selection');
 }finally{f.dom.window.close();}
});
