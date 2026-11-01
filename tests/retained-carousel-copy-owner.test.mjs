import {chromeSkip} from './helpers/headless-chrome.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../runtime/store.mjs';
import {createStudyBindings} from '../runtime/services/study-bindings.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createStudyOwnedPhotoBindings} from '../runtime/services/study-owned-photo-bindings.mjs';
import {createLibrary} from '../runtime/services/library.mjs';
import {createNativeOutputFactory} from '../runtime/services/native-output-factory.mjs';
import {createRetainedCarouselReader} from '../runtime/services/review-retained-carousels.mjs';
import {digest} from '../runtime/services/files.mjs';
import {createNativeOutputExports} from '../runtime/services/native-output-exports.mjs';
import http from 'node:http';
import {once} from 'node:events';
async function fixture(t,{readOnly=false}={}){
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retained-copy-owner-'))),dataDir=path.join(home,'owned'),vault=path.join(home,'vault'),files=path.join(home,'files'),relative='Workflow/3-Develop/DEV - Destination.md',sourceRelative='Workflow/1-Source/SRC - Context.md';fs.mkdirSync(path.dirname(path.join(vault,relative)),{recursive:true});fs.mkdirSync(path.dirname(path.join(vault,sourceRelative)),{recursive:true});fs.mkdirSync(files);
 fs.writeFileSync(path.join(vault,relative),'---\ntype: DEV\ntitle: Destination native\n---\n\nDestination manuscript wording.\n');fs.writeFileSync(path.join(vault,sourceRelative),'Destination context.');
 const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{destination:{title:'Destination',docs:[[sourceRelative,'source']],relatedProjects:[]}},drafts:{draft:{parentStudyKey:'destination',partKey:'1',title:'Destination native',path:relative,contextScope:'Synthetic',support:[[sourceRelative,'source']]}}}});
 let store=await createStore({dataDir,sharedArticles:true});t.after(async()=>{await store.close();fs.rmSync(home,{recursive:true,force:true});});
 const native=createStudyDraftCopies({dataDir,originals}),root=await native.openCopy({originalId:'draft',originalHash:digest(fs.readFileSync(path.join(vault,relative))),parentStudyId:'destination',operationId:randomUUID()}),bindings=createStudyBindings({dataDir,store});await bindings.select({projectKey:'destination',title:'Destination',operationId:randomUUID()});
 let ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings}),physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'destination',operationId:randomUUID()}),library=createLibrary({dataDir,legacyState:()=>({project:{sources:[]}})});
 const original={id:randomUUID(),kind:'carousel',title:'Original title',caption:'Exact caption\nwith a second line.',stage:'look',wordsReview:{hash:'a'.repeat(64),reviewedAt:'2026-10-11T00:00:00Z'},outputRevision:7,createdAt:'2026-10-11T00:00:00Z',slides:Array.from({length:13},(_,i)=>({id:randomUUID(),role:i?'inner':'cover',text:'Exact original '+i+'\nsecond line',credit:'Credit '+i,label:'Label '+i,template:i?'M12':'H6',photos:[],paragraphIds:[randomUUID()],typography:{font:'original',scale:1,fit:'auto'},pillar:'佳'}))};
 const state={revision:5,project:{id:randomUUID(),document:{schema:'ar-create.document.v1',id:randomUUID(),revision:4,outputs:[original]}}},sourceFile=path.join(home,'original.json'),writeSource=()=>fs.writeFileSync(sourceFile,JSON.stringify(state));writeSource();
 if(readOnly){state.project.document.outputs.push({...structuredClone(original),id:randomUUID(),title:'Separate eligible original'});writeSource();}
 const retainedSource=createRetainedCarouselReader({retainedCarouselState:{path:sourceFile,projectId:state.project.id,documentId:state.project.document.id,outputIds:[readOnly?state.project.document.outputs[1].id:original.id],...(readOnly?{readOnlyOutputIds:[original.id]}:{})}}),sourceItem=(await retainedSource.list()).items.find(item=>item.outputId===original.id),source={projectId:sourceItem.projectId,documentId:sourceItem.documentId,outputId:sourceItem.outputId,sourceHash:sourceItem.sourceHash,outputHash:sourceItem.outputHash},group={rootBindingId:root.binding.id,parentStudyId:'destination'};
 let factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos,retainedSource});
 const read=selectedOutputId=>factory.owner.read({...group,...(selectedOutputId?{selectedOutputId}:{})});
 const request=async()=>({...group,destinationProjectId:physical.projectId,destinationDocumentId:physical.documentId,operationId:randomUUID(),expectedOutput:(await read()).expectedOutput,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:'destination'})).expected,source});
 const restart=async()=>{await store.close();store=await createStore({dataDir,sharedArticles:true});const nextBindings=createStudyBindings({dataDir,store});ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings:nextBindings});factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos,retainedSource});};
 return {home,dataDir,native,root,physical,group,source,sourceFile,state,original,retainedSource,writeSource,request,read,restart,library,get factory(){return factory;},get store(){return store;},get owner(){return factory.owner;}};
}
test('C01/C04/C06/S12 exact retained copy uses independent owner, preserves originals/siblings, retries and restarts',async t=>{
 const f=await fixture(t),sourceBefore=fs.readFileSync(f.sourceFile),nativeBefore=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId});
 const existing=await f.owner.create({...f.group,kind:'carousel',sourceBindingId:f.root.binding.id,operationId:randomUUID(),expectedOutput:(await f.read()).expectedOutput,expectedNative:nativeBefore.expected});
 const eight=await f.owner.save({...f.group,selectedOutputId:existing.view.output.id,operationId:randomUUID(),expectedOutput:existing.view.expectedOutput,changes:{slides:Array.from({length:8},(_,i)=>({...structuredClone(existing.view.output.slides[0]),id:randomUUID(),text:'Current eight '+i,role:i?'inner':'cover',template:i?'M12':'H6'}))}}),old=structuredClone(eight.view.output);assert.equal(old.slides.length,8);
 const body=await f.request(),created=await f.owner.copyRetainedCarousel(body),copy=created.view.output;
 assert.notEqual(copy.id,f.original.id);assert.equal(copy.id,body.operationId);assert.equal(copy.slides.length,13);assert.deepEqual(created.view.outputs.find(o=>o.id===old.id),old);assert.equal(copy.caption,f.original.caption);assert.equal(copy.stage,'words');assert.equal(copy.wordsReview,undefined);assert.deepEqual(copy.manuscript,[]);assert.deepEqual(created.view.document.paragraphs,[]);
 const origin=created.view.outputOrigins[copy.id];assert.equal(origin.wordOrigin,'retained-original-not-destination-manuscript');assert.deepEqual(origin.source,f.source);assert.equal(origin.mapping.length,13);
 for(let i=0;i<13;i++){const a=f.original.slides[i],b=copy.slides[i];assert.notEqual(a.id,b.id);assert.deepEqual({...b,id:a.id,paragraphIds:a.paragraphIds},a);assert.deepEqual(origin.mapping[i],{originalSlideId:a.id,outputSlideId:b.id,originalParagraphIds:a.paragraphIds});}
 assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBefore);assert.deepEqual((await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId})).expected,nativeBefore.expected);
 const retry=await f.owner.copyRetainedCarousel(body);assert.equal(retry.alreadySaved,true);assert.equal(retry.view.outputs.length,2);assert.equal(retry.view.output.id,copy.id);
 await f.restart();const loaded=await f.read(copy.id);assert.deepEqual(loaded.output,copy);assert.deepEqual(loaded.outputOrigins,created.view.outputOrigins);assert.equal((await f.owner.copyRetainedCarousel(body)).alreadySaved,true);
 const reviewed=await f.owner.reviewCarouselWords({...f.group,selectedOutputId:copy.id,operationId:randomUUID(),expectedOutput:loaded.expectedOutput,expectedWords:loaded.writingProof.expected,wordsHash:loaded.writingProof.wordsHash});assert.equal(reviewed.view.output.stage,'look');assert.ok(reviewed.view.output.wordsReview);
 const editedSlides=structuredClone(reviewed.view.output.slides);editedSlides[2].text='Independent new wording';const saved=await f.owner.save({...f.group,selectedOutputId:copy.id,operationId:randomUUID(),expectedOutput:reviewed.view.expectedOutput,changes:{slides:editedSlides}});assert.equal(saved.view.output.stage,'words');assert.equal(saved.view.output.wordsReview,undefined);assert.deepEqual(saved.view.outputs.find(o=>o.id===old.id),old);assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBefore);
 await assert.rejects(f.owner.assertExport({...f.group,selectedOutputId:copy.id,expectedOutput:saved.view.expectedOutput}),/own saved words/);
 const finalReview=await f.owner.reviewCarouselWords({...f.group,selectedOutputId:copy.id,operationId:randomUUID(),expectedOutput:saved.view.expectedOutput,expectedWords:saved.view.writingProof.expected,wordsHash:saved.view.writingProof.wordsHash});
 await f.owner.withExportSnapshot({...f.group,selectedOutputId:copy.id,expectedOutput:finalReview.view.expectedOutput},async({output,wordOwner,finalCheck})=>{assert.equal(output.slides[2].text,'Independent new wording');assert.equal(wordOwner.kind,'carousel-words');await finalCheck();});
});
test('foreign/stale destination, source IDs/hashes and unsupported source layouts refuse without adding outputs',async t=>{
 const f=await fixture(t),body=await f.request();
 for(const change of [{destinationProjectId:randomUUID()},{destinationDocumentId:randomUUID()},{parentStudyId:'foreign'},{rootBindingId:randomUUID()},{source:{...f.source,projectId:randomUUID()}},{source:{...f.source,documentId:randomUUID()}},{source:{...f.source,outputId:randomUUID()}},{source:{...f.source,outputHash:'0'.repeat(64)}},{source:{...f.source,sourceHash:'0'.repeat(64)}},{expectedNative:{...body.expectedNative,revision:999}},{expectedOutput:{...body.expectedOutput,hash:'0'.repeat(64)}}])await assert.rejects(f.owner.copyRetainedCarousel({...body,...change}));
 assert.equal((await f.read()).outputs.length,0);
 const freshBody=async()=>{const {projectId,documentId,outputId,sourceHash,outputHash}=(await f.retainedSource.list()).items[0];return {...await f.request(),source:{projectId,documentId,outputId,sourceHash,outputHash}};};
 f.original.branding={font:'Unregistered brand override'};f.writeSource();await assert.rejects(f.owner.copyRetainedCarousel(await freshBody()),/unsupported appearance/);delete f.original.branding;
 f.original.slides[0].template='F1';f.original.slides[0].photos=[{src:'https://external.invalid/photo.jpg',x:50,y:50}];f.writeSource();await assert.rejects(f.owner.copyRetainedCarousel(await freshBody()),/photograph correspondence/);assert.equal((await f.read()).outputs.length,0);
 f.original.slides[0].photos=[{src:'',x:50,y:50}];f.original.slides[1].photos=[{src:'',x:50,y:50},{src:'',x:50,y:50}];f.writeSource();const emptySlotCopy=await f.owner.copyRetainedCarousel(await freshBody());assert.deepEqual(emptySlotCopy.view.output.slides[0].photos,[{src:'',x:50,y:50}]);assert.deepEqual(emptySlotCopy.view.output.slides[1].photos,f.original.slides[1].photos);
});
test('source replacement during final copy validation cannot publish a partial copy',async t=>{
 const f=await fixture(t),body=await f.request(),read=f.retainedSource.read;let reads=0;
 f.retainedSource.read=async input=>{if(++reads===2){f.original.caption='Changed at publication';f.writeSource();}return read(input);};
 await assert.rejects(f.owner.copyRetainedCarousel(body),/changed or is unavailable/);assert.equal((await f.read()).outputs.length,0);
});
test('changed/missing source flags freshness, blocks copy/save/export, and exact replay never creates another copy',async t=>{
 const f=await fixture(t),body=await f.request(),result=await f.owner.copyRetainedCarousel(body),id=result.view.output.id;
 f.original.caption='Outside change';f.writeSource();let view=await f.read(id);assert.equal(view.freshness.sourceStale,true);assert.equal((await f.owner.copyRetainedCarousel(body)).alreadySaved,true);assert.equal((await f.read()).outputs.length,1);
 await assert.rejects(f.owner.copyRetainedCarousel({...await f.request(),source:f.source}));
 await assert.rejects(f.owner.save({...f.group,selectedOutputId:id,operationId:randomUUID(),expectedOutput:view.expectedOutput,changes:{caption:'Do not overwrite'}}));await assert.rejects(f.owner.assertExport({...f.group,selectedOutputId:id,expectedOutput:view.expectedOutput}));
 fs.unlinkSync(f.sourceFile);view=await f.read(id);assert.equal(view.freshness.sourceStale,true);assert.equal(view.output.caption,result.view.output.caption);
});
test('exact thirteen-slide retained copy reviews its own words and renders thirteen real 1080 by 1350 PNGs',{skip:chromeSkip},async t=>{
 const f=await fixture(t);
 // A supported words-only original: no photograph is invented to fill a slot.
 f.original.slides=f.original.slides.map(slide=>({...slide,template:'M12'}));f.writeSource();
 const {projectId,documentId,outputId,sourceHash,outputHash}=(await f.retainedSource.list()).items[0],source={projectId,documentId,outputId,sourceHash,outputHash},sourceBefore=fs.readFileSync(f.sourceFile),nativeBefore=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId});
 const first=await f.owner.create({...f.group,kind:'carousel',sourceBindingId:f.root.binding.id,operationId:randomUUID(),expectedNative:nativeBefore.expected,expectedOutput:(await f.read()).expectedOutput});
 const eight=await f.owner.save({...f.group,selectedOutputId:first.view.output.id,operationId:randomUUID(),expectedOutput:first.view.expectedOutput,changes:{slides:Array.from({length:8},(_,i)=>({...first.view.output.slides[0],id:randomUUID(),text:'Current eight preserved '+i,template:'M12',role:i?'inner':'cover'}))}}),sibling=structuredClone(eight.view.output);
 const copied=await f.owner.copyRetainedCarousel({...await f.request(),source}),id=copied.view.output.id;assert.equal(copied.view.output.wordsReview,undefined);assert.equal(copied.view.output.stage,'words');assert.notEqual(id,f.original.id);
 const reviewed=await f.owner.reviewCarouselWords({...f.group,selectedOutputId:id,operationId:randomUUID(),expectedOutput:copied.view.expectedOutput,expectedWords:copied.view.writingProof.expected,wordsHash:copied.view.writingProof.wordsHash}),view=reviewed.view;
 assert.equal(view.output.stage,'look');assert.notDeepEqual(view.output.wordsReview,f.original.wordsReview);assert.equal(view.output.wordsReview.hash,view.writingProof.wordsHash);
 const exports=createNativeOutputExports({dataDir:f.dataDir,store:f.store,outputs:f.owner,resolveScope:f.factory.scope.resolve,library:f.library});assert.equal(exports.capability().available,true,'Existing local Chrome is required; no substitute renderer can establish this proof.');
 const pages=new Map(),fonts=new Set(),servedErrors=[];
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/carousel/exports/')){
   const parts=url.pathname.split('/'),index=Number(parts[6]);assert.equal(url.searchParams.get('selectedOutputId'),id);
   const html=await exports.page({rootBindingId:url.searchParams.get('rootBindingId'),parentStudyId:url.searchParams.get('parentStudyId'),selectedOutputId:url.searchParams.get('selectedOutputId'),exportId:parts[4],index});
   assert.ok(html.includes(f.original.slides[index].text));assert.ok(html.includes(f.original.slides[index].label));assert.ok(html.includes(f.original.slides[index].credit));pages.set(index,html);res.setHeader('Content-Type','text/html');res.end(html);
  }else{
   const name=path.basename(url.pathname),runtimeFonts=['Caudex-Regular.ttf','ab68f14ec71c3016.woff2','5963fe8e750eca5b.woff2'],studyFonts=['eb-garamond-400-normal.ttf','eb-garamond-500-normal.ttf','shippori-mincho-700-normal.ttf','shippori-mincho-800-normal.ttf','noto-serif-tc-900-normal.ttf'];
   if(!runtimeFonts.includes(name)&&!studyFonts.includes(name))throw Error('Unknown synthetic export asset');
   const file=new URL((runtimeFonts.includes(name)?'../runtime/public/assets/fonts/':'../public/document-study/assets/')+name,import.meta.url);fonts.add(name);res.end(fs.readFileSync(file));
  }
 }catch(error){servedErrors.push(error.message);res.statusCode=500;res.end(error.message);}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const origin='http://127.0.0.1:'+server.address().port,destinationBefore=structuredClone(f.store.get()),result=await exports.saveCarousel({...f.group,selectedOutputId:id,expectedOutput:view.expectedOutput,outputRevision:view.output.outputRevision},origin);
 assert.deepEqual(servedErrors,[]);assert.equal(pages.size,13);assert.ok(fonts.size>0,'Real local font files must be served to the existing renderer');assert.equal(result.export.status,'complete');assert.equal(result.export.contentVerification,'existing-carousel-renderer-saved-output-snapshot');assert.deepEqual(result.export.output,view.output);
 const pngs=result.export.files.filter(file=>file.mimeType==='image/png');assert.equal(pngs.length,13);assert.equal(new Set(pngs.map(file=>file.hash)).size,13,'Different slide wording must render different image bytes');
 const evidence=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-retained-copy-png-proof-'))),images=[];
 for(const file of pngs){const opened=await exports.file({...f.group,selectedOutputId:id,exportId:result.export.id,format:'carousel',name:file.name}),bytes=fs.readFileSync(opened.file);assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1350);assert.equal(digest(bytes),file.hash);fs.copyFileSync(opened.file,path.join(evidence,file.name));images.push({name:file.name,width:1080,height:1350,sha256:file.hash});}
 assert.deepEqual(f.store.get(),destinationBefore);assert.deepEqual((await f.read(id)).output,view.output);assert.deepEqual((await f.read(sibling.id)).output,sibling);assert.equal(sibling.slides.length,8);assert.deepEqual((await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId})).expected,nativeBefore.expected);assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBefore);
 fs.writeFileSync(path.join(evidence,'proof.json'),JSON.stringify({synthetic:true,journey:'guarded retained copy → own words review → maintained real PNG exporter',source,destination:{...f.group,projectId:f.physical.projectId,documentId:f.physical.documentId,outputId:id},originalReviewNotInherited:true,siblingSlideCount:8,sourceAndNativeAndSiblingUnchanged:true,renderedTemplates:[...new Set(view.output.slides.map(slide=>slide.template))],servedFonts:[...fonts],output:view.output,images},null,2));
 fs.writeFileSync(path.join(evidence,'caption.txt'),view.output.caption+'\n');t.diagnostic('Synthetic PNG evidence: '+evidence);
});

test('read-only retained originals refuse a direct copy request before any destination mutation',async t=>{
 const f=await fixture(t,{readOnly:true}),body=await f.request(),before=await f.read(),sourceBytes=fs.readFileSync(f.sourceFile),nativeBefore=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId});
 const item=(await f.retainedSource.list()).items.find(item=>item.outputId===f.original.id);assert.equal(item.copyAllowed,false);assert.deepEqual((await f.retainedSource.read({outputId:item.outputId,expectedSourceHash:item.sourceHash,expectedOutputHash:item.outputHash})).output,f.original);
 await assert.rejects(f.owner.copyRetainedCarousel(body),/reading only/);
 const after=await f.read();assert.deepEqual(after.expectedOutput,before.expectedOutput);assert.deepEqual(after.outputs,before.outputs);assert.deepEqual((await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId})).expected,nativeBefore.expected);assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBytes);
});
