// Composed owner/HTTP proof with an explicitly deterministic synthetic provider.
// Human-labelled requests below are test inputs, never stand-ins for real approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createArtifactExecution} from '../runtime/services/artifact-execution.mjs';
import {captureNativeCreationReview} from './helpers/native-creation-review-screen.mjs';
import {digest} from '../runtime/services/files.mjs';
const source='The invented potter says the cup is blue. Its rim is deliberately uneven.\n';
const idea='Write about an invented cup without making up the potter’s intentions.';
const personal='  My invented note: keep the uneven edge.\nDo not polish away that choice.  ';
const direction='Describe the recorded blue cup and uneven rim. Keep the firing method and personal memories unknown.';
const article=['The invented potter describes a blue cup with an uneven rim.','The edge matters more than a polished finish.','Perhaps I remember holding this cup.','The source does not tell us how the cup was fired.'];
const carousel='---\nkind: CAROUSEL\nstage: words\nstatus: for-your-yes\nstory: Invented blue cup\n---\n\n## Slides\n1. [hook] What does the blue cup keep?\n2. [teach] The supplied record describes a deliberately uneven rim.\n3. [teach] Keep the uneven edge.\n4. [close] How it was fired remains unknown.\n\n## Caption\nThe invented cup is blue; its rim is deliberately uneven. The firing method remains unknown.\n';
const qs=value=>new URLSearchParams(value);
async function fixture(t){
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config,'utf8')),draftFile=path.join(home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),sourceFile=path.join(home.vault,'Workflow/1-Source/SRC - Synthetic One.md'),notePath='Workflow/1-Source/NOTE - Invented personal words.md',empty='---\ntitle: Invented blue cup\n---\n';
 fs.writeFileSync(draftFile,empty);fs.writeFileSync(sourceFile,source);fs.writeFileSync(path.join(home.vault,notePath),personal);config.studyOriginalRoots.catalog.drafts['hk-article'].support.push([notePath,'story notes']);config.studyOriginalRoots.catalog.projects.hk.docs.push([notePath,'notes']);
 const packets=[];let server,base,execution;
 const start=async()=>{
  execution=createArtifactExecution({available:()=>true,execute:async packet=>{
   const captureFile=path.join(packet.cwd,'capture.json'),contextFile=path.join(packet.cwd,'context.md');
   packets.push({prompt:packet.prompt,context:fs.existsSync(contextFile)?fs.readFileSync(contextFile,'utf8'):null});
   if(packet.prompt.includes('EXACT keys body and excerpts')){const capture=JSON.parse(fs.readFileSync(captureFile,'utf8')),id=capture.manifest.sources.find(row=>row.body.includes('invented potter')).id;return {model:'synthetic-deterministic-journey',response:{artifacts:{'result.json':JSON.stringify({body:'The source calls the cup blue and its rim deliberately uneven. It gives no firing method or personal memory, so those remain unknown.',excerpts:[{sourceId:id,quote:'Its rim is deliberately uneven.'}]})}}};}
   if(packet.prompt.includes('draftParagraphs'))return {model:'synthetic-deterministic-journey',response:{artifacts:{'proposal.json':JSON.stringify({draftParagraphs:article})}}};
   assert.match(packet.prompt,/carousel/i,'only the three declared fixture tasks execute');return {model:'synthetic-deterministic-journey',response:{artifacts:{'result.md':carousel}}};
  }});
  server=await createServer({...config,publicDir:path.resolve('public'),sharedArticles:true,researchEnabled:true,connections:[],magazineRoots:[],execution});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;assert.notEqual(server.address().port,8841);
 };
 const stop=async()=>{execution.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));};await start();t.after(async()=>{await stop();fs.rmSync(home.dir,{recursive:true,force:true});});
 const request=async(route,input,status=200,actor='agent:codex')=>{const response=await fetch(base+route,{method:input===undefined?'GET':'POST',headers:{'content-type':'application/json','x-ar-actor':actor,'x-ar-client':actor.startsWith('human:')?'ui':'cli',origin:base},...(input===undefined?{}:{body:JSON.stringify(input)})});const body=await response.json();assert.equal(response.status,status,route+' '+JSON.stringify(body));return body;};
 return {home,config,draftFile,sourceFile,empty,packets,request,get base(){return base;},get execution(){return execution;},restart:async()=>{await stop();await start();}};
}

test('invented idea and exact note become retained learning, a human-finished editable Article, and an independent generated Carousel over HTTP',async t=>{
 const f=await fixture(t),api=f.request,opened=await api('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(f.empty),operationId:randomUUID()});
 const binding={bindingId:opened.binding.id,parentStudyId:'hk'},group={rootBindingId:opened.binding.id,parentStudyId:'hk'},nativeRead=()=>api('/api/study-draft/read?'+qs(binding)),ai=(action,input,status=200,actor)=>api('/api/study-ai/'+action+'?'+qs(binding),input,status,actor);
 await api('/api/study/human-direction/select',{...binding,scope:'part',title:'Invented blue cup',operationId:randomUUID()});await api('/api/study/photos/select',{...binding,operationId:randomUUID()});const initial=await nativeRead();
 const concept=await api('/api/concepts',{parentStudyId:binding.parentStudyId,title:'Invented blue cup',operationId:randomUUID()}),exact=idea+'\n\n'+personal;
 const captured=await api('/api/conversation/capture',{operationId:randomUUID(),origin:{provider:'synthetic-fixture',client:'http-journey',captureId:randomUUID(),historyCoverage:'selected-only'},action:'append-thought',target:{parentStudyId:binding.parentStudyId},contribution:{role:'human',text:exact},expected:{revision:concept.revision,hash:concept.hash}});assert.equal(captured.status,'captured');
 let currentConcept=await api('/api/concept?parentStudyId='+binding.parentStudyId);assert.equal(currentConcept.authorThoughts,exact);
 // A source-bound answer is kept as AI learning; Direction is a separate human fixture decision.
 const catalog=await api('/api/study/research?'+qs(binding)),sourceId=catalog.sources.find(row=>/Synthetic One|Invented/i.test(row.title))?.id||catalog.sources[0]?.id;assert.ok(sourceId);
 const answer=await api('/api/study/research/prepare',{...binding,question:'What does the supplied source establish, and what remains unknown?',sourceIds:[sourceId]});await api('/api/study/research/run',{...binding,id:answer.id});await f.execution.wait(answer.id);
 const learned=await api('/api/study/research/answer?'+qs({...binding,id:answer.id}));assert.equal(learned.status,'result-ready',JSON.stringify(learned));assert.match(learned.answer.body,/no firing method/);assert.equal(learned.answer.excerpts[0].excerpt,'Its rim is deliberately uneven.');const kept=await api('/api/study/research/keep',{...binding,id:answer.id});assert.ok(kept.keptAt);
 currentConcept=await api('/api/concept?parentStudyId='+binding.parentStudyId);await api('/api/concept/save',{parentStudyId:binding.parentStudyId,operationId:randomUUID(),expectedRevision:currentConcept.revision,expectedHash:currentConcept.hash,authorThoughts:currentConcept.authorThoughts,adoptedDirection:direction,aiInterpretation:currentConcept.aiInterpretation,suggestions:currentConcept.suggestions,sourceSelections:currentConcept.sourceSelections},200,'human:adrian');
 const native=await ai('read'),sourceIds=native.sourceCatalog.filter(row=>row.canPrepare&&['source','notes'].includes(row.role)).map(row=>row.id);assert.equal(sourceIds.length,2);assert.ok(native.answerCatalog.some(row=>row.id===answer.id&&row.eligible));
 const prepared=await ai('prepare',{purpose:'article-draft',instruction:'Write a complete short article. Keep the exact personal note and leave unknown details open.',sourceIds,answerIds:[answer.id]}),context=await api('/api/study-ai/context?'+qs({...binding,requestId:prepared.id}));
 assert.equal(context.sources.find(row=>row.role==='notes').raw,personal);assert.equal(context.learning.units[0].id,answer.id);assert.match(JSON.stringify(context.humanDirection),/Describe the recorded blue cup/);assert.match(JSON.stringify(context.humanDirection),/My invented note/);
 const run={...binding,requestId:prepared.id,operationId:randomUUID()};await api('/api/study-ai/run',run);await f.execution.wait(run.operationId);assert.equal((await api('/api/study-ai/run?'+qs(run))).state,'complete');assert.equal((await nativeRead()).raw,initial.raw);
 const review=await api('/api/study-ai/review?'+qs({...binding,requestId:prepared.id}));assert.equal(review.status,'pending');assert.equal(review.replacements.length,4);await ai('finish',{requestId:prepared.id,operationId:randomUUID()},403,'agent:codex');
 const finishOperation=randomUUID(),own='I want to keep the uneven edge.';
 await captureNativeCreationReview({base:f.base,binding,requestId:prepared.id,paragraphs:article,own,markNote:'There is no personal memory in the supplied material.'});
 const finish=await ai('finish',{requestId:prepared.id,operationId:finishOperation,edits:[{id:review.replacements[1].id,words:own}],marks:[{id:review.replacements[2].id,note:'There is no personal memory in the supplied material.'}]},200,'human:adrian');
 assert.match(finish.raw,/I want to keep the uneven edge/);assert.ok(!finish.raw.includes(article[2]));assert.equal(finish.readThrough.marked[0].note,'There is no personal memory in the supplied material.');assert.deepEqual(finish.readThrough.read,[review.replacements[0].id,review.replacements[3].id]);
 // Ordinary editor saves remain available, and their immediately eligible Undo is byte exact.
 const row=finish.projection.find(row=>row.words===own),editOperation=randomUUID(),edited=await api('/api/study-draft/save',{...binding,operationId:editOperation,expected:finish.expected,operations:[{kind:'text',id:row.id,from:0,to:row.words.length,insert:'I choose to keep the uneven edge.',seenBlockHash:row.blockHash}]},200,'human:adrian');assert.match(edited.raw,/I choose to keep/);
 const undone=await api('/api/study-draft/undo',{...binding,operationId:randomUUID(),expected:edited.expected,undoOperationId:editOperation},200,'human:adrian');assert.equal(undone.raw,finish.raw);
 // The existing output owner registers an Article after the empty manuscript has supported prose.
 const noOutputs=await api('/api/study/outputs?'+qs(group)),created=await api('/api/study/outputs/create',{...group,kind:'article',sourceBindingId:binding.bindingId,expectedNative:undone.expected,expectedOutput:noOutputs.expectedOutput,operationId:randomUUID()}),articleId=created.view.output.id,selected={...group,selectedOutputId:articleId};
 const sibling=await api('/api/study/outputs/create',{...group,kind:'article',sourceBindingId:binding.bindingId,expectedNative:(await nativeRead()).expected,expectedOutput:created.view.expectedOutput,operationId:randomUUID()});assert.notEqual(sibling.view.wordOwner.bindingId,binding.bindingId);const siblingRaw=(await api('/api/study-draft/read?'+qs({bindingId:sibling.view.wordOwner.bindingId,parentStudyId:binding.parentStudyId}))).raw;
 const refreshed={view:await api('/api/study/outputs?'+qs(selected))};assert.equal(refreshed.view.freshness.stale,false);
 const makeInput={...group,sourceBindingId:binding.bindingId,sourceOutputId:articleId,expectedNative:(await nativeRead()).expected,expectedOutput:refreshed.view.expectedOutput,operationId:randomUUID()},selector={...group,requestId:makeInput.operationId};await api('/api/study/carousel-make/preview',makeInput);await api('/api/study/carousel-make/run',selector);await f.execution.wait('native-carousel:'+makeInput.operationId);assert.equal((await api('/api/study/carousel-make?'+qs(selector))).status,'result-ready');const saved=await api('/api/study/carousel-make/register',selector);assert.equal(saved.status,'registered');assert.equal(saved.view.wordOwner.kind,'carousel-words');assert.equal(saved.view.output.slides.length,4);assert.equal(saved.reviewed,false);assert.equal(saved.view.output.wordsReview,undefined);assert.notEqual(saved.outputId,articleId);
 assert.equal(f.packets.length,3,'one deterministic Research, Article and Carousel request each');assert.match(f.packets[1].prompt,/My invented note/);assert.match(f.packets[1].prompt,/no firing method/);assert.match(f.packets[2].context,/I want to keep the uneven edge/);
 await f.restart();const reopenedArticle=await nativeRead(),reopenedCarousel=await api('/api/study/outputs?'+qs({...group,selectedOutputId:saved.outputId})),reopenedMake=await api('/api/study/carousel-make?'+qs(selector));assert.equal(reopenedArticle.raw,finish.raw);assert.deepEqual(reopenedCarousel.output,saved.view.output);assert.equal(reopenedMake.status,'registered');assert.equal(f.packets.length,3,'reload never resends generation');
 assert.equal((await api('/api/concept?parentStudyId='+binding.parentStudyId)).authorThoughts,exact);assert.equal((await api('/api/concept?parentStudyId='+binding.parentStudyId)).adoptedDirection,direction);assert.equal((await api('/api/study/research/answer?'+qs({...binding,id:answer.id}))).keptAt,kept.keptAt);assert.equal((await api('/api/study-draft/read?'+qs({bindingId:sibling.view.wordOwner.bindingId,parentStudyId:binding.parentStudyId}))).raw,siblingRaw);assert.deepEqual((await api('/api/study/outputs?'+qs({...group,selectedOutputId:sibling.view.output.id}))).output,sibling.view.output);assert.equal(fs.readFileSync(f.draftFile,'utf8'),f.empty);assert.equal(fs.readFileSync(f.sourceFile,'utf8'),source);
});
