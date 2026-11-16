// Invented-only real HTTP/native owner proof; also a temporary browser fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {installFixtureOverlay} from '../fixture-overlay.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';
const root=path.resolve(import.meta.dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const close=server=>new Promise((resolve,reject)=>{server.closeAllConnections?.();server.close(error=>error?reject(error):resolve());});
function inventory(roots){return Object.fromEntries(roots.flatMap(base=>fs.readdirSync(base,{recursive:true,withFileTypes:true}).map(entry=>{const file=path.join(entry.parentPath,entry.name),stat=fs.lstatSync(file);if(!stat.isFile())return null;return [file,{sha256:sha(fs.readFileSync(file)),bytes:stat.size,mtimeMs:stat.mtimeMs,ino:stat.ino}];}).filter(Boolean)).sort(([a],[b])=>a.localeCompare(b)));}
export function checkPhotoFixture(receiptFile){const receipt=JSON.parse(fs.readFileSync(receiptFile)),before=JSON.parse(fs.readFileSync(receipt.baselineFile)),after=inventory(receipt.protectedRoots),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(file=>JSON.stringify(before[file])!==JSON.stringify(after[file]));const requests=fs.existsSync(receipt.requestLog)?fs.readFileSync(receipt.requestLog,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)).slice(receipt.baselineRequestCount):[],unsafeRequests=requests.filter(row=>!['GET','HEAD'].includes(row.method)||new URL(row.url,'http://localhost').pathname==='/api/sources/blob');return {unchanged:changed.length===0,checkedFiles:Object.keys(after).length,changed,requestCount:requests.length,noMutationsOrLegacyBlobRequests:unsafeRequests.length===0,unsafeRequests};}
export async function createPhotoHTTPFixture(){
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-create-synthetic-photo-proof-'))),dataDir=path.join(home,'owned'),vault=path.join(home,'invented-originals'),files=path.join(home,'invented-files');for(const dir of [dataDir,vault,files])fs.mkdirSync(dir);
 const originalRelative='Workflow/3-Develop/DEV - Invented Valley.md',originalRaw='---\ntitle: Invented Valley\n---\n\nAn invented valley wakes beside a quiet river. These are synthetic verification words.\n\nA second invented paragraph preserves independent saved writing.\n';fs.mkdirSync(path.dirname(path.join(vault,originalRelative)),{recursive:true});fs.writeFileSync(path.join(vault,originalRelative),originalRaw);
 const fixturesDir=path.join(home,'invented-ui-fixtures');fs.mkdirSync(fixturesDir);
 const control=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-create-synthetic-photo-controls-'))),receiptFile=path.join(control,'receipt.json'),baselineFile=path.join(control,'baseline.json'),requestLog=path.join(control,'requests.ndjson'),calls=[];
 const options={dataDir,publicDir:path.join(root,'runtime/public'),studyOriginalRoots:{vaultRoot:vault,filesRoot:files,catalog:{projects:{'invented-photo-review-parent':{title:'Invented Valley',docs:[],relatedProjects:[]}},drafts:{'invented-photo-article':{parentStudyKey:'invented-photo-review-parent',partKey:'1',title:'Invented Valley',path:originalRelative,contextScope:'Invented HTTP fixture only.',support:[]}}}},connections:[],connectionsEditable:false,magazineRoots:[],sharedArticles:true,researchEnabled:false,transcriptionRuntime:null,packageView:{syntheticFixtures:false}};
 let owner,ownerPort,review,reviewPort;
 const startOwner=async()=>{owner=await createServer(options);ownerPort=await listen(owner);installFixtureOverlay(owner,{fixturesDir,port:ownerPort});owner.on('request',req=>{const entry={at:new Date().toISOString(),method:req.method,url:req.url};calls.push(entry);fs.appendFileSync(requestLog,JSON.stringify(entry)+'\n');});};
 const http=async(route,input,{reviewRequest=false}={})=>{const base=`http://127.0.0.1:${reviewRequest?reviewPort:ownerPort}`,response=await fetch(base+route,{method:input===undefined?'GET':'POST',headers:input===undefined?{}:{'content-type':'application/json','x-ar-actor':'agent:codex','x-ar-client':'http',origin:base},body:input===undefined?undefined:JSON.stringify(input)}),body=await response.json();if(!response.ok)throw Object.assign(Error(body.error||'Fixture HTTP request failed'),{status:response.status,body});return body;};
 const startReview=async()=>{const configured=await createExistingWorkReview({config:{authorityURL:`http://127.0.0.1:${ownerPort}`,allowedAuthorityPort:ownerPort,magazineRoots:[],filesRoot:files,seedProjects:[],projectLinks:{}}});review=configured.server;reviewPort=await listen(review);};
 try{
  await startOwner();
  const parentStudyId='invented-photo-review-parent',created=await http('/api/study-draft/create-collection',{parentStudyId,title:'Invented Valley article and photographs',operationId:randomUUID()});
  // The maintained overlay provides only invented initial project metadata.
  // No manuscript is copied into browser bootstrap; openBinding reads its owner.
  const seed={id:parentStudyId,name:'Invented Valley article and photographs',title:'Invented Valley',collectionKind:'collection-root',collectionBindingId:created.binding.id,step:'Material',status:'Invented verification fixture',view:'record',viewedStage:6,blocks:[],slides:[],history:[],rev:0,note:null,scroll:0};
  fs.writeFileSync(path.join(fixturesDir,'synthetic-study-data.js'),"const PORCELAIN_HTML='';const HK_LINEUP={slides:[],caption:'',changes:''};const WORKFLOW_RECORDS={};const AR_CREATE_SYNTHETIC_PROJECTS="+JSON.stringify([seed])+';');
  const saved=await http('/api/study-draft/open',{parentStudyId,originalId:'invented-photo-article',originalHash:sha(originalRaw),operationId:randomUUID()}),bindingId=saved.binding.id;
  const physical=await http('/api/study/photos/select',{bindingId,parentStudyId,operationId:randomUUID()}),scope={rootBindingId:bindingId,parentStudyId};
  const createOutput=async kind=>{const current=await http('/api/study-draft/read?'+new URLSearchParams({bindingId,parentStudyId})),group=await http('/api/study/outputs?'+new URLSearchParams(scope));return http('/api/study/outputs/create',{...scope,kind,sourceBindingId:bindingId,expectedNative:current.expected,expectedOutput:group.expectedOutput,operationId:randomUUID()});};
  const article=await createOutput('article'),sibling=await createOutput('carousel');
  const empty=await http('/api/study/photos?'+new URLSearchParams({projectId:physical.projectId,documentId:physical.documentId})),added=await http('/api/study/photos/add',{projectId:physical.projectId,documentId:physical.documentId,expectedRevision:empty.revision,name:'invented-valley.png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='}),sourceId=added.photos[0].sourceId;
  const photos=await http('/api/study/photos/update',{projectId:physical.projectId,documentId:physical.documentId,expectedRevision:added.revision,sourceId,selected:true,caption:'Invented valley at dawn · exact 原话 caption',credit:'Synthetic photographer · exact retained credit'});
  await startReview();const catalog=await http('/api/review/catalog',undefined,{reviewRequest:true}),target=catalog.workspaceLinks.pieces.flatMap(row=>row.targets).find(t=>t.rootBindingId===bindingId&&t.role==='root-owned-workspace');if(!target)throw Error('The actual native review catalog did not resolve the existing root workspace.');
  const absentInspect='/api/study/photos/inspect?'+new URLSearchParams({projectId:created.photoBinding.projectId,documentId:created.photoBinding.documentId,bindingId:created.binding.id,parentStudyId}),inspectInput={projectId:physical.projectId,documentId:physical.documentId,bindingId,parentStudyId},lookup='/api/first-flow/binding?'+new URLSearchParams({projectKey:'owned-draft:'+bindingId}),inspect='/api/study/photos/inspect?'+new URLSearchParams(inspectInput),nativeRead='/api/study-draft/read?'+new URLSearchParams({bindingId,parentStudyId});
  // Warm normal bootstrap readers before freezing; no fixture setup writes occur later.
  await http(lookup,undefined,{reviewRequest:true});await http(inspect,undefined,{reviewRequest:true});await http(nativeRead,undefined,{reviewRequest:true});
  const url=`http://127.0.0.1:${reviewPort}/document-study/index.html?`+new URLSearchParams({reviewWorkspace:target.workspaceId,reviewBinding:bindingId,reviewStage:'8'}),protectedRoots=[dataDir,vault,files,fixturesDir];
  let receipt={schema:'ar-create.synthetic-photo-http-proof.v1',synthetic:true,pid:process.pid,sourceRevision:process.env.AR_CREATE_PROOF_SOURCE_REVISION||null,sourceHashes:Object.fromEntries(['runtime/services/study-photos.mjs','runtime/commands.mjs','runtime/server.mjs','scripts/review-connection.mjs','public/document-study/folder-browser.js','public/document-study/photos-stage.js','public/document-study/study-photos.js','public/document-study/media-usage.js','public/document-study/output-connection.js'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),home,dataDir,fixturesDir,control,receiptFile,baselineFile,requestLog,protectedRoots,ownerURL:`http://127.0.0.1:${ownerPort}`,reviewURL:`http://127.0.0.1:${reviewPort}`,url,inspect,absentInspect,lookup,nativeRead,inspectInput,workspaceId:target.workspaceId,bindingId,parentStudyId,physical,sourceId,articleOutputId:article.view.output.id,siblingOutputId:sibling.view.output.id,expectedDraftHash:saved.expected.workflow.draft,caption:photos.photos[0].caption,credit:photos.photos[0].credit};
  let servedScripts=new Map();
  const checkUIBoot=async()=>{
   const base=`http://127.0.0.1:${reviewPort}`,entry=await fetch(base+'/document-study/index.html');if(!entry.ok)throw Error('The real review entry HTML is unavailable.');const html=await entry.text(),sources=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>new URL(m[1],base+'/document-study/index.html'));
   if(!html.includes('id="app"')||sources.length<20)throw Error('The maintained native app entry scripts are incomplete.');
   const scripts=new Map();for(const source of sources){if(source.origin!==base)throw Error('Synthetic boot may not load external scripts.');const response=await fetch(source);if(!response.ok)throw Error('Required native UI script unavailable: '+source.pathname+' ('+response.status+').');scripts.set(source.href,Buffer.from(await response.arrayBuffer()));}
   const script=name=>scripts.get(new URL('/document-study/'+name,base).href);
   const context={window:{}};vm.createContext(context);vm.runInContext(script('package-config.js').toString('utf8'),context);vm.runInContext(script('synthetic-study-data.js').toString('utf8'),context);const projects=vm.runInContext('AR_CREATE_SYNTHETIC_PROJECTS',context);
   if(!Array.isArray(projects)||projects[0]?.id!==parentStudyId||projects[0].collectionBindingId!==created.binding.id||projects[0].blocks.length!==0)throw Error('The served bootstrap does not contain its exact invented parent metadata.');
   if(!script('study.js')||!script('draft-flow.js')||!script('photos-stage.js'))throw Error('The actual native application modules are missing.');
   servedScripts=scripts;
   return {scriptCount:scripts.size,parentStudyId:projects[0].id,emptyBootstrapBlocks:true};
  };
  const checkDOMBoot=async()=>{
   let dom,w;const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM,VirtualConsole,ResourceLoader}=require('jsdom'),errors=[],console=new VirtualConsole();console.on('jsdomError',e=>{if(!/Could not parse CSS stylesheet|Not implemented: window/.test(e.message))errors.push(e.message+' '+(e.detail?.stack||''));});
   const pending=new Set(),controllers=new Set(),observers=new Set();let activity=0,closed=false,pagehides=0,requestsAfterClose=0;
   const track=promise=>{activity++;pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;};
   const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
   // A header response is not idle: callers still consume JSON and run their
   // own continuations. Require a quiet period across task/microtask turns.
   const drain=async()=>{const end=Date.now()+10000;let quiet=0,previous=activity;while(Date.now()<end){await tick();if(!pending.size&&!activeResources&&!resourceQueue.length&&previous===activity){if(++quiet===4)return;}else quiet=0;previous=activity;}throw Error('Native fixture teardown did not drain: '+pending.size+' HTTP/body operations, '+activeResources+' resources, '+resourceQueue.length+' queued.');};
   // jsdom starts every script resource in parallel; use the browser's bounded
   // per-origin loading instead of opening dozens of simultaneous test sockets.
   let activeResources=0;const resourceQueue=[];
   class BrowserResources extends ResourceLoader{
    fetch(url,options){
     if(!options.element)return super.fetch(url,options);
     // Exercise the exact scripts received from this origin above without a
     // second burst of static HTTP requests. Owner reads still use real HTTP.
     if(options.element.localName==='script'&&servedScripts.has(url)){
      const response=Promise.resolve(servedScripts.get(url));
      response.abort=()=>{};
      return response;
     }
     let request,cancelled=false;
     const response=new Promise((resolve,reject)=>{
      const start=()=>{if(cancelled){const error=Error('Fixture resource cancelled');error.isAbortError=true;reject(error);return;}activeResources++;
       request=super.fetch(url,options);const finish=()=>{activeResources--;resourceQueue.shift()?.();};request.then(value=>{finish();resolve(value);},error=>{finish();reject(error);});};
      if(activeResources<6)start();else resourceQueue.push(start);
     });
     response.abort=()=>{cancelled=true;request?.abort();};return response;
    }
   }

   const origin=`http://127.0.0.1:${reviewPort}`;let proof,probe,probeFinished=false;
   try{
    dom=await JSDOM.fromURL(receipt.url,{resources:new BrowserResources(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){w=window;const Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.add(this);}};w.addEventListener('pagehide',()=>pagehides++);w.fetch=(url,opts)=>{
     if(closed){requestsAfterClose++;return Promise.reject(Error('HTTP requested after fixture close.'));}
     const controller=new AbortController();controllers.add(controller);
     const signal=opts?.signal?AbortSignal.any([opts.signal,controller.signal]):controller.signal;
     return track((async()=>{
      const response=await fetch(new URL(url,origin),{...opts,signal,headers:{...opts?.headers,Origin:origin}});
      for(const method of ['json','text','arrayBuffer','blob','formData']){const consume=response[method].bind(response);response[method]=(...args)=>track(consume(...args));}
      return response;
     })());
    };w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.CSS={escape:s=>s};w.crypto.randomUUID=randomUUID;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLElement.prototype.scrollIntoView=function(){};}});
    // Load the full maintained module graph under bounded shared-host contention.
    const end=Date.now()+30000;while(Date.now()<end){if(w.document.readyState==='complete'&&w.studyDraft?.currentBinding?.()?.id===bindingId&&w.document.querySelector('[data-caption]')?.value===receipt.caption&&w.eval('current().viewedStage')===8)break;if(errors.length)throw Error('Native DOM boot failed: '+errors.join('; '));await tick();}
    const opening=w.document.querySelector('[data-review-startup]');
    const diagnostic=JSON.stringify({openingStep:opening?.dataset.reviewOpeningStep,failureStage:opening?.dataset.reviewFailureStage,failureReason:opening?.dataset.reviewFailureReason,pendingHTTP:pending.size,activeResources,queuedResources:resourceQueue.length});
    assert.equal(w.document.readyState,'complete','All maintained modules finish loading. '+diagnostic);
    assert.equal(w.studyDraft?.currentBinding?.()?.id,bindingId,'The exact saved part is open. '+diagnostic);
    assert.equal(w.eval('current().viewedStage'),8,'The saved Media stage is open. '+diagnostic);
    assert.equal(w.document.querySelector('[data-caption]')?.value,receipt.caption,'The exact saved photo details are mounted. '+diagnostic);
    assert.deepEqual(errors,[],'Native DOM boot errors.');
    proof={mounted:true,stage:8,bindingId,caption:w.document.querySelector('[data-caption]').value};
    // Begin an actual owner read immediately before pagehide. Its body and
    // downstream callback must complete while the document still exists.
    probe=track(w.fetch(receipt.inspect).then(response=>response.json()).then(value=>{assert.equal(value.bindingId,bindingId);assert.ok(w.document.querySelectorAll);assert.equal(closed,false);probeFinished=true;}));
   }finally{
    try{
     if(w){w.dispatchEvent(new w.Event('pagehide'));await drain();if(probe)await probe;assert.equal(pagehides,1);assert.equal(pending.size,0);assert.equal(activeResources,0);assert.equal(resourceQueue.length,0);assert.deepEqual(errors,[],'Native errors through pagehide and drained callbacks.');}
    }finally{
     // On a failed boot/drain, cancel real transport instead of leaving
     // unresolved reads or a JSDOM window behind.
     for(const controller of controllers)controller.abort();
     // JSDOM close removes the document and queues mutation delivery to
     // observers that have no pagehide hook. Dispose those native observers
     // only after the real pagehide handlers and HTTP continuations finish.
     for(const observer of observers)observer.disconnect();observers.clear();
     closed=true;w?.close();
    }
   }
   await tick();assert.equal(requestsAfterClose,0);assert.equal(observers.size,0);assert.deepEqual(errors,[],'Native errors after window close.');assert.equal(probeFinished,true);
   return {...proof,scriptErrors:[...errors],cleanup:{pagehides,pendingHTTP:pending.size,pendingResources:activeResources,queuedResources:resourceQueue.length,bodyCallbackBeforeClose:probeFinished,requestsAfterClose}};
  };
  receipt.uiBoot=await checkUIBoot();receipt.nativeDOMBoot=await checkDOMBoot();
  const freeze=()=>{receipt={...receipt,baselineRequestCount:calls.length,baselineAt:new Date().toISOString()};fs.writeFileSync(baselineFile,JSON.stringify(inventory(protectedRoots),null,2));fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2));};freeze();
  return {get receipt(){return receipt;},calls,http,freeze,checkUIBoot,checkDOMBoot,check:()=>checkPhotoFixture(receiptFile),async restart(){await close(review);await close(owner);await startOwner();await startReview();receipt={...receipt,ownerURL:`http://127.0.0.1:${ownerPort}`,reviewURL:`http://127.0.0.1:${reviewPort}`,url:`http://127.0.0.1:${reviewPort}/document-study/index.html?`+new URLSearchParams({reviewWorkspace:target.workspaceId,reviewBinding:bindingId,reviewStage:'8'})};await http('/api/review/catalog',undefined,{reviewRequest:true});freeze();},async stop(){await close(review);await close(owner);},async remove(){fs.rmSync(home,{recursive:true,force:true});fs.rmSync(control,{recursive:true,force:true});}};
 }catch(error){if(review?.listening)await close(review);if(owner?.listening)await close(owner);fs.rmSync(home,{recursive:true,force:true});fs.rmSync(control,{recursive:true,force:true});throw error;}
}
const command=process.argv[2];
if(command==='--check'){console.log(JSON.stringify(checkPhotoFixture(process.argv[3]),null,2));}
else if(command==='--serve'){
 const fixture=await createPhotoHTTPFixture();console.log(JSON.stringify(fixture.receipt,null,2));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>fixture.stop().then(()=>process.exit(0)));
}else test('real native HTTP photo inspect and exact persisted lookup do not write, and restart preserves identities',async t=>{
 const f=await createPhotoHTTPFixture();t.after(async()=>{await f.stop();await f.remove();});
 for(let boot=0;boot<2;boot++){
  const r=f.receipt;assert.equal((await f.checkUIBoot()).parentStudyId,r.parentStudyId);const nativeBoot=await f.checkDOMBoot();assert.equal(nativeBoot.mounted,true);assert.deepEqual(nativeBoot.cleanup,{pagehides:1,pendingHTTP:0,pendingResources:0,queuedResources:0,bodyCallbackBeforeClose:true,requestsAfterClose:0});const before=JSON.parse(fs.readFileSync(r.baselineFile)),lookup=await f.http(r.lookup,undefined,{reviewRequest:true}),native=await f.http(r.nativeRead,undefined,{reviewRequest:true}),photos=await f.http(r.inspect,undefined,{reviewRequest:true});
  assert.equal(lookup.projectKey,'owned-draft:'+r.bindingId);assert.equal(lookup.projectId,r.physical.projectId);assert.equal(lookup.documentId,r.physical.documentId);assert.equal(native.binding.id,r.bindingId);assert.equal(native.binding.parentStudyId,r.parentStudyId);assert.equal(native.expected.workflow.draft,r.expectedDraftHash);assert.equal(photos.projectId,r.physical.projectId);assert.equal(photos.documentId,r.physical.documentId);assert.equal(photos.bindingId,r.bindingId);assert.equal(photos.parentStudyId,r.parentStudyId);assert.equal(photos.photos[0].sourceId,r.sourceId);assert.equal(photos.photos[0].caption,r.caption);assert.equal(photos.photos[0].credit,r.credit);assert.equal(photos.photos[0].previewUnavailable,false);const preview=new URL(photos.photos[0].url,r.reviewURL);assert.equal(preview.pathname,'/api/study/photos/preview');assert.equal(preview.searchParams.get('sourceId'),r.sourceId);assert.equal(preview.searchParams.get('bindingId'),r.bindingId);assert.equal(preview.searchParams.get('expectedHash'),photos.photos[0].sha256);
  const absent=await f.http(r.absentInspect,undefined,{reviewRequest:true});assert.equal(absent.state,'not-created');assert.equal(absent.photos.length,0);
  assert.deepEqual(inventory(r.protectedRoots),before);assert.deepEqual(f.check().changed,[]);assert.equal(f.check().noMutationsOrLegacyBlobRequests,true,JSON.stringify(f.check().unsafeRequests));
  await assert.rejects(f.http('/api/study/photos/inspect?'+new URLSearchParams({...r.inspectInput,bindingId:randomUUID()}),undefined,{reviewRequest:true}),error=>error.status===409);
  await assert.rejects(f.http('/api/study/photos/inspect?'+new URLSearchParams({...r.inspectInput,parentStudyId:'wrong-invented-parent'}),undefined,{reviewRequest:true}),error=>error.status===409);
  await assert.rejects(f.http('/api/study/photos/inspect?'+new URLSearchParams({...r.inspectInput,documentId:randomUUID()}),undefined,{reviewRequest:true}),error=>error.status===403);
  assert.equal(f.check().unchanged,true);if(!boot)await f.restart();
 }
});
