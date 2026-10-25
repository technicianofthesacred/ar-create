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
import {createNativeOutputOwner} from '../runtime/services/native-output-owner.mjs';
import {mapper,helpers} from '../runtime/services/native-output-helpers.mjs';
import {outputPrivatePrefix} from '../runtime/output-records.mjs';
import IG from '../runtime/src/donors/mag/carousel/ig-templates.js';
async function fixture(t){
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retained-copy-owner-'))),dataDir=path.join(home,'owned'),vault=path.join(home,'vault'),files=path.join(home,'files'),relative='Workflow/3-Develop/DEV - Destination.md',sourceRelative='Workflow/1-Source/SRC - Context.md';fs.mkdirSync(path.dirname(path.join(vault,relative)),{recursive:true});fs.mkdirSync(path.dirname(path.join(vault,sourceRelative)),{recursive:true});fs.mkdirSync(files);
 fs.writeFileSync(path.join(vault,relative),'---\ntype: DEV\ntitle: Destination native\n---\n\nDestination manuscript wording.\n');fs.writeFileSync(path.join(vault,sourceRelative),'Destination context.');
 const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{destination:{title:'Destination',docs:[[sourceRelative,'source']],relatedProjects:[]}},drafts:{draft:{parentStudyKey:'destination',partKey:'1',title:'Destination native',path:relative,contextScope:'Synthetic',support:[[sourceRelative,'source']]}}}});
 let store=await createStore({dataDir,sharedArticles:true});t.after(async()=>{await store.close();fs.rmSync(home,{recursive:true,force:true});});
 const native=createStudyDraftCopies({dataDir,originals}),root=await native.openCopy({originalId:'draft',originalHash:digest(fs.readFileSync(path.join(vault,relative))),parentStudyId:'destination',operationId:randomUUID()}),bindings=createStudyBindings({dataDir,store});await bindings.select({projectKey:'destination',title:'Destination',operationId:randomUUID()});
 let ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings}),physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'destination',operationId:randomUUID()}),library=createLibrary({dataDir,legacyState:()=>({project:{sources:[]}})});
 const original={id:randomUUID(),kind:'carousel',title:'Original title',caption:'Exact caption\nwith a second line.',stage:'look',wordsReview:{hash:'a'.repeat(64),reviewedAt:'2026-10-11T00:00:00Z'},outputRevision:7,createdAt:'2026-10-11T00:00:00Z',slides:Array.from({length:13},(_,i)=>({id:randomUUID(),role:i?'inner':'cover',text:'Exact original '+i+'\nsecond line',credit:'Credit '+i,label:'Label '+i,template:i?'M12':'H6',photos:[],paragraphIds:[randomUUID()],typography:{font:'original',scale:1,fit:'auto'},pillar:'佳'}))};
 const state={revision:5,project:{id:randomUUID(),document:{schema:'ar-create.document.v1',id:randomUUID(),revision:4,outputs:[original]}}},sourceFile=path.join(home,'original.json'),writeSource=()=>fs.writeFileSync(sourceFile,JSON.stringify(state));writeSource();
 const retainedSource=createRetainedCarouselReader({retainedCarouselState:{path:sourceFile,projectId:state.project.id,documentId:state.project.document.id,outputIds:[original.id]}}),sourceItem=(await retainedSource.list()).items[0],source={projectId:sourceItem.projectId,documentId:sourceItem.documentId,outputId:sourceItem.outputId,sourceHash:sourceItem.sourceHash,outputHash:sourceItem.outputHash},group={rootBindingId:root.binding.id,parentStudyId:'destination'};
 let factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos,retainedSource});
 const read=selectedOutputId=>factory.owner.read({...group,...(selectedOutputId?{selectedOutputId}:{})});
 const request=async()=>({...group,destinationProjectId:physical.projectId,destinationDocumentId:physical.documentId,operationId:randomUUID(),expectedOutput:(await read()).expectedOutput,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:'destination'})).expected,source});
 const restart=async()=>{await store.close();store=await createStore({dataDir,sharedArticles:true});const nextBindings=createStudyBindings({dataDir,store});ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings:nextBindings});factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos,retainedSource});};
 return {home,dataDir,native,root,physical,group,source,sourceFile,state,original,retainedSource,writeSource,request,read,restart,library,get factory(){return factory;},get store(){return store;},get owner(){return factory.owner;}};
}
const origin='http://127.0.0.1:59958';
function browserSnapshot(){
 const value={origin,projectId:'browser-story-synthetic',revision:11,carouselRevision:3,title:'Exact browser title',name:'Exact browser name',caption:'Browser caption\nwith exact lines.',slides:Array.from({length:8},(_,i)=>({id:'browser-slide-'+i,role:i?'inner':'cover',text:'Browser original '+i+'\nsecond line',credit:'Credit '+i,label:'Label '+i,template:i===2?'F1':'M12',photos:i===2?[{src:'',x:31,y:77}]:[],typography:{font:'serif',scale:.9,fit:'manual'},pillar:'家'}))};
 return signatures(value);
}
function signatures(value){return {...value,slideIds:value.slides.map(s=>s.id),wordsSignature:JSON.stringify([value.slides.map(s=>({id:s.id,text:s.text,credit:s.credit,label:s.label,role:s.role})),value.caption]),arrangementSignature:JSON.stringify(value.slides.map(({text,credit,label,role,...layout})=>layout))};}
async function request(f,browser=browserSnapshot()){
 const retained=await f.request();const {source,...body}=retained;return {...body,browser};
}
const copy=(f,input,options={origin})=>f.owner.copyBrowserCarousel(input,options);
test('C01/C04/C06/S09/S12 browser eight and trusted thirteen coexist, preserve originals, own words, lost replies and restart',async t=>{
 const f=await fixture(t),sourceBefore=fs.readFileSync(f.sourceFile),nativeBefore=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId}),browser=browserSnapshot(),browserBefore=structuredClone(browser);
 const thirteen=await f.owner.copyRetainedCarousel(await f.request()),retained=structuredClone(thirteen.view.output),body=await request(f,browser),saved=await copy(f,body),id=saved.view.output.id;
 assert.equal(id,body.operationId);assert.equal(saved.view.output.slides.length,8);assert.equal(saved.view.wordOwner.kind,'carousel-words');assert.equal(saved.view.output.stage,'words');assert.equal(saved.view.output.wordsReview,undefined);assert.deepEqual(saved.view.output.manuscript,[]);assert.deepEqual(saved.view.document.paragraphs,[]);assert.deepEqual(saved.view.outputs.find(o=>o.id===retained.id),retained);
 const lineage=saved.view.outputOrigins[id];assert.equal(lineage.kind,'browser-carousel-copy');assert.equal(lineage.wordOrigin,'browser-snapshot-not-destination-manuscript');assert.equal(lineage.sourceLiveVerification,false);assert.equal(lineage.source.wordsSignature,browser.wordsSignature);assert.equal(lineage.source.arrangementSignature,browser.arrangementSignature);assert.deepEqual(lineage.source.slideIds,browser.slideIds);
 for(let index=0;index<8;index++){
  const source=browser.slides[index],dest=saved.view.output.slides[index];assert.notEqual(source.id,dest.id);assert.match(dest.id,/^[a-f0-9-]{36}$/);assert.deepEqual({...dest,id:source.id,paragraphIds:undefined},{...source,paragraphIds:undefined});assert.deepEqual(lineage.mapping[index],{originalSlideId:source.id,outputSlideId:dest.id,originalParagraphIds:[]});
 }
 const sourceSlide=browser.slides[2],destSlide=saved.view.output.slides[2];assert.deepEqual(destSlide.photos,[{src:'',x:31,y:77}]);assert.equal(IG.render('F1',sourceSlide,{}),IG.render('F1',destSlide,{}),'Maintained renderer preserves empty slot, text, label, crop and typography');
 assert.deepEqual(browser,browserBefore);assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBefore);assert.deepEqual((await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId})).expected,nativeBefore.expected);
 assert.equal((await copy(f,body)).alreadySaved,true);assert.equal((await f.read()).outputs.length,2);
 await f.restart();assert.deepEqual((await f.read(id)).output,saved.view.output);assert.deepEqual((await f.read(id)).outputOrigins,saved.view.outputOrigins);assert.equal((await copy(f,body)).alreadySaved,true);
 let view=await f.read(id);await assert.rejects(f.owner.assertExport({...f.group,selectedOutputId:id,expectedOutput:view.expectedOutput}),/own saved words/);
 const review=await f.owner.reviewCarouselWords({...f.group,selectedOutputId:id,expectedOutput:view.expectedOutput,expectedWords:view.writingProof.expected,wordsHash:view.writingProof.wordsHash,operationId:randomUUID()});assert.equal(review.view.output.stage,'look');
 const slides=structuredClone(review.view.output.slides);slides[4].text='Independent browser output edit';const edit=await f.owner.save({...f.group,selectedOutputId:id,expectedOutput:review.view.expectedOutput,operationId:randomUUID(),changes:{slides}});assert.equal(edit.view.output.stage,'words');assert.equal(edit.view.output.wordsReview,undefined);assert.deepEqual(edit.view.outputs.find(o=>o.id===retained.id),retained);assert.deepEqual(browser,browserBefore);assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBefore);
 await f.restart();view=await f.read(id);assert.equal(view.output.slides[4].text,slides[4].text);assert.equal(view.freshness.stale,false);assert.deepEqual(view.document.paragraphs,[]);
});
test('browser snapshot guards reject wrong origin, altered signatures, unsupported appearance, stale native/output/destination without partial copies',async t=>{
 const f=await fixture(t),body=await request(f);
 for(const changed of [{destinationProjectId:randomUUID()},{destinationDocumentId:randomUUID()},{parentStudyId:'foreign'},{rootBindingId:randomUUID()},{expectedNative:{...body.expectedNative,revision:999}},{expectedOutput:{...body.expectedOutput,hash:'0'.repeat(64)}},{path:'/outside'}])await assert.rejects(copy(f,{...body,...changed}));
 for(const changed of [{origin:'http://127.0.0.1:59959'},{origin:'https://external.invalid'},{wordsSignature:'stale'},{arrangementSignature:'stale'},{slideIds:[...body.browser.slideIds].reverse()},{revision:-1},{projectId:''},{padding:'unrecognized'},{name:'x'.repeat(257)},{caption:'x'.repeat(130000)}])await assert.rejects(copy(f,{...body,browser:{...body.browser,...changed}}));
 await assert.rejects(copy(f,body,{}));await assert.rejects(copy(f,body,{origin:'https://external.invalid'}));
 const unsupported=[s=>{s.slides[0].template='unknown';},s=>{s.slides[0].role='unknown';},s=>{s.slides[0].branding='unknown';},s=>{s.slides[0].typography.font='unknown';},s=>{s.slides[0].photos=[{src:'https://external.invalid/picture.jpg',x:50,y:50}];s.slides[0].template='F1';},s=>{s.slides[2].photos[0].src='data:image/png;base64,AAAA';},s=>{s.slides[2].photos[0].nativePath='/outside';},s=>{s.slides[2].photos[0].x=101;},s=>{s.slides[2].photos[0].src='/api/sources/blob?id='+randomUUID();},s=>{s.slides[0].paragraphIds=[{path:'/outside'}];}];
 for(const change of unsupported){const snapshot=browserSnapshot();change(snapshot);await assert.rejects(copy(f,{...body,browser:signatures(snapshot)}));}
 assert.equal((await f.read()).outputs.length,0);
 const created=await copy(f,body);await assert.rejects(copy(f,{...body,browser:signatures({...body.browser,caption:'Different request'})}),/another exact/);assert.equal((await f.read()).outputs.length,1);assert.deepEqual((await f.read(created.view.output.id)).output,created.view.output);
});
test('only configured exact loopback source origins may cross a trusted proxy origin',async t=>{
 const f=await fixture(t),body=await request(f),proxyOrigin='http://127.0.0.1:8841';
 await assert.rejects(copy(f,body,{origin:proxyOrigin}),/origin/);
 const owner=createNativeOutputOwner({dataDir:f.dataDir,store:f.store,native:f.native,mapper,helpers,scope:f.factory.scope,proof:f.factory.proof,retainedSource:f.retainedSource,browserOrigins:[origin]});
 const created=await owner.copyBrowserCarousel(body,{origin:proxyOrigin});assert.equal(created.view.outputOrigins[body.operationId].source.origin,origin);
 assert.throws(()=>createNativeOutputOwner({dataDir:f.dataDir,store:f.store,native:f.native,mapper,helpers,scope:f.factory.scope,proof:f.factory.proof,browserOrigins:['https://external.invalid']}),/explicit local/);
});
test('every browser capture reopen verifies private bytes and its captured source, mapping and source signatures',async t=>{
 const f=await fixture(t),body=await request(f),created=await copy(f,body),id=created.view.output.id;
 const document=(await f.store.readArticle({projectId:f.physical.projectId})).document,record=document.nativeOutputIndex.records.find(r=>r.outputId===id),captureFile=path.join(f.dataDir,outputPrivatePrefix(f.physical.projectId,f.physical.documentId),'captures',record.captureId+'.json'),before=fs.readFileSync(captureFile);
 const capture=JSON.parse(before);capture.capture.original.slides[0].text='Tampered browser source';fs.writeFileSync(captureFile,JSON.stringify(capture));await assert.rejects(f.read(id),/integrity/);fs.writeFileSync(captureFile,before);
 const nativeBefore=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId});
 // The browser provenance is static. Removing or changing the unrelated trusted
 // retained original does not pretend to verify or invalidate this snapshot.
 fs.unlinkSync(f.sourceFile);const reread=await f.read(id);assert.equal(reread.freshness.stale,false);assert.equal(reread.outputOrigins[id].sourceLiveVerification,false);assert.deepEqual((await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId})).expected,nativeBefore.expected);
});
test('saved wording Undo restores exact text/credit/label/role/caption, preserves layout and media, survives lost reply/restart',async t=>{
 const f=await fixture(t),body=await request(f),created=await copy(f,body),id=created.view.output.id,before=structuredClone(created.view.output),beforeFile=await f.store.readCarouselWords({projectId:f.physical.projectId,documentId:f.physical.documentId,outputId:id}),slides=structuredClone(before.slides);
 slides[0].text='New first wording';slides[0].credit='New credit';delete slides[0].label;slides[0].role='inner';slides[2].photos[0].x=61;slides[2].typography={font:'sans',scale:1.1,fit:'auto'};
 const saveId=randomUUID(),saved=await f.owner.save({...f.group,selectedOutputId:id,expectedOutput:created.view.expectedOutput,operationId:saveId,changes:{slides,caption:'Changed caption'}});assert.deepEqual(saved.view.wordsUndo,{operationId:saveId});assert.deepEqual(saved.view.arrangementUndo,{operationId:saveId});
 const undo={...f.group,selectedOutputId:id,expectedOutput:saved.view.expectedOutput,operationId:randomUUID(),undoOperationId:saveId};
 await f.restart();assert.deepEqual((await f.read(id)).wordsUndo,{operationId:saveId});
 const restored=await f.owner.undoCarouselWords(undo);assert.equal(restored.view.output.stage,'words');assert.equal(restored.view.output.wordsReview,undefined);assert.equal(restored.view.output.caption,before.caption);
 for(let index=0;index<8;index++)for(const field of ['id','role','text','credit','label'])assert.equal(restored.view.output.slides[index][field],before.slides[index][field]);assert.deepEqual(restored.view.output.slides[2].photos,slides[2].photos);assert.deepEqual(restored.view.output.slides[2].typography,slides[2].typography);
 const restoredFile=await f.store.readCarouselWords({projectId:f.physical.projectId,documentId:f.physical.documentId,outputId:id});assert.equal(restoredFile.raw,beforeFile.raw,'Canonical saved words bytes return exactly');assert.equal((await f.owner.undoCarouselWords(undo)).alreadySaved,true);
 await f.restart();assert.deepEqual((await f.read(id)).output,restored.view.output);assert.equal((await f.owner.undoCarouselWords(undo)).alreadySaved,true);
 await assert.rejects(f.owner.undoCarouselWords({...undo,operationId:randomUUID()}),/changed|match/);
});
test('wording Undo refuses changed topology and externally edited canonical words and never applies old approval',async t=>{
 const f=await fixture(t),created=await copy(f,await request(f)),id=created.view.output.id;
 const review=await f.owner.reviewCarouselWords({...f.group,selectedOutputId:id,operationId:randomUUID(),expectedOutput:created.view.expectedOutput,expectedWords:created.view.writingProof.expected,wordsHash:created.view.writingProof.wordsHash});
 const slides=structuredClone(review.view.output.slides);slides[1].text='New saved words';const saveId=randomUUID(),saved=await f.owner.save({...f.group,selectedOutputId:id,operationId:saveId,expectedOutput:review.view.expectedOutput,changes:{slides}}),undo={...f.group,selectedOutputId:id,operationId:randomUUID(),expectedOutput:saved.view.expectedOutput,undoOperationId:saveId};
 const own=await f.store.readCarouselWords({projectId:f.physical.projectId,documentId:f.physical.documentId,outputId:id}),raw=fs.readFileSync(own.paths.markdown);fs.writeFileSync(own.paths.markdown,'Externally changed canonical wording.');
 const stale=await f.read(id);assert.equal(stale.freshness.writingStale,true);assert.equal(stale.wordsUndo,null);await assert.rejects(f.owner.undoCarouselWords(undo));fs.writeFileSync(own.paths.markdown,raw);
 const restored=await f.owner.undoCarouselWords(undo);assert.equal(restored.view.output.wordsReview,undefined);assert.equal(restored.view.output.stage,'words');
 const changed=structuredClone(restored.view.output.slides);changed[2].id=randomUUID();changed[0].text='Topology changed words';const topologyId=randomUUID(),topology=await f.owner.save({...f.group,selectedOutputId:id,operationId:topologyId,expectedOutput:restored.view.expectedOutput,changes:{slides:changed}});assert.equal(topology.view.wordsUndo,null);await assert.rejects(f.owner.undoCarouselWords({...f.group,selectedOutputId:id,operationId:randomUUID(),expectedOutput:topology.view.expectedOutput,undoOperationId:topologyId}),/slide sequence/);
});

test('unused empty photo slots survive a browser text layout exactly',async t=>{const f=await fixture(t),body=await request(f);body.browser.slides[0].photos=[{src:'',x:44,y:55},{src:'',x:20,y:30}];body.browser=signatures(body.browser);const r=await copy(f,body);assert.deepEqual(r.view.output.slides[0].photos,body.browser.slides[0].photos);});

test('maintained import roles retain their wording semantics when copied and saved',async t=>{const f=await fixture(t),body=await request(f);const roles=['hook','line','quote','teach','chapter','photo','scene','close'];body.browser.slides.forEach((s,i)=>s.role=roles[i]);body.browser=signatures(body.browser);const r=await copy(f,body),o=r.view.output;assert.deepEqual(o.slides.map(s=>s.role),roles);const slides=structuredClone(o.slides);slides[1].text='A clearer line';const saved=await f.owner.save({...f.group,selectedOutputId:o.id,expectedOutput:r.view.expectedOutput,operationId:randomUUID(),changes:{slides}});assert.deepEqual(saved.view.output.slides.map(s=>s.role),roles);});
