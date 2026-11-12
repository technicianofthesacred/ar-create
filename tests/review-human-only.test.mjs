// Review is Adrian's alone, in the services. Marking material or a transcript reviewed as anyone else is refused in the
// service itself, before anything is written. Invented content only.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createStore} from '../runtime/store.mjs';import {createStudyBindings} from '../runtime/services/study-bindings.mjs';import {createLibrary} from '../runtime/services/library.mjs';import {createGuidance} from '../runtime/services/guidance.mjs';import {createRequestPreviews} from '../runtime/services/requests.mjs';import {createArtifactExecution} from '../runtime/services/artifact-execution.mjs';
import {createFirstFlow} from '../runtime/services/first-flow.mjs';import {createTranscriptCorrections} from '../runtime/services/transcript-corrections.mjs';import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';
import {createTranscriptCheck} from '../runtime/services/transcript-check.mjs';import {withActor} from '../runtime/services/actor.mjs';import {digest} from '../runtime/services/files.mjs';

const as=actor=>fn=>withActor({actor,client:'cli'},fn),adrian=as('human:adrian'),codex=as('agent:codex');
const NOT_ADRIAN=['agent:codex','agent:claude-code','agent:claude-design','agent:hermes','agent:grok','agent:chatgpt','cron:nightly','import:notes'];
const tree=root=>{const out={};const walk=d=>{for(const n of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,n.name);if(n.isDirectory())walk(f);else out[path.relative(root,f)]=fs.readFileSync(f).toString('base64');}};if(fs.existsSync(root))walk(root);return out;};
// The services may throw at once or reject later; either way the refusal is 403 in plain words.
const refused=(thunk,re=/for Adrian to do/)=>assert.rejects(async()=>thunk(),e=>e.status===403&&re.test(e.message));

// Material: two invented notes and one invented managed transcript, behind a fake Library.
function material(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'review-human-only-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const projectId=randomUUID(),mk=(title,body,extra={})=>{const id=randomUUID(),file=path.join(dataDir,id+'.md');fs.writeFileSync(file,body);return {id,title,kind:'note',path:file,text:body,hash:digest(body),cardEligibility:{eligible:true},...extra};};
 const a=mk('River note','Invented river words.'),b=mk('Clay note','Invented clay words.'),c=mk('Other note','Invented other words.');
 const tBody='Invented transcript words.',tr=mk('Tone transcript',tBody,{kind:'transcript',transcriptState:{coherent:true,reviewStatus:'reviewed',expected:{markdownHash:digest(tBody)}}});
 const all={[a.id]:a,[b.id]:b,[c.id]:c,[tr.id]:tr},library={read:async id=>all[id],snapshot:async id=>all[id]};
 const capture=ids=>({assembledContext:'ctx',manifest:{projectId,contextHash:digest('ctx'),sources:ids.map(id=>({...all[id],body:all[id].text}))}});
 const flow=createFirstFlow({dataDir,store:{get:()=>({project:{id:projectId}})},library,requests:{preview:async req=>capture(req.sourceIds)},execution:{observe:()=>{},capabilities:()=>({available:false}),execute:()=>{throw Error('No provider may run in this test.');}}});
 const room=path.join(dataDir,'first-flow',digest(projectId)),flowFile=path.join(room,'flow.json'),read=()=>JSON.parse(fs.readFileSync(flowFile,'utf8'));
 const review=(source,reviewed=true,operationId=randomUUID())=>flow.reviewSources({projectId,operationId,sourceId:source.id,expectedHash:source.hash,reviewed,humanDecision:true});
 const prepare=(sources,reviews,operationId=randomUUID())=>flow.prepare({projectId,operationId,sourceIds:sources.map(s=>s.id),sourceReviews:reviews.map(s=>typeof s==='string'?{sourceId:s,hash:digest('wrong')}:{sourceId:s.id,hash:s.hash}),question:'What do the invented notes say?'});
 return {dataDir,projectId,a,b,c,tr,flow,room,flowFile,read,review,prepare,attach:ids=>flow.attach({projectId,sourceIds:ids,operationId:randomUUID()})};
}

test('reviewed:true as any agent, cron, import or no actor is 403 and flow.json stays byte identical; as Adrian it is stamped his',async t=>{
 const m=material(t);await m.attach([m.a.id]);const before=fs.readFileSync(m.flowFile),all=tree(m.dataDir);
 for(const actor of NOT_ADRIAN)await refused(()=>as(actor)(()=>m.review(m.a)),new RegExp(actor+' may not\\. Nothing was changed'));
 await refused(()=>m.review(m.a));// no actor at all (in-process)
 assert.deepEqual(fs.readFileSync(m.flowFile),before);assert.deepEqual(tree(m.dataDir),all,'nothing at all was written');
 await adrian(()=>m.review(m.a));const f=m.read();assert.equal(f.reviews[m.a.id],m.a.hash);assert.equal(f.reviewedBy[m.a.id].by,'human:adrian');
});

test('an assistant repeating Adrian\'s own operation is refused before the replay, and his stamp stays',async t=>{
 const m=material(t);await m.attach([m.a.id]);const op=randomUUID();await adrian(()=>m.review(m.a,true,op));const before=fs.readFileSync(m.flowFile);
 await refused(()=>codex(()=>m.review(m.a,true,op)));assert.deepEqual(fs.readFileSync(m.flowFile),before);
});

test('withdrawing a review stays open to an assistant, as today',async t=>{
 const m=material(t);await m.attach([m.a.id]);await adrian(()=>m.review(m.a));assert.equal(m.read().reviews[m.a.id],m.a.hash);
 await codex(()=>m.review(m.a,false));const f=m.read();assert.equal(f.reviews[m.a.id],undefined);assert.equal(f.reviewedBy?.[m.a.id],undefined);
});

test('prepare as an assistant: an entry that would add a review is 403 for the whole call and writes nothing',async t=>{
 const m=material(t);await m.attach([m.a.id,m.b.id]);await adrian(()=>m.review(m.a));
 const before=tree(m.dataDir);
 await refused(()=>codex(()=>m.prepare([m.a,m.b],[m.a,m.b])),/agent:codex may not\. Nothing was prepared/);
 await refused(()=>as('cron:nightly')(()=>m.prepare([m.b],[m.b])));
 await refused(()=>m.prepare([m.b],[m.b]));// no actor
 assert.deepEqual(tree(m.dataDir),before,'no request folder, flow unchanged');assert.equal(fs.existsSync(path.join(m.room,'requests')),false);
 assert.equal(m.read().reviews[m.b.id],undefined);
});

test('prepare as an assistant: entries already on file pass and leave his stamp; an old assistant stamp is kept',async t=>{
 const m=material(t);await m.attach([m.a.id,m.b.id]);await adrian(()=>m.review(m.a));
 const stamp=JSON.stringify(m.read().reviewedBy[m.a.id]);
 const done=await codex(()=>m.prepare([m.a],[m.a]));assert.equal(done.research.status,'preview');
 assert.equal(JSON.stringify(m.read().reviewedBy[m.a.id]),stamp,'his stamp is not moved');
 // A review an assistant made before this change is written into the fixture, as the old code wrote it.
 const f=m.read();f.reviews[m.b.id]=m.b.hash;f.reviewedBy[m.b.id]={by:'agent:codex',at:new Date().toISOString(),hash:m.b.hash};fs.writeFileSync(m.flowFile,JSON.stringify(f,null,2));
 const old=JSON.stringify(m.read().reviewedBy[m.b.id]);await codex(()=>m.prepare([m.b],[m.b]));
 assert.equal(JSON.stringify(m.read().reviewedBy[m.b.id]),old,'Reviewed by an assistant stays as it was');
});

test('prepare: a transcript entry, a wrong-hash entry and an entry outside sourceIds are ignored exactly as today',async t=>{
 const m=material(t);await m.attach([m.a.id,m.b.id,m.tr.id]);await adrian(()=>m.review(m.a));
 // An entry for another source in the call's own list is ignored: the call goes ahead on the reviewed source.
 const ok=await codex(()=>m.prepare([m.a],[m.a,m.c]));assert.equal(ok.research.status,'preview');assert.equal(m.read().reviews[m.c.id],undefined);
 // The right hash for an unreviewed note mixed with reviewed ones is refused, with nothing written.
 // A wrong-hash entry is ignored, so the old refusal about the exact current source follows, for everyone.
 const before=tree(m.dataDir);
 await assert.rejects(async()=>codex(()=>m.prepare([m.b],[m.b.id])),e=>e.status!==403&&/Review the exact current source/.test(e.message));
 await assert.rejects(async()=>adrian(()=>m.prepare([m.b],[m.b.id])),/Review the exact current source/);
 assert.deepEqual(tree(m.dataDir),before);
 // A managed transcript's entry is ignored: the transcript review owner decides, for the assistant and for Adrian.
 const viaCodex=await codex(()=>m.prepare([m.tr],[m.tr]));assert.equal(viaCodex.research.status,'preview');assert.equal(m.read().reviews[m.tr.id],undefined);
});

test('the study stand-in on a structure-test copy still works and changes no real subject\'s flow file',async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'review-human-only-study-'))),store=await createStore({dataDir});t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const bindingId=randomUUID(),parentStudyId='structure-test-'+randomUUID(),bindings=createStudyBindings({dataDir,store}),parent=await bindings.select({projectKey:parentStudyId,title:'Invented copy',operationId:randomUUID()});await bindings.select({projectKey:'owned-draft:'+bindingId,title:'Invented part',operationId:randomUUID()});
 const real=store.get().project.id,scope={projectId:parent.projectId,documentId:parent.documentId,bindingId,parentStudyId},library=createLibrary({dataDir}),source=(await library.import({files:[{name:'Invented material.md',content:'The invented vessel combines clay and water.'}]})).receipts[0].source;
 const referenceDir=path.join(dataDir,'references');fs.mkdirSync(referenceDir);const requests=createRequestPreviews({dataDir,store,library,guidance:createGuidance({dataDir,referenceDir})}),execution=createArtifactExecution({available:()=>true,execute:async()=>({response:{artifacts:{}}})});t.after(()=>execution.dispose());
 const validateStudyScope=async()=>{const snapshot=await store.readProject({projectId:scope.projectId,documentId:scope.documentId});return {projectId:snapshot.project.id,documentId:snapshot.project.document.id,canStandInReview:true,sources:[{id:source.id,hash:source.hash}]};};
 const flow=createFirstFlow({dataDir,store,library,requests,execution,validateStudyScope});
 await flow.attach({projectId:real,sourceIds:[source.id],operationId:randomUUID()});
 const realRoom=path.join(dataDir,'first-flow',digest(real)),realBefore=tree(realRoom);assert.ok(Object.keys(realBefore).length);
 const prepared=await codex(()=>flow.study.prepare(scope,{question:'What do the materials say?',sourceIds:[source.id],operationId:randomUUID()}));assert.equal(prepared.research.status,'preview');
 assert.deepEqual(tree(realRoom),realBefore,'the real subject\'s flow file is byte identical');
 const copy=JSON.parse(fs.readFileSync(path.join(dataDir,'first-flow',digest(scope.projectId),'flow.json'),'utf8'));assert.equal(copy.studyReviews[source.id].role,'stand-in');assert.equal(copy.reviewedBy[source.id].by,'agent:codex','the stand-in review lands in the copy only');
});

// Adrian's own calls take exactly today's path: his prepare puts his name on a review already on file.
test('Adrian preparing with a source whose review is on file under an assistant, or with no stamp, re-stamps it as his',async t=>{
 const m=material(t);await m.attach([m.a.id,m.b.id]);await adrian(()=>m.review(m.a));await adrian(()=>m.review(m.b));
 const f=m.read();f.reviewedBy[m.a.id]={by:'agent:codex',at:new Date().toISOString(),hash:m.a.hash};delete f.reviewedBy[m.b.id];fs.writeFileSync(m.flowFile,JSON.stringify(f,null,2));
 assert.equal(m.read().reviewedBy[m.a.id].by,'agent:codex');assert.equal(m.read().reviewedBy[m.b.id],undefined);
 await adrian(()=>m.prepare([m.a,m.b],[m.a,m.b]));
 assert.equal(m.read().reviewedBy[m.a.id].by,'human:adrian','an assistant\'s old stamp becomes his');assert.equal(m.read().reviewedBy[m.b.id].by,'human:adrian','an unstamped review becomes his');
});

test('an assistant repeating Adrian\'s prepare operation gets 200, writes nothing and stamps nothing',async t=>{
 const m=material(t);await m.attach([m.a.id]);await adrian(()=>m.review(m.a));
 const op=randomUUID();await adrian(()=>m.prepare([m.a],[m.a],op));const before=tree(m.dataDir);
 const again=await codex(()=>m.prepare([m.a],[m.a],op));assert.equal(again.research.status,'preview');
 assert.deepEqual(tree(m.dataDir),before,'every file is byte identical');assert.equal(m.read().reviewedBy[m.a.id].by,'human:adrian');
 await codex(()=>m.review(m.a,false));assert.equal(m.read().reviews[m.a.id],undefined);
 await codex(()=>m.prepare([m.a],[m.a],op));assert.equal(m.read().reviews[m.a.id],undefined,'a replay does not bring a withdrawn review back');assert.equal(m.read().reviewedBy?.[m.a.id],undefined);
});

test('source-review refuses unknown keys such as by and reviewedBy with 400 for Adrian, and the flow is unchanged',async t=>{
 const m=material(t);await m.attach([m.a.id]);const before=tree(m.dataDir);
 for(const extra of [{by:'human:adrian'},{reviewedBy:{by:'human:adrian'}}])await assert.rejects(async()=>adrian(()=>m.flow.reviewSources({projectId:m.projectId,operationId:randomUUID(),sourceId:m.a.id,expectedHash:m.a.hash,reviewed:true,humanDecision:true,...extra})),e=>e.status===400);
 assert.deepEqual(tree(m.dataDir),before);assert.equal(m.read().reviews[m.a.id],undefined);
});

test('the stamp-keeping rule: on a structure-test copy an assistant\'s stand-in prepare leaves Adrian\'s earlier stamp',async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'review-human-only-keep-'))),store=await createStore({dataDir});t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const bindingId=randomUUID(),parentStudyId='structure-test-'+randomUUID(),bindings=createStudyBindings({dataDir,store}),parent=await bindings.select({projectKey:parentStudyId,title:'Invented copy',operationId:randomUUID()});await bindings.select({projectKey:'owned-draft:'+bindingId,title:'Invented part',operationId:randomUUID()});
 const scope={projectId:parent.projectId,documentId:parent.documentId,bindingId,parentStudyId},library=createLibrary({dataDir}),source=(await library.import({files:[{name:'Invented material.md',content:'The invented vessel combines clay and water.'}]})).receipts[0].source;
 const referenceDir=path.join(dataDir,'references');fs.mkdirSync(referenceDir);const requests=createRequestPreviews({dataDir,store,library,guidance:createGuidance({dataDir,referenceDir})}),execution=createArtifactExecution({available:()=>true,execute:async()=>({response:{artifacts:{}}})});t.after(()=>execution.dispose());
 const validateStudyScope=async()=>{const snapshot=await store.readProject({projectId:scope.projectId,documentId:scope.documentId});return {projectId:snapshot.project.id,documentId:snapshot.project.document.id,canStandInReview:true,sources:[{id:source.id,hash:source.hash}]};};
 const flow=createFirstFlow({dataDir,store,library,requests,execution,validateStudyScope}),file=path.join(dataDir,'first-flow',digest(scope.projectId),'flow.json');
 await codex(()=>flow.study.prepare(scope,{question:'What do the materials say?',sourceIds:[source.id],operationId:randomUUID()}));
 // The copy's room now exists. Adrian's earlier stamp on the same bytes is written as his confirmation would leave it.
 const f=JSON.parse(fs.readFileSync(file,'utf8'));f.reviewedBy[source.id]={by:'human:adrian',at:new Date().toISOString(),hash:source.hash};fs.writeFileSync(file,JSON.stringify(f,null,2));
 await codex(()=>flow.study.prepare(scope,{question:'What do the materials say?',sourceIds:[source.id],operationId:randomUUID()}));
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).reviewedBy[source.id].by,'human:adrian','his stamp is kept, not replaced by the stand-in\'s');
});

// Transcripts: the recording workshop fixture, with the real correction service.
async function transcript(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'review-human-only-tr-'))),dataDir=path.join(dir,'data');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const fixture=createWorkshopFixture(dataDir),recordings=path.join(dataDir,'recordings'),corrections=createTranscriptCorrections({dir:recordings,config:{conversationTimestamps:true}});
 const id=fixture.id,expected=()=>corrections.read(id).expected,named=()=>corrections.speakers(id,{expected:expected(),names:{s1:'Mara',s2:'Jon'}}),state=()=>JSON.parse(fs.readFileSync(path.join(fixture.output,'transcript.json'),'utf8')).metadata?.review;
 corrections.read(id);// opens the mapping, so a refusal below has nothing of its own to write
 return {dir,recordings,fixture,corrections,id,expected,named,state,files:()=>tree(recordings)};
}
test('corrections.review as any agent, cron, import and with no actor is 403 and every transcript file stays byte identical; as Adrian it is stamped his',async t=>{
 const x=await transcript(t);x.named();const before=x.files();
 for(const actor of NOT_ADRIAN)await refused(()=>as(actor)(()=>x.corrections.review(x.id,{expected:x.expected(),confirmed:true})),/Nothing was changed/);
 await refused(()=>x.corrections.review(x.id,{expected:x.expected(),confirmed:true}));
 await refused(()=>Promise.resolve().then(()=>x.corrections.review(x.id)));
 assert.deepEqual(x.files(),before);assert.ok(!x.state()||x.state().status!=='reviewed');
 await adrian(()=>x.corrections.review(x.id,{expected:x.expected(),confirmed:true}));assert.equal(x.state().status,'reviewed');assert.equal(x.state().by,'human:adrian');
});
test('a review with no expected revision is refused for everyone (the workshop page sends none; mend it only after it says who presses)',async t=>{
 const x=await transcript(t);x.named();
 await assert.rejects(async()=>adrian(()=>x.corrections.review(x.id,{confirmed:true})),e=>e.status===409);
 await refused(()=>codex(()=>x.corrections.review(x.id,{confirmed:true})));
});
test('speaker names and segment corrections stay open to an assistant, and each resets a review',async t=>{
 const x=await transcript(t),confirm=()=>adrian(()=>x.corrections.review(x.id,{expected:x.expected(),confirmed:true}));
 await codex(()=>x.named());await confirm();assert.equal(x.state().status,'reviewed');
 await codex(()=>x.corrections.speakers(x.id,{expected:x.expected(),names:{s1:'Mara',s2:'Jon'}}));assert.equal(x.state().status,'unreviewed','speakers resets even with no new name');
 await confirm();assert.equal(x.state().status,'reviewed');
 const seg=x.corrections.read(x.id).result.segments[0];await codex(()=>x.corrections.edit(x.id,{expected:x.expected(),corrections:[{index:0,text:seg.text+' Again.'}]}));assert.equal(x.state().status,'unreviewed','edit resets');
 await confirm();assert.equal(x.state().status,'reviewed');
 const p=await codex(()=>x.corrections.propose(x.id,{expected:x.expected(),corrections:[{index:1,text:'An invented second line.'}],reason:'Invented fix'}));
 await adrian(()=>x.corrections.decide(x.id,p.id,{decision:'apply',expected:x.expected()}));assert.equal(x.state().status,'unreviewed','decide apply resets');
});

test('a transcript check edit after his confirmation resets the review',async t=>{
 const x=await transcript(t);x.named();
 await adrian(()=>x.corrections.review(x.id,{expected:x.expected(),confirmed:true}));assert.equal(x.state().status,'reviewed');
 const check=createTranscriptCheck({dataDir:path.join(x.dir,'data'),corrections:x.corrections,available:()=>false,execute:async()=>{throw Error('No provider may run in this test.');}});
 const seg=x.corrections.read(x.id).result.segments[0];
 await withActor({actor:'human:adrian',client:'ui'},()=>check.edit(x.id,{indexes:[0],text:seg.text+' Again.',expected:x.expected()}));
 assert.equal(x.state().status,'unreviewed');
});
