import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {parseFeedbackShare,updateFeedbackShare,feedbackShareSectionChoices,mapFeedbackShareRecipient} from '../runtime/services/magazine/feedback-share-codec.mjs';
const code=fs.readFileSync(new URL('../public/document-study/magazine-output-adapter.js',import.meta.url),'utf8');
const H='a'.repeat(64),R='b'.repeat(64),ID='c'.repeat(64);
function fixture(){const ctx=vm.createContext({structuredClone,URL});vm.runInContext(code,ctx);const f={state:{projectId:'native-project',owner:{kind:'magazine',storyId:'story',pieceId:'article:1',path:'Workflow/3-Develop/DEV - Clay.md'},hash:H,dirty:false},record:{schema:'ar-create.magazine-publication-reference.v1',revision:R,nativeProjectId:'native-project',workingOwnerRef:{projectId:'story',pieceId:'article:1',editionId:'working',artifactId:'registered-dev',hash:H},publication:{id:ID,url:'https://www.teajia.com/read/clay-1',title:'Clay',recordedBy:'working-draft-frontmatter',edition:null,date:null}},calls:[],resolves:[]};f.resolve=async q=>{f.resolves.push(q);return f.record;};f.adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:q=>f.resolve(q),openWorking:async(p,g)=>{g();f.calls.push(p);},openPublication:async(p,g)=>{g();f.calls.push(p);}});return f;}
const read=f=>f.adapter.read({projectId:'native-project'}),publication={projectId:'native-project',kind:'publication-reference',outputId:ID},native={projectId:'native-project',kind:'native',type:'magazine-working'};
test('recorded reference remains distinct from output and delivery proof; metadata cloned and frozen',async()=>{const f=fixture(),d=await read(f);assert.equal(d.outputs[0].kind,'publication-reference');assert.equal(d.outputs[0].status,'not-recorded');assert.equal(d.outputs[0].format,'Publication reference');assert.equal(d.outputs[0].delivery.published,undefined);assert.equal(d.outputs[0].edition,null);assert.equal(d.outputs[0].publicationReference.date,null);assert.equal(d.existingDraft.kind,'magazine-working');assert.equal(d.emptyActions[0].type,'magazine-working');assert.ok(Object.isFrozen(d.outputs[0].publicationReference));assert.throws(()=>d.outputs[0].title='Other',TypeError);f.record.publication.title='Changed';assert.equal(d.outputs[0].title,'Clay');assert.equal(f.resolves[0].expectedHash,H);assert.ok(Object.isFrozen(f.resolves[0]));});
test('fresh metadata controls URL and exact immutable working owner, never caller URL or native UUID fallback',async()=>{const f=fixture();await f.adapter.onAction({...publication,url:'https://evil.test',publication:{url:'https://evil.test'}});assert.equal(f.calls[0].publication.url,f.record.publication.url);assert.ok(Object.isFrozen(f.calls[0].owner));await f.adapter.onAction(native);assert.equal(f.calls[1].kind,'magazine-working');assert.equal(f.calls[1].owner.path,f.state.owner.path);assert.equal(f.calls[1].workingOwnerRef.artifactId,'registered-dev');assert.equal(f.resolves.length,4);await assert.rejects(f.adapter.onAction({...native,type:undefined}));await assert.rejects(f.adapter.onAction({...publication,kind:'arrange'}));await assert.rejects(f.adapter.onAction({...publication,outputId:'native-output'}));await assert.rejects(f.adapter.onAction({...publication,edition:'1'}));});
test('missing publication is honest empty, continuing exact working owner remains supported',async()=>{const f=fixture();f.record.publication=null;const d=await read(f);assert.equal(d.outputs.length,0);assert.match(d.emptyMessage,/No publication reference/);assert.equal(d.existingDraft.owner.pieceId,'article:1');await assert.rejects(f.adapter.onAction(publication));assert.equal(f.calls.length,0);await f.adapter.onAction(native);assert.equal(f.calls.length,1);});
test('exact owner, hash, artifact, project and revision are required',async()=>{for(const mutate of [f=>f.state.hash='wrong',f=>f.state.dirty=true,f=>f.record.nativeProjectId='other',f=>f.record.workingOwnerRef.projectId='other',f=>f.record.workingOwnerRef.pieceId='other',f=>f.record.workingOwnerRef.hash='d'.repeat(64),f=>f.record.workingOwnerRef.editionId='published',f=>f.record.workingOwnerRef.artifactId='',f=>f.record.revision='bad',f=>f.state.owner.path='../DEV.md']){const f=fixture();mutate(f);await assert.rejects(read(f));assert.equal(f.calls.length,0);}assert.equal(await fixture().adapter.read({projectId:'other'}),null);});
test('publication URL is strict HTTPS host and route without normalization escapes',async()=>{for(const url of ['http://www.teajia.com/read/clay','https://teajia.com/read/clay','https://www.teajia.com.evil.test/read/clay','https://user@www.teajia.com/read/clay','https://www.teajia.com:443/read/clay','https://www.teajia.com/read/','https://www.teajia.com/read/a?b','https://www.teajia.com/read/a#b','https://www.teajia.com/read/../a','https://www.teajia.com/read/%2e%2e','https://www.teajia.com/read/a%2fb','https://www.teajia.com/read/a/b','https://www.teajia.com/read/日本','https://www.teajia.com/read/a\\b']){const f=fixture();f.record.publication.url=url;await assert.rejects(read(f),url);assert.equal(f.calls.length,0);}});
test('dirty, owner switch and hash changes during resolution refuse actions before callback',async()=>{for(const mutate of [f=>f.state.dirty=true,f=>f.state.projectId='other',f=>f.state.owner.path='Workflow/3-Develop/DEV - Other.md',f=>f.state.owner.pieceId='other',f=>f.state.hash='d'.repeat(64)]){const f=fixture();f.resolve=async()=>{mutate(f);return f.record;};await assert.rejects(f.adapter.onAction(publication));assert.equal(f.calls.length,0);}});
test('post callback fresh resolution rejects changed reference and current state; callbacks receive final guard',async()=>{const ctx=vm.createContext({structuredClone,URL});vm.runInContext(code,ctx);for(const change of ['revision','dirty']){const f=fixture();const adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:()=>f.record,openPublication:async(_p,guard)=>{guard();if(change==='dirty')f.state.dirty=true;else f.record.revision='e'.repeat(64);}});await assert.rejects(adapter.onAction(publication));}});
test('caller mutation during pending resolution cannot replace action identity',async()=>{const f=fixture();let go;f.resolve=()=>new Promise(r=>{go=()=>r(f.record);});const input={...publication};const pending=f.adapter.onAction(input);input.outputId='d'.repeat(64);input.projectId='elsewhere';go();await new Promise(r=>setImmediate(r));go();await pending;assert.equal(f.calls[0].publication.id,ID);});

test('nonmatching project/native owner returns null without resolver; stale errors propagate and creation stays unavailable',async()=>{const f=fixture();assert.equal(await f.adapter.read({projectId:'other'}),null);f.state.owner.kind='native';assert.equal(await read(f),null);assert.equal(f.resolves.length,0);f.state.owner.kind='magazine';assert.equal((await read(f)).allowNewExpression,false);f.resolve=async()=>{throw Object.assign(Error('Saved working draft changed'),{status:409});};await assert.rejects(read(f),e=>e.status===409);assert.equal(f.calls.length,0);});
test('uncontracted resolver and current extras never enter returned or callback metadata',async()=>{const f=fixture();f.state.owner.body='Unwanted';f.state.body='Unwanted';f.record.body='Unwanted';f.record.publication.body='Unwanted';assert.equal(JSON.stringify(await read(f)).includes('Unwanted'),false);await f.adapter.onAction(native);assert.equal(JSON.stringify(f.calls).includes('Unwanted'),false);});


test('working preview uses exact Magazine identity without a native output binding and rejects stale reads',async()=>{
 const f=fixture(),ctx=vm.createContext({structuredClone,URL});vm.runInContext(code,ctx);let calls=0;const model={schema:'ar-create.magazine-working-edition.v1',revision:R,ownerRef:structuredClone(f.record.workingOwnerRef),spec:{title:['Current','Article']},media:{schema:'ar-create.magazine-media-inspection.v1',revision:R,ownerRef:structuredClone(f.record.workingOwnerRef),sources:[]}};const adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:()=>f.record,readWorking:async input=>{calls++;assert.equal(input.expectedHash,H);return model;},openArrangement:async(p,g)=>{g();f.calls.push(p);}});const d=await adapter.read({projectId:f.state.projectId}),o=d.outputs[0];assert.equal(o.kind,'magazine-working');assert.equal(o.rootBindingId,undefined);assert.equal(d.outputs[1].kind,'publication-reference');assert.equal((await adapter.readWorkingEdition({projectId:f.state.projectId,outputId:o.id,expectedHash:H})).ownerRef.hash,H);await adapter.onAction({projectId:f.state.projectId,outputId:o.id,kind:'arrange',edition:'working'});assert.equal(f.calls[0].owner.pieceId,f.state.owner.pieceId);for(const mutate of [()=>model.ownerRef.hash='d'.repeat(64),()=>f.state.dirty=true]){mutate();await assert.rejects(adapter.readWorkingEdition({projectId:f.state.projectId,outputId:o.id,expectedHash:H}));}assert.ok(calls);
});

function workingActionsFixture(callbacks={}){
 const f=fixture(),ctx=vm.createContext({structuredClone,URL});vm.runInContext(code,ctx);
 f.adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:q=>f.resolve(q),readWorking:async()=>{},openWorking:async(p,g)=>{g();f.calls.push({action:'native',payload:p});},openAudience:async(p,g)=>{g();f.calls.push({action:'review',payload:p});},downloadWorking:async(p,g)=>{g();f.calls.push({action:'export',payload:p});},...callbacks});return f;
}
const currentAction=kind=>({projectId:'native-project',outputId:'magazine-working:story:article:1',edition:'working',kind,expectedHash:H});
test('current working row exposes preview, word editing and private HTML download with exact immutable identity',async()=>{
 const f=workingActionsFixture(),row=(await read(f)).outputs[0];assert.equal(row.status,'draft');assert.deepEqual(JSON.parse(JSON.stringify(row.nextAction)),{kind:'native',label:'Edit words'});assert.deepEqual(JSON.parse(JSON.stringify(row.actions)),[{kind:'review',label:'Preview'},{kind:'export',label:'Download working HTML'}]);assert.deepEqual(JSON.parse(JSON.stringify(row.delivery)),{});
 for(const kind of ['review','native','export'])await f.adapter.onAction(currentAction(kind));assert.deepEqual(f.calls.map(c=>c.action),['review','native','export']);for(const {payload}of f.calls){assert.equal(payload.hash,H);assert.equal(payload.workingOwnerRef.editionId,'working');assert.equal(payload.owner.path,f.state.owner.path);assert.ok(Object.isFrozen(payload));assert.equal(payload.rootBindingId,undefined);}
});
test('working row actions refuse foreign ids, delivered editions, invalid native types and missing callbacks without fallback',async()=>{
 for(const kind of ['review','native','export'])for(const overrides of [{outputId:'magazine-working:other:part'},{projectId:'other'},{edition:'published'},{edition:'2'},{type:'native-output'},{expectedHash:'d'.repeat(64)}]){const f=workingActionsFixture();await assert.rejects(f.adapter.onAction({...currentAction(kind),...overrides}));assert.equal(f.calls.length,0);}
 for(const [kind,key]of [['review','openAudience'],['export','downloadWorking']]){const f=workingActionsFixture({[key]:undefined});await assert.rejects(f.adapter.onAction(currentAction(kind)),/not connected/);assert.equal(f.calls.length,0);}
 const f=workingActionsFixture();await f.adapter.onAction(native);assert.equal(f.calls[0].action,'native');
});
test('working preview and download refuse dirty or changed owner, source reference and hash before callback',async()=>{
 for(const kind of ['review','export','native'])for(const mutate of [f=>f.state.dirty=true,f=>f.state.hash='d'.repeat(64),f=>f.state.owner.path='Workflow/3-Develop/DEV - Other.md',f=>f.record.workingOwnerRef.artifactId='',f=>f.record.workingOwnerRef.hash='d'.repeat(64)]){const f=workingActionsFixture();f.resolve=async()=>{mutate(f);return f.record;};await assert.rejects(f.adapter.onAction(currentAction(kind)));assert.equal(f.calls.length,0);}
});
test('download gives callback the final guard without a fresh read after its irreversible file action',async()=>{
 let committed=0;const f=workingActionsFixture({downloadWorking:async(_p,guard)=>{guard();committed++;f.record.revision='e'.repeat(64);return 'downloaded';}});assert.equal(await f.adapter.onAction(currentAction('export')),'downloaded');assert.equal(committed,1);assert.equal(f.resolves.length,1);
 let release;const g=workingActionsFixture({downloadWorking:async(_p,guard)=>{await new Promise(resolve=>release=resolve);guard();committed++;}}),pending=g.adapter.onAction(currentAction('export'));await new Promise(r=>setImmediate(r));g.state.dirty=true;release();await assert.rejects(pending);assert.equal(committed,1);
});

test('working export requires its projected exact hash while legacy navigation remains supported',async()=>{const f=workingActionsFixture();await assert.rejects(f.adapter.onAction({...currentAction('export'),expectedHash:undefined}),/Refresh Outputs/);assert.equal(f.calls.length,0);for(const kind of ['review','native'])await f.adapter.onAction({...currentAction(kind),expectedHash:undefined});await f.adapter.onAction(native);assert.equal(f.calls.length,3);f.state.hash='d'.repeat(64);f.record.workingOwnerRef.hash=f.state.hash;await assert.rejects(f.adapter.onAction(currentAction('export')),/Refresh Outputs/);assert.equal(f.calls.length,3);});

function shareFixture(readContext){
 const f=fixture(),ctx=vm.createContext({structuredClone,URL});vm.runInContext(code,ctx);
 f.context={schema:'ar-create.magazine-share-context.v1',selection:{storyId:'story',pieceId:'article:1',edition:'working'},authority:{...f.state.owner,title:'Clay',partKey:'article'},rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:R},draft:{path:f.state.owner.path,hash:H},references:{feedback:[],context:[],research:[]}};
 f.adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:q=>f.resolve(q),readShareContext:async q=>{f.calls.push(q);return readContext?readContext(f,q):f.context;}});return f;
}
const shareInput=()=>({projectId:'native-project',outputId:'magazine-working:story:article:1',expectedHash:H});
test('Magazine Share context reaches existing story/piece authority without native UUID selection or prose copies',async()=>{
 const f=shareFixture(),value=await f.adapter.readShareContext(shareInput());
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[{storyId:'story',pieceId:'article:1',edition:'working',expectedHash:H}]);assert.equal(value.draft.hash,H);assert.equal(value.authority.pieceId,'article:1');assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(f.calls[0]));
});
test('Magazine Share context refuses stale, dirty and foreign work before reading',async()=>{
 for(const change of [q=>q.outputId='another',q=>q.expectedHash=R,q=>q.projectId='another']){const f=shareFixture(),q=shareInput();change(q);await assert.rejects(f.adapter.readShareContext(q));assert.equal(f.calls.length,0);}
 const f=shareFixture();f.state.dirty=true;await assert.rejects(f.adapter.readShareContext(shareInput()));assert.equal(f.calls.length,0);
});
test('Magazine Share context refuses delayed owner changes and mismatched backend ownership',async()=>{
 for(const change of [f=>f.state.dirty=true,f=>f.state.hash=R,f=>f.context.authority.pieceId='other',f=>f.context.draft.hash=R,f=>f.context.selection.storyId='other']){const f=shareFixture((f)=>{change(f);return f.context;});await assert.rejects(f.adapter.readShareContext(shareInput()));}
});
test('Magazine invitation metadata keeps honest reference states and excludes uncontracted content',async()=>{
 const row={path:'Workflow/6-Feedback/FEEDBACK - Clay.md',kind:'FEEDBACK',registeredHash:H,currentHash:H,state:'current',readable:true,changedSinceRegistration:false,body:'Uncontracted private copy'};
 const f=shareFixture();f.context.references.feedback=[row];f.context.body='Uncontracted private copy';const value=await f.adapter.readShareContext(shareInput());assert.equal(value.references.feedback.length,1);assert.equal(JSON.stringify(value).includes('Uncontracted'),false);
 for(const mutate of [r=>r.kind='DEV',r=>r.state='made-up',r=>r.readable=false,r=>r.currentHash=R,r=>r.registeredHash='invalid']){const g=shareFixture();g.context.references.feedback=[{...row}];mutate(g.context.references.feedback[0]);await assert.rejects(g.adapter.readShareContext(shareInput()));}
 const g=shareFixture();g.context.references.feedback=[{...row,currentHash:null,state:'missing',readable:false,changedSinceRegistration:true}];assert.equal((await g.adapter.readShareContext(shareInput())).references.feedback[0].state,'missing');
});

const feedbackPath='Workflow/6-Feedback/FEEDBACK - Clay.md',feedbackMarkdown='# Invented invitation\n';
const feedbackHash=createHash('sha256').update(feedbackMarkdown).digest('hex');
function feedbackFixture(options={}){
 const f=shareFixture(),ctx=vm.createContext({structuredClone,URL,crypto:webcrypto,TextEncoder});vm.runInContext(code,ctx);f.context.references.feedback=[{path:feedbackPath,kind:'FEEDBACK',registeredHash:H,currentHash:feedbackHash,state:'changed-since-registration',readable:true,changedSinceRegistration:true}];
 f.feedback={schema:'ar-create.magazine-share-feedback.v1',selection:{storyId:'story',pieceId:'article:1',edition:'working'},authority:structuredClone(f.state.owner),rootIdentity:structuredClone(f.context.rootIdentity),draft:structuredClone(f.context.draft),feedback:{path:feedbackPath,hash:feedbackHash,registeredHash:H,changedSinceRegistration:true},document:{path:feedbackPath,kind:'FEEDBACK',hash:feedbackHash,text:feedbackMarkdown},mapping:{structured:false,metadata:null,projection:[],reason:'No explicit recipient/language mapping is saved.'},readOnly:true};f.feedbackCalls=[];f.contextCalls=[];
 f.adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:q=>f.resolve(q),readShareContext:async q=>{f.contextCalls.push(q);return options.context?options.context(f,q):f.context;},readShareFeedback:async q=>{f.feedbackCalls.push(q);return options.feedback?options.feedback(f,q):f.feedback;},readShareFeedbackEditModel:q=>options.model(f,q),prepareShareFeedbackParagraph:q=>options.prepare(f,q),prepareShareFeedbackMapping:q=>options.mapping(f,q),saveShareFeedback:q=>options.save(f,q),undoShareFeedback:q=>options.undo(f,q),readShareFeedbackHistory:q=>options.history(f,q)});return f;
}
const feedbackInput=()=>({...shareInput(),registeredFeedbackPath:feedbackPath,expectedFeedbackHash:feedbackHash});
test('registered FEEDBACK transport returns canonical Markdown and frozen fallback without native output selection',async()=>{
 const f=feedbackFixture(),result=await f.adapter.readShareFeedback(feedbackInput());
 assert.equal(result.schema,'ar-create.magazine-share-feedback.v1');assert.equal(result.document.text,feedbackMarkdown);assert.equal(result.mapping.structured,false);assert.equal(result.readOnly,true);assert.ok(Object.isFrozen(result.document));assert.ok(Object.isFrozen(f.feedbackCalls[0]));
 assert.deepEqual(JSON.parse(JSON.stringify(f.feedbackCalls[0])),{storyId:'story',pieceId:'article:1',edition:'working',expectedHash:H,registeredFeedbackPath:feedbackPath,expectedFeedbackHash:feedbackHash});
});

const wireHash=value=>createHash('sha256').update(value).digest('hex');
function mappedTransport(f){
 const md='## Chinese\n\n你好。\n\n## English\n\nHello.\n',split=md.indexOf('## English');
 const metadata={schema:'ar-create.magazine-feedback-share.v1',entries:[{recipientId:'11111111-1111-4111-8111-111111111111',target:{storyId:'story',pieceId:'article:1',edition:'working',hash:H},sections:[{language:'zh',heading:'## Chinese',hash:wireHash(md.slice(0,split))},{language:'en',heading:'## English',hash:wireHash(md.slice(split))}]}]};
 const saved=updateFeedbackShare(md,{expectedHash:wireHash(md),metadata}),parsed=parseFeedbackShare(saved.markdown);
 f.feedback.document.text=saved.markdown;f.feedback.document.hash=saved.hash;f.feedback.feedback.hash=saved.hash;f.context.references.feedback[0].currentHash=saved.hash;
 f.feedback.mapping={structured:true,metadata:parsed.metadata,projection:parsed.projection,reason:null};return {...feedbackInput(),expectedFeedbackHash:saved.hash};
}
test('FEEDBACK transport verifies canonical mapped language ranges and freezes the complete projected result',async()=>{
 const f=feedbackFixture(),q=mappedTransport(f),result=await f.adapter.readShareFeedback(q);
 assert.equal(result.mapping.structured,true);assert.equal(result.mapping.projection[0].sections.length,2);assert.match(result.mapping.projection[0].sections[0].markdown,/你好/);
 assert.ok(Object.isFrozen(result.mapping.metadata.entries[0].target));assert.ok(Object.isFrozen(result.mapping.projection[0].sections[0]));assert.equal(f.contextCalls.length,2);
 assert.throws(()=>result.mapping.projection[0].sections[0].markdown='Overwritten',TypeError);
 f.feedback.document.text='New callback text';assert.notEqual(result.document.text,f.feedback.document.text);
});
test('FEEDBACK transport refuses foreign paths, missing/duplicate/unreadable references and wrong input hashes before callback',async()=>{
 for(const alter of [q=>q.registeredFeedbackPath='../private.md',q=>q.registeredFeedbackPath='Workflow/1-Source/CONTEXT - Clay.md',q=>q.registeredFeedbackPath='Workflow/6-Feedback/FEEDBACK - Elsewhere.md',q=>q.expectedFeedbackHash=H,q=>q.expectedHash=R,q=>q.outputId='native-uuid',q=>q.projectId='elsewhere']){
  const f=feedbackFixture(),q=feedbackInput();alter(q);await assert.rejects(f.adapter.readShareFeedback(q));assert.equal(f.feedbackCalls.length,0);
 }
 for(const alter of [f=>f.context.references.feedback=[],f=>f.context.references.feedback.push(f.context.references.feedback[0]),f=>Object.assign(f.context.references.feedback[0],{currentHash:null,state:'missing',readable:false,changedSinceRegistration:true}),f=>Object.assign(f.context.references.feedback[0],{state:'unreadable',readable:false})]){
  const f=feedbackFixture();alter(f);await assert.rejects(f.adapter.readShareFeedback(feedbackInput()));assert.equal(f.feedbackCalls.length,0);
 }
 const f=feedbackFixture();f.state.dirty=true;await assert.rejects(f.adapter.readShareFeedback(feedbackInput()));assert.equal(f.contextCalls.length,0);assert.equal(f.feedbackCalls.length,0);
});
test('FEEDBACK response must preserve exact current owner, registered root, hashes and canonical document bytes',async()=>{
 for(const alter of [r=>r.schema='other',r=>r.readOnly=false,r=>r.selection.storyId='other',r=>r.selection.edition='published',r=>r.selection.editionId='old',r=>r.authority.path='Workflow/3-Develop/DEV - Other.md',r=>r.authority.pieceId='other',r=>r.rootIdentity.fingerprint=H,r=>r.draft.hash=R,r=>r.feedback.path='Workflow/6-Feedback/FEEDBACK - Other.md',r=>r.feedback.hash=R,r=>r.feedback.registeredHash=R,r=>r.feedback.changedSinceRegistration=false,r=>r.document.kind='DEV',r=>r.document.hash=R,r=>r.document.text+='Tampered words.']){
  const f=feedbackFixture();alter(f.feedback);await assert.rejects(f.adapter.readShareFeedback(feedbackInput()));
 }
});
test('FEEDBACK projection refuses foreign targets, stale language ranges, unbounded metadata and inconsistent fallback',async()=>{
 for(const alter of [r=>r.mapping.projection[0].target.hash=R,r=>r.mapping.metadata.entries[0].target.storyId='other',r=>r.mapping.projection[0].sections[0].start=-1,r=>r.mapping.projection[0].sections[0].end=9999999,r=>r.mapping.projection[0].sections[0].markdown='Invented substitute.',r=>r.mapping.projection[0].sections[0].hash=R,r=>r.mapping.projection[0].sections[0].language='fr',r=>r.mapping.metadata.entries.push(...Array(201).fill(r.mapping.metadata.entries[0])),r=>r.mapping.metadata.entries[0].sections[0].hash=R,r=>r.mapping.structured=false,r=>r.mapping.reason='Claimed reason despite structured true',r=>r.mapping.metadata=null]){
  const f=feedbackFixture(),q=mappedTransport(f);alter(f.feedback);await assert.rejects(f.adapter.readShareFeedback(q));
 }
 const f=feedbackFixture();f.feedback.mapping.reason='';await assert.rejects(f.adapter.readShareFeedback(feedbackInput()));
});
test('delayed FEEDBACK context/result and final registered-reference changes refuse switched work',async()=>{
 for(const stage of ['context','feedback'])for(const alter of [f=>f.state.dirty=true,f=>f.state.hash=R,f=>f.state.owner.pieceId='other',f=>f.state.projectId='elsewhere']){
  let release;const f=feedbackFixture({[stage]:()=>new Promise(resolve=>release=resolve)}),pending=f.adapter.readShareFeedback(feedbackInput());await new Promise(resolve=>setImmediate(resolve));alter(f);release(stage==='context'?f.context:f.feedback);await assert.rejects(pending);if(stage==='context')assert.equal(f.feedbackCalls.length,0);
 }
 for(const change of ['root','feedback']){
  const f=feedbackFixture({context:f=>{if(f.contextCalls.length===2){if(change==='root')f.context.rootIdentity.fingerprint=H;else Object.assign(f.context.references.feedback[0],{currentHash:R});}return f.context;}});await assert.rejects(f.adapter.readShareFeedback(feedbackInput()));
 }
});
test('FEEDBACK input is captured across awaits and uncontracted result extras do not enter the frozen projection',async()=>{
 let release;const f=feedbackFixture({context:f=>f.contextCalls.length===1?new Promise(resolve=>release=resolve):f.context}),q=feedbackInput();
 f.feedback.secret='Uncontracted payload';f.feedback.document.secret='Uncontracted payload';f.feedback.mapping.secret='Uncontracted payload';
 const pending=f.adapter.readShareFeedback(q);q.registeredFeedbackPath='Workflow/6-Feedback/FEEDBACK - Other.md';q.expectedFeedbackHash=R;release(f.context);
 const result=await pending;assert.equal(result.feedback.path,feedbackPath);assert.equal(f.feedbackCalls[0].registeredFeedbackPath,feedbackPath);assert.ok(!JSON.stringify(result).includes('Uncontracted payload'));
});
test('a recorded foreign target remains a readable explicit fallback without becoming the current mapping',async()=>{
 const f=feedbackFixture();mappedTransport(f);
 const metadata=structuredClone(f.feedback.mapping.metadata);metadata.entries[0].target.hash=R;
 const saved=updateFeedbackShare(f.feedback.document.text,{expectedHash:f.feedback.document.hash,metadata});
 f.feedback.document.text=saved.markdown;f.feedback.document.hash=saved.hash;f.feedback.feedback.hash=saved.hash;f.context.references.feedback[0].currentHash=saved.hash;
 f.feedback.mapping={structured:false,metadata,projection:[],reason:'Earlier working revision; full FEEDBACK remains readable.'};
 const result=await f.adapter.readShareFeedback({...feedbackInput(),expectedFeedbackHash:saved.hash});
 assert.equal(result.mapping.structured,false);assert.equal(result.mapping.projection.length,0);assert.equal(result.mapping.metadata.entries[0].target.hash,R);assert.equal(result.draft.hash,H);assert.equal(result.document.text,saved.markdown);
});

test('Magazine Share entry resolves its selected working owner without publication or photo-preview setup',async()=>{
 const f=shareFixture();f.resolve=()=>{throw Error('Publication photographs are not configured.');};
 const value=await f.adapter.readShareEntry({projectId:'native-project'});
 assert.equal(value.output.id,'magazine-working:story:article:1');assert.equal(value.output.workingHash,H);assert.equal(value.output.title,'Clay');assert.equal(value.context.draft.hash,H);assert.ok(Object.isFrozen(value));
 f.state.dirty=true;await assert.rejects(f.adapter.readShareEntry({projectId:'native-project'}));
});


const editModel=f=>({...structuredClone(f.feedback),schema:'ar-create.magazine-share-feedback-edit-model.v1',editable:true,unavailableReason:null,paragraphs:[{index:0,seen:createHash('sha1').update(feedbackMarkdown).digest('hex').slice(0,12),text:'Invented invitation',raw:feedbackMarkdown,editable:true}]});
test('Share paragraph model is checked against canonical bytes and owner before offering human edits',async()=>{
 const f=feedbackFixture({model:f=>editModel(f)}),m=await f.adapter.readShareFeedbackEditModel(feedbackInput());assert.equal(m.paragraphs[0].text,'Invented invitation');assert.ok(Object.isFrozen(m.paragraphs));
 for(const change of [m=>m.paragraphs[0].raw='Other words',m=>m.paragraphs[0].seen='0'.repeat(12),m=>m.document.hash=H,m=>m.rootIdentity.fingerprint=H]){const g=feedbackFixture({model:f=>{const m=editModel(f);change(m);return m;}});await assert.rejects(g.adapter.readShareFeedbackEditModel(feedbackInput()));}
});
test('paragraph preparation preserves exact owner scope and refuses delayed owner changes',async()=>{
 let calls=0;const f=feedbackFixture({model:f=>editModel(f),prepare:(f,q)=>{calls++;return {...q,selection:f.feedback.selection,rootIdentity:f.feedback.rootIdentity,authority:f.feedback.authority,content:'# Changed invitation\n'};}});
 const m=await f.adapter.readShareFeedbackEditModel(feedbackInput()),q={...feedbackInput(),block:0,seen:m.paragraphs[0].seen,text:'Changed invitation'};assert.match((await f.adapter.prepareShareFeedbackParagraph(q)).content,/Changed/);assert.equal(calls,1);
 const g=feedbackFixture({model:f=>editModel(f),prepare:(f,q)=>{f.state.dirty=true;return {...q,selection:f.feedback.selection,rootIdentity:f.feedback.rootIdentity,authority:f.feedback.authority,content:'Changed'};}});await assert.rejects(g.adapter.prepareShareFeedbackParagraph(q));
});
test('Share save/Undo transport retains the exact operation and refuses foreign context or result',async()=>{
 const id='22222222-2222-4222-8222-222222222222',content='Changed invitation',f=feedbackFixture({save:(f,q)=>({written:true,path:feedbackPath,hash:wireHash(q.content),beforeHash:feedbackHash,operationId:q.operationId}),undo:(f,q)=>({undone:q.undoOperationId,operationId:q.operationId})});
 const q={...feedbackInput(),rootFingerprint:R,content,operationId:id};assert.equal((await f.adapter.saveShareFeedback(q)).operationId,id);await assert.rejects(f.adapter.saveShareFeedback({...q,rootFingerprint:H}));
 assert.equal((await f.adapter.undoShareFeedback({...feedbackInput(),rootFingerprint:R,operationId:id,undoOperationId:'33333333-3333-4333-8333-333333333333'})).undone,'33333333-3333-4333-8333-333333333333');
});

test('recipient preparation accepts only offered sections and metadata-only owner results',async()=>{
 const setup=(tamper=false)=>feedbackFixture({model:f=>({...editModel(f),mappingSections:feedbackShareSectionChoices(f.feedback.document.text)}),mapping:(f,q)=>{const mapped=mapFeedbackShareRecipient(f.feedback.document.text,{expectedHash:q.expectedFeedbackHash,recipientId:q.recipientId,recipientName:q.recipientName,target:{storyId:q.storyId,pieceId:q.pieceId,edition:'working',hash:q.expectedHash},sections:q.sections}),parsed=parseFeedbackShare(mapped.markdown);return {...q,selection:f.feedback.selection,rootIdentity:f.feedback.rootIdentity,authority:f.feedback.authority,content:mapped.markdown+(tamper?'Changed words.':''),mapping:parsed};}});
 const f=setup(),model=await f.adapter.readShareFeedbackEditModel(feedbackInput()),section=model.mappingSections[0],q={...feedbackInput(),rootFingerprint:model.rootIdentity.fingerprint,recipientId:'11111111-1111-4111-8111-111111111111',recipientName:'Invented maker',sections:[{heading:section.heading,hash:section.hash,language:'en'}]};
 const prepared=await f.adapter.prepareShareFeedbackMapping(q);assert.match(prepared.content,/Invented maker/);assert.ok(prepared.content.endsWith(feedbackMarkdown));assert.ok(Object.isFrozen(prepared));
 await assert.rejects(f.adapter.prepareShareFeedbackMapping({...q,sections:[{...q.sections[0],hash:H}]}));await assert.rejects(setup(true).adapter.prepareShareFeedbackMapping(q));
});
test('Outputs joins exact durable HTML receipts, retains earlier links after source or asset changes, never infers delivery',async()=>{
 const f=fixture(),ctx=vm.createContext({structuredClone,URL});vm.runInContext(code,ctx);
 const sourceHash=H,id='11111111-1111-4111-8111-111111111111',url='/api/magazine/working-draft/export-file?'+new URLSearchParams({storyId:f.state.owner.storyId,pieceId:f.state.owner.pieceId,expectedHash:sourceHash,exportId:id});
 const artifact={id,exportKind:'magazine-working-html',mimeType:'text/html',deliveryState:'created',hash:'f'.repeat(64),sizeBytes:80,name:'invented.html',createdAt:'2026-10-27T01:00:00.000Z',url,sourceBinding:{sourceHash,renderRevision:R,owner:{...f.state.owner,rootFingerprint:'e'.repeat(64)}}};let revision=R,opened=null;
 const adapter=ctx.createMagazineOutputAdapter({current:()=>f.state,resolve:()=>f.record,readWorking:async()=>({revision}),readExports:async()=>({artifacts:[artifact]}),openExport:(a,g)=>{g();opened=a;}});
 let row=(await adapter.read({projectId:f.state.projectId})).outputs[0];assert.equal(row.delivery.exported.hash,artifact.hash);assert.equal(row.exportReceipts[0].stale,false);assert.equal(row.delivery.published,undefined);assert.equal(row.status,'draft');
 await adapter.onAction({projectId:f.state.projectId,outputId:row.id,expectedHash:H,kind:'export',edition:'working',export:{fileId:id}});assert.equal(opened.url,url);
 revision='9'.repeat(64);row=(await adapter.read({projectId:f.state.projectId})).outputs[0];assert.equal(row.exportReceipts[0].stale,true);assert.equal(row.delivery.exported,undefined);assert.equal(row.exportReceipts[0].url,url);
 f.state.hash='d'.repeat(64);f.record.workingOwnerRef.hash=f.state.hash;row=(await adapter.read({projectId:f.state.projectId})).outputs[0];assert.equal(row.exportReceipts[0].stale,true);assert.equal(row.exportReceipts[0].url,url);
 artifact.sourceBinding.owner.pieceId='foreign-carousel';await assert.rejects(adapter.read({projectId:f.state.projectId}),/different or unavailable/);
});

test('invitation adapter forwards explicit actions and freezes canonical facts while refusing altered owner responses',async()=>{
 const {changeFeedbackInvitation}=await import('../runtime/services/magazine/feedback-share-codec.mjs'),{splitBlocks,hash,plain,editable}=await import('../runtime/reference/mag-edit.mjs');let tamper=false;const calls=[];
 const f=feedbackFixture({model:f=>{const {parts}=splitBlocks(f.feedback.document.text);return {...editModel(f),paragraphs:parts.filter((_,i)=>i%2===0).map((raw,index)=>({index,seen:hash(raw),raw,text:plain(raw),editable:editable(raw)})),mappingSections:feedbackShareSectionChoices(f.feedback.document.text)};},mapping:(f,q)=>{calls.push(q);const mapped=changeFeedbackInvitation(f.feedback.document.text,{expectedHash:q.expectedFeedbackHash,target:{storyId:q.storyId,pieceId:q.pieceId,edition:'working',hash:q.expectedHash},change:q.invitationChange});return {...q,selection:f.feedback.selection,rootIdentity:f.feedback.rootIdentity,authority:f.feedback.authority,content:mapped.markdown+(tamper?'Changed correspondence.':''),mapping:parseFeedbackShare(mapped.markdown)};}});
 let q=mappedTransport(f);const named=mapFeedbackShareRecipient(f.feedback.document.text,{expectedHash:q.expectedFeedbackHash,...f.feedback.mapping.metadata.entries[0],recipientName:'Invented Reviewer'});
 const adopt=md=>{const parsed=parseFeedbackShare(md),h=wireHash(md);f.feedback.document={...f.feedback.document,text:md,hash:h};f.feedback.feedback.hash=h;f.context.references.feedback[0].currentHash=h;f.feedback.mapping={structured:true,metadata:parsed.metadata,projection:parsed.projection,reason:null};q={...q,expectedFeedbackHash:h};};adopt(named.markdown);
 const model=await f.adapter.readShareFeedbackEditModel(q),invitationId='33333333-3333-4333-8333-333333333333',request=()=>({...q,rootFingerprint:model.rootIdentity.fingerprint}),newAction={kind:'new',id:invitationId,recipientId:f.feedback.mapping.metadata.entries[0].recipientId};
 const made=await f.adapter.prepareShareFeedbackMapping({...request(),invitationChange:newAction});assert.equal(calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(calls[0].invitationChange)),newAction);adopt(made.content);
 f.feedback.mapping.invitations=[{forged:'Uncontracted fact'}];const read=await f.adapter.readShareFeedback(q);assert.equal(read.mapping.invitations.length,1);assert.equal(read.mapping.invitations[0].id,invitationId);assert.equal(read.mapping.publishedReadiness.available,false);assert.ok(Object.isFrozen(read.mapping.invitations[0].facts));assert.ok(!JSON.stringify(read).includes('Uncontracted fact'));
 const fact={id:'44444444-4444-4444-8444-444444444444',kind:'closed',recordedBy:'human',reason:'Invented explicit closure'},change={kind:'fact',invitationId,fact};const prepared=await f.adapter.prepareShareFeedbackMapping({...request(),invitationChange:change});assert.deepEqual(parseFeedbackShare(prepared.content).metadata.invitations[0].facts,[fact]);tamper=true;await assert.rejects(f.adapter.prepareShareFeedbackMapping({...request(),invitationChange:change}),/words/);await assert.rejects(f.adapter.prepareShareFeedbackMapping({...request(),invitationChange:{...newAction,id:'bad'}}));
});
