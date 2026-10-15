import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {createStore,createInitialState} from './store.mjs';
import {outputRecordsExpected,outputPrivatePrefix} from './output-records.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const guard=store=>({expectedProjectId:store.get().project.id,expectedRevision:store.get().revision});
const date='2026-10-13T00:00:00.000Z';
async function fixture(t,options={}){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'output-store-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const project=createInitialState().project;project.id='project-a';project.title='Native-owned manuscript';project.draft='Legacy remains';project.document={schema:'ar-create.document.v1',id:'document-a',title:'Native document',revision:17,paragraphs:[{id:'p-a',text:'Protected native wording',doc:{type:'doc',content:[]},attributions:[],kept:[]}],outputs:[]};
 fs.writeFileSync(path.join(dataDir,'state.json'),JSON.stringify({revision:6,project},null,2));
 const store=await createStore({dataDir,sharedArticles:true,...options});t.after(()=>store.close().catch(()=>{}));return {dataDir,store,project};
}
const input=project=>({projectId:project.id,documentId:project.document.id,expectedOutput:outputRecordsExpected(project.document),operationId:randomUUID(),commandHash:hash('synthetic-exact-action')});
function preparation(project,{finalCheck=async()=>{},extraFiles=[]}={}){
 const outputs=[{id:'output-a',kind:'article',manuscript:[{id:'o-p',text:'Independent captured output',doc:{type:'doc',content:[]},attributions:[],kept:[]}],placements:[]}];
 return {outputs,nativeOutputIndex:{schema:'ar-create.native-output-index.v1',revision:outputRecordsExpected(project.document).revision+1,records:[{outputId:'output-a',wordOwner:{kind:'native',bindingId:'native-a',parentStudyId:'study-a'},captureId:'capture-a',proofId:'proof-a',historyIds:[],createdAt:date,updatedAt:date}]},extraFiles,finalCheck};
}
const manuscript=project=>{const p=structuredClone(project);delete p.document.outputs;delete p.document.nativeOutputIndex;return p;};
test('active save changes only outputs/index; receipt replay bypasses stale revision and callback',async t=>{
 const {store,project}=await fixture(t);const scope=input(project);let calls=0;
 const result=await store.saveOutputRecords(scope,async({project:target})=>{calls++;assert.deepEqual(target,project);target.document.title='Callback clone only';return preparation(project);});
 assert.equal(result.alreadySaved,false);assert.deepEqual(manuscript(store.get().project),manuscript(project));assert.equal(store.get().project.document.revision,17);
 const after=store.get();const replay=await store.saveOutputRecords(scope,()=>{throw Error('Must never replay');});assert.equal(replay.alreadySaved,true);assert.deepEqual(replay.receipt,result.receipt);assert.deepEqual(store.get(),after);assert.equal(calls,1);assert.equal(result.receipt.commandHash,scope.commandHash);
 await assert.rejects(store.saveOutputRecords({...scope,commandHash:hash('different-crop')},()=>{calls++;return preparation(project);}),/different input/);assert.equal(calls,1);
 await assert.rejects(store.saveOutputRecords({...scope,documentId:'foreign'},()=>preparation(project)),/different input/);
 await assert.rejects(store.saveOutputRecords({...scope,operationId:randomUUID()},()=>preparation(project)),/changed since/);
});
test('inactive save leaves exact active state file and active manuscript, index and revision unchanged',async t=>{
 const {store,dataDir,project}=await fixture(t);await store.createPiece({...guard(store),title:'Other active piece'});
 const active=store.get(),activeBytes=fs.readFileSync(path.join(dataDir,'state.json')),article=await store.readArticle();
 const scope=input(project);await store.saveOutputRecords(scope,({project:target})=>preparation(target));
 assert.deepEqual(store.get(),active);assert.deepEqual(fs.readFileSync(path.join(dataDir,'state.json')),activeBytes);assert.deepEqual(await store.readArticle(),article);
 const saved=await store.readArticle({projectId:project.id});assert.deepEqual(manuscript(saved.project),manuscript(project));assert.equal(saved.document.outputs.length,1);
 await store.close();const restart=await createStore({dataDir,sharedArticles:true});assert.deepEqual(restart.get(),active);assert.equal((await restart.readArticle({projectId:project.id})).document.outputs.length,1);await restart.close();
});
test('foreign document, callback manuscript fields, mutable prose metadata and failed source proofs are refused before publication',async t=>{
 const {store,project}=await fixture(t);const before=store.get();
 await assert.rejects(store.saveOutputRecords({...input(project),documentId:'foreign'},()=>preparation(project)),/another document/);
 await assert.rejects(store.saveOutputRecords(input(project),()=>({...preparation(project),title:'replace source'})),/exactly/);
 await assert.rejects(store.saveOutputRecords(input(project),()=>{const p=preparation(project);p.nativeOutputIndex.records[0].paragraphs=[];return p;}),/only IDs/);
 await assert.rejects(store.saveOutputRecords(input(project),()=>preparation(project,{finalCheck:()=>{throw Error('Native changed');}})),/Native changed/);
 assert.deepEqual(store.get(),before);
});
test('owned captures are atomically CAS-bound and outside paths/symlink/hardlink directories refused',async t=>{
 const {store,project,dataDir}=await fixture(t);const relativePath=outputPrivatePrefix(project.id,project.document.id)+'captures/capture-a.json',contents=JSON.stringify({proof:'synthetic'});
 await store.saveOutputRecords(input(project),()=>preparation(project,{extraFiles:[{relativePath,contents,expectedHash:null}]}));assert.equal(fs.readFileSync(path.join(dataDir,relativePath),'utf8'),contents);
 const current=store.get().project,scope=input(current),before=store.get();
 await assert.rejects(store.saveOutputRecords(scope,()=>preparation(current,{extraFiles:[{relativePath,contents:'new',expectedHash:hash('wrong')}]})),/changed after inspection/);assert.deepEqual(store.get(),before);
 for(const candidate of ['state.json',outputPrivatePrefix(project.id,'foreign')+'captures/c.json',outputPrivatePrefix(project.id,project.document.id)+'captures/../state.json'])await assert.rejects(store.saveOutputRecords(scope,()=>preparation(current,{extraFiles:[{relativePath:candidate,contents:'x',expectedHash:null}]})),/namespace/);
 const linked=outputPrivatePrefix(project.id,project.document.id)+'captures/linked.json';fs.symlinkSync(path.join(dataDir,relativePath),path.join(dataDir,linked));await assert.rejects(store.saveOutputRecords(scope,()=>preparation(current,{extraFiles:[{relativePath:linked,contents:'x',expectedHash:null}]})),/ordinary private/);
 const hard=outputPrivatePrefix(project.id,project.document.id)+'captures/hard.json';fs.linkSync(path.join(dataDir,relativePath),path.join(dataDir,hard));await assert.rejects(store.saveOutputRecords(scope,()=>preparation(current,{extraFiles:[{relativePath:hard,contents:'x',expectedHash:null}]})),/ordinary private/);
 const dir=path.join(dataDir,outputPrivatePrefix(project.id,project.document.id),'history');fs.symlinkSync(path.join(dataDir,outputPrivatePrefix(project.id,project.document.id),'captures'),dir);await assert.rejects(store.saveOutputRecords(scope,()=>preparation(current,{extraFiles:[{relativePath:outputPrivatePrefix(project.id,project.document.id)+'history/h.json',contents:'x',expectedHash:null}]})),/real private/);
});
test('every native output publication interruption recovers capture, index and receipt without manuscript/native changes',async t=>{
 for(const inactive of [false,true])for(const point of ['after-intent',...Array.from({length:7},(_,i)=>`after-file:${i}`),'before-complete','after-complete']){
  let armed=false,intent;const f=await fixture(t,{publicationFault:(where,value)=>{if(armed){intent=value;if(where===point)throw Error('interrupted');}}});
  if(inactive)await f.store.createPiece({...guard(f.store),title:'Active B'});
  const activeBefore=f.store.get(),scope=input(f.project),relativePath=outputPrivatePrefix(f.project.id,f.project.document.id)+'captures/capture-a.json';
  const source=path.join(f.dataDir,'synthetic-native-original.md');fs.writeFileSync(source,'Native sole words');armed=true;
  // Inactive publication has six entries, active has seven. Skip absent fault points.
  if(inactive&&point==='after-file:6'){await f.store.close();continue;}
  await assert.rejects(f.store.saveOutputRecords(scope,()=>preparation(f.project,{extraFiles:[{relativePath,contents:'private proof',expectedHash:null}]})),/interrupted/);armed=false;
  await f.store.close();const restarted=await createStore({dataDir:f.dataDir,sharedArticles:true});
  const replay=await restarted.saveOutputRecords(scope,()=>{throw Error('Must not replay preparation');});assert.equal(replay.alreadySaved,true);
  assert.deepEqual(manuscript((await restarted.readArticle({projectId:f.project.id})).project),manuscript(f.project));assert.equal(fs.readFileSync(source,'utf8'),'Native sole words');assert.equal(fs.readFileSync(path.join(f.dataDir,relativePath),'utf8'),'private proof');
  if(inactive)assert.deepEqual(restarted.get(),activeBefore);assert.equal(fs.existsSync(path.join(f.dataDir,'article-publication.pending.json')),false);await restarted.close();
 }
});

test('serialized simultaneous output saves have one winner and live-owner lost reply refreshes inactive baselines',async t=>{
 const f=await fixture(t);const scope=input(f.project),other={...scope,operationId:randomUUID()};
 const results=await Promise.allSettled([f.store.saveOutputRecords(scope,()=>preparation(f.project)),f.store.saveOutputRecords(other,()=>preparation(f.project))]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
 let armed=false;const g=await fixture(t,{publicationFault:point=>{if(armed&&point==='after-complete')throw Error('lost response');}});await g.store.createPiece({...guard(g.store),title:'B'});const first=input(g.project);armed=true;await assert.rejects(g.store.saveOutputRecords(first,()=>preparation(g.project)),/lost response/);armed=false;
 const replay=await g.store.saveOutputRecords(first,()=>{throw Error('Replay');});assert.equal(replay.alreadySaved,true);const saved=(await g.store.readArticle({projectId:g.project.id})).project;await g.store.saveOutputRecords(input(saved),()=>preparation(saved));assert.equal((await g.store.readArticle({projectId:g.project.id})).document.nativeOutputIndex.revision,2);
});

test('trusted carousel save publishes independent words and refuses a foreign wording owner',async t=>{
 const {store,project}=await fixture(t);const outputs=[{id:'carousel-a',kind:'carousel',slides:[{id:'slide-a',text:'Independent carousel words'}]}];
 const prepared=()=>({outputs,nativeOutputIndex:{schema:'ar-create.native-output-index.v1',revision:1,records:[{outputId:'carousel-a',wordOwner:{kind:'carousel-words',projectId:project.id,documentId:project.document.id,outputId:'carousel-a'},captureId:'carousel-capture',proofId:'carousel-proof',historyIds:[],createdAt:date,updatedAt:date}]},finalCheck:async()=>{}});
 const foreign=prepared();foreign.nativeOutputIndex.records[0].wordOwner.documentId='foreign';await assert.rejects(store.saveOutputRecords(input(project),()=>foreign),/another document/);
 const saved=await store.saveOutputRecords(input(project),prepared);assert.equal(saved.receipt.savedOutput.revision,1);const words=await store.readCarouselWords({documentId:project.document.id,outputId:'carousel-a'});assert.match(words.raw,/Independent carousel words/);assert.deepEqual(manuscript(store.get().project),manuscript(project));
});
