// Full native Connect → Write → Arrange regression with real saved owners.
// Run: AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs node tests/native-arrange-navigation.browser.mjs
// No installed app, private files or production permission changes are used.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createWorkspaceExecution} from '../runtime/services/artifact-execution.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {withActor} from '../runtime/services/actor.mjs';
const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config)),actor={actor:'agent:codex',client:'ui'};
fs.mkdirSync(config.dataDir,{recursive:true});
const drafts=createStudyDraftCopies({dataDir:config.dataDir,originals:createStudyOriginals(config.studyOriginalRoots)});
const base=await withActor(actor,()=>drafts.createCollection({parentStudyId:'arrange-invented',title:'Arrange proof · invented tea garden',operationId:randomUUID()}));
const copies=[];
for(const title of ['Arrange Article','Independent Article'])copies.push(await withActor(actor,()=>drafts.cloneStructureTest({sourceBindingId:base.binding.id,sourceParentStudyId:base.binding.parentStudyId,expected:base.expected,title,operationId:randomUUID()})));
const allowed=new Set(copies.map(d=>d.binding.id));
for(let i=0;i<copies.length;i++){let d=copies[i];copies[i]=await withActor(actor,()=>drafts.save({bindingId:d.binding.id,parentStudyId:d.binding.parentStudyId,expected:d.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:i?'Independent sibling wording stays exact.':'The invented tea garden waits for rain.'}]}));}
const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:true,voiceHome:null,packageView:{syntheticFixtures:true},execution:createWorkspaceExecution({codexPath:null,boundedEditorial:true})});
// Test-only HTTP bridge: the real manuscript owner and provenance are used.
// Agent prose writes are permitted ONLY for this process's registered synthetic
// copies. This is not a production permission change or a human impersonation.
const handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.method==='POST'&&req.url==='/api/study-draft/save'){
  try{let body='';for await(const c of req)body+=c;const input=JSON.parse(body);if(!allowed.has(input.bindingId)||req.headers['x-ar-actor']!=='agent:codex')throw Object.assign(Error('Synthetic stand-in only'),{status:403});const out=await withActor(actor,()=>drafts.save(input));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(out));}catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
 }
 handler(req,res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const cfg={url:'http://127.0.0.1:'+server.address().port,fixture,copies},dir=process.env.AR_CREATE_ARRANGE_PROOF||path.join(fixture.dir,'proof');fs.mkdirSync(dir,{recursive:true});
const api=async(route,input)=>{const response=await fetch(cfg.url+route,{method:input?'POST':'GET',headers:{'Content-Type':'application/json','X-AR-Actor':'agent:codex','X-AR-Client':'ui'},...(input?{body:JSON.stringify(input)}:{})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
for(const copy of copies)await api('/api/study/structure-tests',{sourceBindingId:base.binding.id,sourceParentStudyId:base.binding.parentStudyId,expected:base.expected,title:copy.binding.title,operationId:copy.binding.parentStudyId.replace('structure-test-','')});
const group={rootBindingId:copies[0].binding.id,parentStudyId:copies[0].binding.parentStudyId},outputBefore=await api('/api/study/outputs?'+new URLSearchParams(group));
const carousel=(await api('/api/study/outputs/stand-in-create',{...group,kind:'carousel',sourceBindingId:group.rootBindingId,expectedNative:(await api('/api/study-draft/read?'+new URLSearchParams({bindingId:group.rootBindingId,parentStudyId:group.parentStudyId}))).expected,expectedOutput:outputBefore.expectedOutput,operationId:randomUUID()})).view;
const carouselBefore=JSON.stringify(carousel.output),carouselHash=carousel.writingProof.wordsHash;
function hashes(root){return Object.fromEntries(fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const file=path.join(e.parentPath,e.name);return [path.relative(root,file),createHash('sha256').update(fs.readFileSync(file)).digest('hex')];}));}
const originalsBefore=hashes(fixture.vault);
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
const shot=async(page,name)=>page.screenshot({path:path.join(dir,name+'.png')});
const read=async d=>api('/api/study-draft/read?'+new URLSearchParams({bindingId:d.binding.id,parentStudyId:d.binding.parentStudyId}));
const snapshot=page=>page.evaluate(()=>({projectId:current().id,stage:current().viewedStage,binding:studyDraft.currentBinding?.(),proof:studyDraft.currentProof?.(),owner:workspaceNavigation.navigationOwner?.(),selection:studyOutputConnection.selection?.(),text:document.body.innerText}));
async function pageFor(copy){const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(cfg.url+'/document-study/index.html?reviewActor=agent:codex');await page.waitForSelector('#combined-piece-frame');if(copy){await page.evaluate(d=>{let p=state.projects.find(p=>p.id===d.binding.parentStudyId);if(!p){p={id:d.binding.parentStudyId,name:d.binding.title,title:d.binding.title,collectionKind:'collection-root',collectionBindingId:d.binding.id,view:'article',viewedStage:5,blocks:[],history:[],note:null,positions:{},slides:[],rev:1};state.projects.push(p);}state.project=p.id;render();window.arrangeOpen=studyDraft.openBinding({bindingId:d.binding.id,parentStudyId:p.id});},copy);await page.waitForFunction(id=>studyDraft.currentBinding()?.id===id,copy.binding.id);await page.locator('#manuscript').waitFor();}return page;}
async function rail(page,name){await page.locator('.combined-rail [data-combined-nav="'+name+'"]').click();}
async function type(page,text){await page.locator('#manuscript [data-block]').first().click();await page.evaluate(()=>{const el=document.querySelector('#manuscript [data-block]'),r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);});await page.keyboard.insertText(text);}
try{
 // The reported path, through actual visible Research controls on a fresh subject.
 const page=await pageFor();await rail(page,'research');await page.waitForTimeout(350);if(await page.locator('[data-combined-sheet-full]').isVisible())await page.locator('[data-combined-sheet-full]').click();await page.getByRole('button',{name:'Connect source context',exact:true}).click();await page.waitForFunction(()=>!!studyDraft.currentBinding());await rail(page,'write');await page.waitForFunction(()=>current().viewedStage===5&&!studyDraft.currentProof()?.dirty);await page.waitForTimeout(400);
 const connected=await snapshot(page);assert.equal(connected.proof.dirty,false);assert.equal(connected.owner.owner.kind,'native');await rail(page,'arrange');await page.waitForFunction(()=>current().viewedStage===9);const arranged=await snapshot(page);assert.equal(arranged.binding.id,connected.binding.id);assert.equal(arranged.proof.draftHash,connected.proof.draftHash);assert.equal(arranged.selection,connected.selection);assert.match(arranged.text,/words only: no photographs and no visual output to lay out/);assert.doesNotMatch(arranged.text,/owner or revision changed/);await shot(page,'connect-write-arrange');await rail(page,'write');await page.waitForSelector('#manuscript');assert.equal((await snapshot(page)).binding.id,connected.binding.id);await page.close();
 // Real registered test copy: actual draft save, Arrange, reopen, exact eligible Undo.
 const a=await pageFor(copies[0]),original=await read(copies[0]),otherBefore=await read(copies[1]);
 const outputs=()=>api('/api/study/outputs?'+new URLSearchParams(group));const beforeOutputs=(await outputs()).outputs.map(o=>o.id);
 await a.route('**/api/study-draft/save',route=>route.abort('failed'));await type(a,'Invented saved wording survives Arrange.');await a.waitForFunction(()=>studyDraft.currentProof()?.dirty);await rail(a,'arrange');await a.waitForTimeout(500);assert.equal((await snapshot(a)).stage,5);assert.match(await a.locator('#manuscript').innerText(),/Invented saved wording survives Arrange/);await shot(a,'dirty-navigation-refused');
 await a.unroute('**/api/study-draft/save');await a.evaluate(()=>{window.arrangeSave=studyDraft.flush();});await a.waitForFunction(()=>!studyDraft.currentProof()?.dirty);const saved=await read(copies[0]);assert.match(saved.raw,/Invented saved wording survives Arrange/);
 await rail(a,'arrange');await a.waitForFunction(()=>current().viewedStage===9);const copyArranged=await snapshot(a);assert.equal(copyArranged.binding.id,copies[0].binding.id);assert.equal(copyArranged.proof.draftHash,saved.expected.workflow.draft);await shot(a,'saved-copy-arrange');assert.deepEqual((await outputs()).outputs.map(o=>o.id),beforeOutputs,'navigation must not manufacture another output');
 await rail(a,'write');await a.waitForSelector('#manuscript');assert.match(await a.locator('#manuscript').innerText(),/Invented saved wording survives Arrange/);await a.locator('#combined-piece-frame .cp-more').click();await a.getByRole('button',{name:'Undo saved',exact:true}).click();await a.waitForFunction(hash=>studyDraft.currentProof()?.draftHash===hash,original.expected.workflow.draft);const undone=await read(copies[0]);assert.equal(undone.raw,original.raw);assert.equal(fs.readFileSync(undone.paths.draft,'utf8'),original.raw);await shot(a,'exact-undo-after-arrange');
 // Delay the maintained flush handoff, then load a real concurrent owned save.
 await a.evaluate(()=>{window.arrangeOriginalFlush=studyOutputConnection.flush;studyOutputConnection.flush=async()=>{await window.arrangeOriginalFlush();window.arrangeAtGuard=true;await new Promise(r=>window.arrangeRelease=r);};window.arrangeOutcome=workspaceNavigation.changeMode('arrange').then(()=>({ok:true}),e=>({error:e.message}));});await a.waitForFunction(()=>window.arrangeAtGuard);
 const concurrent=await withActor(actor,()=>drafts.save({bindingId:undone.binding.id,parentStudyId:undone.binding.parentStudyId,expected:undone.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Concurrent invented addition is retained.'}]}));
 await a.evaluate(()=>studyDraft.refreshSaved());await a.waitForFunction(hash=>studyDraft.currentProof()?.draftHash===hash,concurrent.expected.workflow.draft);await a.evaluate(()=>window.arrangeRelease());const refused=await a.evaluate(()=>window.arrangeOutcome);assert.match(refused.error,/owner or revision changed/);assert.equal((await snapshot(a)).stage,5);assert.equal((await read(copies[0])).raw,concurrent.raw);await a.evaluate(()=>{studyOutputConnection.flush=window.arrangeOriginalFlush;});await shot(a,'concurrent-navigation-refused');
 const unrelated=await pageFor(copies[1]);assert.equal((await snapshot(unrelated)).binding.id,copies[1].binding.id);assert.equal((await read(copies[1])).raw,otherBefore.raw);await unrelated.close();
 const carouselAfter=(await api('/api/study/outputs?'+new URLSearchParams({...group,selectedOutputId:carousel.output.id})));assert.equal(JSON.stringify(carouselAfter.output),carouselBefore);assert.deepEqual(hashes(fixture.vault),originalsBefore);
 const report={requirements:['C02','C04','C05','S05','S09'],connected:{before:connected,after:arranged},savedCopy:{bindingId:copies[0].binding.id,arranged:copyArranged,undoBefore:original.expected.workflow.draft,undoAfter:undone.expected.workflow.draft},dirtyRefused:true,concurrentRefusal:refused,unrelatedUnchanged:true,carouselUnchanged:{outputId:carousel.output.id,wordsHash:carouselHash},outputsBefore:beforeOutputs,outputsAfter:(await outputs()).outputs.map(o=>o.id),originalsUnchanged:originalsBefore,errors};fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);console.log('PASS native Connect → Write → Arrange, exact save/Undo, dirty/concurrent refusals, original/sibling/subject preservation');
}catch(error){for(const [i,page] of context.pages().entries()){try{await shot(page,'failure-'+i);fs.writeFileSync(path.join(dir,'failure-'+i+'.txt'),await page.locator('body').innerText());}catch{}}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}
