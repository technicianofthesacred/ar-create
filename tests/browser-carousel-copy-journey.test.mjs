import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {renderCarouselWords,parseCarouselWords} from '../runtime/src/workspaces/shared-carousel-words.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const copyBrowser='/api/study/outputs/copy-browser-carousel';
const copyRetained='/api/study/outputs/copy-retained-carousel';
const words=output=>({caption:output.caption,slides:output.slides.map(({id,role,text,credit,label})=>({id,role,text,credit,label}))});

async function setup(t){
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'browser-carousel-full-journey-'))),dataDir=path.join(home,'owned'),vault=path.join(home,'vault'),files=path.join(home,'files');
 fs.mkdirSync(vault);fs.mkdirSync(files);
 const originals=[['Workflow/3-Develop/DEV - Destination.md','---\ntype: DEV\ntitle: Synthetic destination manuscript\n---\n\nExact destination manuscript words.\n'],['Workflow/1-Source/SRC - Context.md','Synthetic source context, never carousel wording.\n']];
 for(const[relative,raw]of originals){const file=path.join(vault,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw);}
 const retained={id:randomUUID(),kind:'carousel',title:'Synthetic retained thirteen',caption:'Retained thirteen caption.\nExact second line.',stage:'look',wordsReview:{hash:'a'.repeat(64),reviewedAt:'2026-10-11T00:00:00Z'},outputRevision:7,createdAt:'2026-10-11T00:00:00Z',slides:Array.from({length:13},(_,i)=>({id:randomUUID(),role:i?'inner':'cover',text:'Retained original slide '+(i+1),credit:'Retained credit '+i,label:'Retained heading '+i,template:'M12',photos:[],paragraphIds:[]}))};
 const originalState={revision:5,project:{id:randomUUID(),document:{schema:'ar-create.document.v1',id:randomUUID(),revision:4,outputs:[retained]}}},sourceFile=path.join(home,'retained-original.json');
 fs.writeFileSync(sourceFile,JSON.stringify(originalState));const sourceBytes=fs.readFileSync(sourceFile),source={projectId:originalState.project.id,documentId:originalState.project.document.id,outputId:retained.id,sourceHash:sha(sourceBytes),outputHash:sha(JSON.stringify(retained))};
 const options={dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:{vaultRoot:vault,filesRoot:files,catalog:{projects:{'synthetic-journey':{title:'Synthetic journey',docs:[[originals[1][0],'source']],relatedProjects:[]}},drafts:{'synthetic-draft':{parentStudyKey:'synthetic-journey',partKey:'1',title:'Synthetic destination',path:originals[0][0],contextScope:'Synthetic persistence journey.',support:[[originals[1][0],'source']]}}}},sharedArticles:true,researchEnabled:false,retainedCarouselState:{path:sourceFile,projectId:source.projectId,documentId:source.documentId,outputIds:[source.outputId]}};
 let server,base,port;
 const stop=async()=>{if(!server)return;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;};
 const start=async()=>{server=await createServer(options);await new Promise(resolve=>server.listen(port||0,'127.0.0.1',resolve));port=server.address().port;base='http://127.0.0.1:'+port;};
 await start();t.after(async()=>{await stop();fs.rmSync(home,{recursive:true,force:true});});
 const request=async(route,input,{method='POST',origin=base}={})=>{const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,value:await response.json()};};
 const post=async(route,input)=>{const response=await request(route,input);assert.equal(response.status,200,JSON.stringify(response.value));return response.value;};
 const get=async route=>{const response=await request(route,undefined,{method:'GET'});assert.equal(response.status,200,JSON.stringify(response.value));return response.value;};
 const native=await post('/api/study-draft/open',{originalId:'synthetic-draft',originalHash:sha(originals[0][1]),parentStudyId:'synthetic-journey',operationId:randomUUID()});
 await post('/api/first-flow/select',{projectKey:'synthetic-journey',title:'Synthetic journey',operationId:randomUUID()});
 const physical=await post('/api/study/photos/select',{bindingId:native.binding.id,parentStudyId:'synthetic-journey',operationId:randomUUID()}),group={rootBindingId:native.binding.id,parentStudyId:'synthetic-journey'};
 const read=selectedOutputId=>get('/api/study/outputs?'+new URLSearchParams({...group,...selectedOutputId?{selectedOutputId}:{}}));
 const readNative=()=>get('/api/study-draft/read?'+new URLSearchParams({bindingId:group.rootBindingId,parentStudyId:group.parentStudyId}));
 const canonical=outputId=>get('/api/shared-carousels/current?'+new URLSearchParams({projectId:physical.projectId,documentId:physical.documentId,outputId}));
 const body=async extra=>({...group,destinationProjectId:physical.projectId,destinationDocumentId:physical.documentId,expectedNative:(await readNative()).expected,expectedOutput:(await read()).expectedOutput,operationId:randomUUID(),...extra});
 return {home,dataDir,vault,originals,retained,source,sourceFile,sourceBytes,group,physical,native,request,post,get,read,readNative,canonical,body,restart:async()=>{await stop();await start();},get base(){return base;}};
}

test('C01/C03/C04/C06 S05/S09/S12 browser eight and retained thirteen keep independent real files through HTTP saves, exact retry, Undo and restart',async t=>{
 const f=await setup(t),nativeBefore=await f.readNative();
 const browser={origin:f.base,projectId:'synthetic-browser-eight',revision:4,carouselRevision:2,title:'Synthetic browser eight',name:'Browser eight',caption:'Browser caption.\nExact trailing line.\n',slides:Array.from({length:8},(_,i)=>({id:'browser-slide-'+i,role:i?'inner':'cover',text:'Browser eight slide '+(i+1)+'\nExact next line.',credit:'Browser credit '+i,label:'Browser heading '+i,template:'M12',photos:[],paragraphIds:['foreign-browser-paragraph-'+i],typography:{font:'original',scale:1,fit:'auto'},pillar:'佳'}))};
 browser.slideIds=browser.slides.map(s=>s.id);browser.wordsSignature=JSON.stringify([browser.slides.map(({id,text,credit,label,role})=>({id,text,credit,label,role})),browser.caption]);browser.arrangementSignature=JSON.stringify(browser.slides.map(({text,credit,label,role,...layout})=>layout));
 const browserBefore=structuredClone(browser),browserBytes=JSON.stringify(browser);
 const capability=(await f.get('/api/capabilities')).browserCarouselCopy;assert.equal(capability.available,true);assert.equal(capability.requiresExplicitDestination,true);assert.equal(capability.requiresBrowserSnapshot,true);
 const browserRequest=await f.body({browser});
 const unauthorized=await f.request(copyBrowser,browserRequest,{origin:'https://foreign.invalid'});assert.equal(unauthorized.status,403);
 const registered=await f.post(copyBrowser,browserRequest),eightId=registered.view.output.id;
 assert.equal(eightId,browserRequest.operationId);assert.equal(registered.view.output.slides.length,8);assert.equal(registered.view.wordOwner.kind,'carousel-words');assert.equal(registered.view.output.stage,'words');assert.equal(registered.view.output.wordsReview,undefined);assert.deepEqual(registered.view.document.paragraphs,[]);
 assert.equal(registered.view.outputOrigins[eightId].kind,'browser-carousel-copy');assert.equal(registered.view.outputOrigins[eightId].sourceLiveVerification,false);
 registered.view.output.slides.forEach((slide,index)=>{const original=browser.slides[index];assert.notEqual(slide.id,original.id);assert.deepEqual({...slide,id:original.id,paragraphIds:original.paragraphIds},original);});
 // Simulate losing the successful copy reply: only the immutable request is
 // retried, even though its old expected revision is now stale.
 const retry=await f.post(copyBrowser,browserRequest);assert.equal(retry.alreadySaved,true);assert.equal(retry.view.outputs.length,1);assert.equal(retry.view.output.id,eightId);
 const divergent=await f.request(copyBrowser,{...browserRequest,browser:{...browser,title:'A different operation'}});assert.equal(divergent.status,409);
 const retainedRequest=await f.body({source:f.source}),thirteen=await f.post(copyRetained,retainedRequest),thirteenId=thirteen.view.output.id,thirteenBefore=structuredClone(thirteen.view.output);
 assert.equal(thirteenBefore.slides.length,13);assert.equal(thirteenBefore.stage,'words');assert.equal(thirteenBefore.wordsReview,undefined);assert.deepEqual(thirteen.view.outputs.find(o=>o.id===eightId),registered.view.output);
 assert.equal((await f.post(copyRetained,retainedRequest)).alreadySaved,true);
 let eight=await f.read(eightId),eightFile=await f.canonical(eightId),thirteenFile=await f.canonical(thirteenId);
 assert.notEqual(eightFile.paths.markdown,thirteenFile.paths.markdown);
 for(const [current,output]of [[eightFile,eight.output],[thirteenFile,thirteenBefore]]){
  assert.ok(current.paths.markdown.startsWith(f.dataDir+path.sep));assert.equal(fs.readFileSync(current.paths.markdown,'utf8'),renderCarouselWords(f.physical.projectId,f.physical.documentId,output));
  assert.deepEqual(words(parseCarouselWords(fs.readFileSync(current.paths.markdown,'utf8'),{projectId:f.physical.projectId,documentId:f.physical.documentId,output}).output),words(output));
 }
 const thirteenFileBefore=fs.readFileSync(thirteenFile.paths.markdown);
 const staleExpected=eight.expectedOutput,slides=structuredClone(eight.output.slides);slides[2].text='Independently saved browser wording.\nA precise second line.\n';slides[2].credit='Independent credit';slides[2].label='Independent small heading';
 const saveRequest={...f.group,selectedOutputId:eightId,expectedOutput:eight.expectedOutput,operationId:randomUUID(),changes:{slides,caption:'Independent browser caption.\n'}},saved=await f.post('/api/study/outputs/save',saveRequest);
 assert.equal((await f.post('/api/study/outputs/save',saveRequest)).alreadySaved,true,'Lost successful save reply retries without another edit');
 assert.equal((await f.request('/api/study/outputs/save',{...saveRequest,operationId:randomUUID(),expectedOutput:staleExpected,changes:{caption:'Stale overwrite'}})).status,409);
 eight=await f.read(eightId);assert.deepEqual(eight.output,saved.view.output);assert.equal(eight.output.stage,'words');assert.equal(eight.output.wordsReview,undefined);assert.equal(eight.arrangementUndo,null,'A wording-only save is not falsely offered as arrangement Undo');assert.deepEqual(eight.wordsUndo,{operationId:saveRequest.operationId});
 assert.match(fs.readFileSync(eightFile.paths.markdown,'utf8'),/Independently saved browser wording/);assert.deepEqual(fs.readFileSync(thirteenFile.paths.markdown),thirteenFileBefore);
 await f.restart();eight=await f.read(eightId);assert.deepEqual(eight.output,saved.view.output);assert.deepEqual(eight.wordsUndo,{operationId:saveRequest.operationId},'Exact eligible saved wording Undo survives restart');assert.deepEqual((await f.read(thirteenId)).output,thirteenBefore);assert.equal((await f.post(copyBrowser,browserRequest)).alreadySaved,true);assert.equal((await f.post('/api/study/outputs/save',saveRequest)).alreadySaved,true);
 const looked=await f.post('/api/study/outputs/review-words',{...f.group,selectedOutputId:eightId,expectedOutput:eight.expectedOutput,expectedWords:eight.writingProof.expected,wordsHash:eight.writingProof.wordsHash,operationId:randomUUID()});
 assert.equal(looked.view.output.stage,'look');assert.equal(looked.view.output.wordsReview.hash,looked.view.writingProof.wordsHash);
 const layoutSlides=structuredClone(looked.view.output.slides);layoutSlides[2].template='M1';const layoutRequest={...f.group,selectedOutputId:eightId,expectedOutput:looked.view.expectedOutput,operationId:randomUUID(),changes:{slides:layoutSlides}},layout=await f.post('/api/study/outputs/save',layoutRequest);
 assert.deepEqual(layout.view.arrangementUndo,{operationId:layoutRequest.operationId});assert.deepEqual(words(layout.view.output),words(looked.view.output));
 const undoRequest={...f.group,selectedOutputId:eightId,expectedOutput:layout.view.expectedOutput,undoOperationId:layoutRequest.operationId,operationId:randomUUID()},undone=await f.post('/api/study/outputs/undo',undoRequest);
 assert.equal(undone.view.output.slides[2].template,'M12');assert.deepEqual(words(undone.view.output),words(saved.view.output),'Arrangement Undo preserves exact independently edited words');assert.equal((await f.post('/api/study/outputs/undo',undoRequest)).alreadySaved,true);
 assert.equal((await f.request('/api/study/outputs/undo',{...undoRequest,expectedOutput:undone.view.expectedOutput,operationId:randomUUID()})).status,409,'An old saved Undo cannot be applied to another latest state');
 // Outside edits must remain intact and block publication through the saved
 // owner; restoring invented bytes here only cleans up this synthetic fixture.
 eightFile=await f.canonical(eightId);const ownedBytes=fs.readFileSync(eightFile.paths.markdown),outside=Buffer.from(ownedBytes.toString().replace('Independently saved browser wording.','Synthetic outside file edit.'));fs.writeFileSync(eightFile.paths.markdown,outside);
 const externallyChanged=await f.read(eightId);assert.equal(externallyChanged.freshness.writingStale,true);
 const held=await f.request('/api/study/outputs/save',{...f.group,selectedOutputId:eightId,expectedOutput:externallyChanged.expectedOutput,operationId:randomUUID(),changes:{caption:'Do not overwrite outside bytes'}});assert.equal(held.status,409);assert.deepEqual(fs.readFileSync(eightFile.paths.markdown),outside);fs.writeFileSync(eightFile.paths.markdown,ownedBytes);
 await f.restart();const finalEight=await f.read(eightId);assert.deepEqual(finalEight.output,undone.view.output);assert.deepEqual((await f.read(thirteenId)).output,thirteenBefore);assert.equal((await f.read()).outputs.length,2);
 assert.deepEqual(await f.readNative(),nativeBefore);assert.deepEqual(fs.readFileSync(f.sourceFile),f.sourceBytes);assert.deepEqual(fs.readFileSync(thirteenFile.paths.markdown),thirteenFileBefore);assert.deepEqual(browser,browserBefore);assert.equal(JSON.stringify(browser),browserBytes);
 // A fresh edit changes words and appearance together. Exact wording Undo
 // restores only wording; the latest supported layout remains deliberate.
 const beforeUndoWords=finalEight.output,wordSlides=structuredClone(beforeUndoWords.slides);wordSlides[2].text='A later synthetic correction.';wordSlides[2].credit='A later credit';wordSlides[2].label='A later heading';wordSlides[2].template='M1';
 const nextWordRequest={...f.group,selectedOutputId:eightId,expectedOutput:finalEight.expectedOutput,operationId:randomUUID(),changes:{slides:wordSlides,caption:'A later caption.'}},nextWords=await f.post('/api/study/outputs/save',nextWordRequest);
 assert.deepEqual(nextWords.view.wordsUndo,{operationId:nextWordRequest.operationId});assert.deepEqual(nextWords.view.arrangementUndo,{operationId:nextWordRequest.operationId});
 const beforeOutsideUndo=fs.readFileSync(eightFile.paths.markdown),outsideUndo=Buffer.from(beforeOutsideUndo.toString().replace('A later synthetic correction.','Outside wording during Undo.'));fs.writeFileSync(eightFile.paths.markdown,outsideUndo);
 const heldUndo=await f.request('/api/study/outputs/undo-words',{...f.group,selectedOutputId:eightId,expectedOutput:nextWords.view.expectedOutput,operationId:randomUUID(),undoOperationId:nextWordRequest.operationId});assert.equal(heldUndo.status,409);assert.deepEqual(fs.readFileSync(eightFile.paths.markdown),outsideUndo,'Exact saved wording Undo cannot overwrite outside file edits');fs.writeFileSync(eightFile.paths.markdown,beforeOutsideUndo);
 await f.restart();const undoable=await f.read(eightId);assert.deepEqual(undoable.wordsUndo,nextWords.view.wordsUndo);
 const wordUndoRequest={...f.group,selectedOutputId:eightId,expectedOutput:undoable.expectedOutput,operationId:randomUUID(),undoOperationId:nextWordRequest.operationId};
 const wrongOwner=await f.request('/api/study/outputs/undo-words',{...wordUndoRequest,selectedOutputId:thirteenId});assert.equal(wrongOwner.status,409);
 const wordUndone=await f.post('/api/study/outputs/undo-words',wordUndoRequest);assert.deepEqual(words(wordUndone.view.output),words(beforeUndoWords));assert.equal(wordUndone.view.output.slides[2].template,'M1','Wording Undo preserves the saved arrangement');assert.equal(wordUndone.view.output.stage,'words');assert.equal(wordUndone.view.output.wordsReview,undefined,'Undo cannot inherit or fabricate review approval');
 assert.equal((await f.post('/api/study/outputs/undo-words',wordUndoRequest)).alreadySaved,true,'Lost wording Undo reply replays its exact operation');assert.equal((await f.request('/api/study/outputs/undo-words',{...wordUndoRequest,operationId:randomUUID(),expectedOutput:wordUndone.view.expectedOutput})).status,409,'An old wording Undo cannot overwrite a newer saved state');
 const eightAfterWordUndo=structuredClone(wordUndone.view.output),eightAfterWordUndoBytes=fs.readFileSync(eightFile.paths.markdown),currentThirteen=await f.read(thirteenId),retainedSlides=structuredClone(currentThirteen.output.slides);retainedSlides[12].text='Independent retained-copy ending.';retainedSlides[12].credit='Independent retained-copy credit';retainedSlides[12].label='Independent retained-copy heading';
 const thirteenSaveRequest={...f.group,selectedOutputId:thirteenId,expectedOutput:currentThirteen.expectedOutput,operationId:randomUUID(),changes:{slides:retainedSlides,caption:'Independent retained-copy caption.'}},thirteenSaved=await f.post('/api/study/outputs/save',thirteenSaveRequest);
 assert.match(fs.readFileSync(thirteenFile.paths.markdown,'utf8'),/Independent retained-copy ending/);assert.deepEqual((await f.read(eightId)).output,eightAfterWordUndo);assert.deepEqual(fs.readFileSync(eightFile.paths.markdown),eightAfterWordUndoBytes);
 await f.restart();const loadedThirteen=await f.read(thirteenId);assert.deepEqual(loadedThirteen.output,thirteenSaved.view.output);assert.deepEqual(loadedThirteen.wordsUndo,{operationId:thirteenSaveRequest.operationId});
 const thirteenUndone=await f.post('/api/study/outputs/undo-words',{...f.group,selectedOutputId:thirteenId,expectedOutput:loadedThirteen.expectedOutput,operationId:randomUUID(),undoOperationId:thirteenSaveRequest.operationId});assert.deepEqual(words(thirteenUndone.view.output),words(thirteenBefore));assert.deepEqual(fs.readFileSync(thirteenFile.paths.markdown),thirteenFileBefore);assert.deepEqual((await f.read(eightId)).output,eightAfterWordUndo);
 assert.deepEqual(await f.readNative(),nativeBefore);assert.deepEqual(fs.readFileSync(f.sourceFile),f.sourceBytes);assert.deepEqual(browser,browserBefore);
 for(const[relative,raw]of f.originals)assert.equal(fs.readFileSync(path.join(f.vault,relative),'utf8'),raw);
 t.diagnostic('Existing canonical carousel owner proved independent browser eight + retained thirteen real files, both wording edit/save/reload/restart paths, copy/save/Undo lost-reply replay, conflict refusal, exact arrangement Undo preserving words, and exact wording Undo preserving arrangement without carrying review approval.');
});
