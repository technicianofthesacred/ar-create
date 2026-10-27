import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildMagazineFixture,treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration,INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {splitBlocks,hash,plain,editable} from '../runtime/reference/mag-edit.mjs';
import {sha256} from '../runtime/services/magazine-vault/write.mjs';
import {parseFeedbackShare,updateFeedbackShare} from '../runtime/services/magazine/feedback-share-codec.mjs';
const DEV='Workflow/3-Develop/DEV - Clay Teacher (story).md',FEEDBACK='Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);
const initial='---\ntype: FEEDBACK\nstory: Clay Teacher\nprivate-note: preserve exactly\n---\n\n## Chinese\n\n你好，朋友。\n\n## English\n\nHello **friend**. The [[term:clay|clay]] says ==keep exactly==. <!-- preserve this comment -->\n\nUnrelated closing, unchanged.\n';
function setup(t,{writable=true,markdown=initial}={}){
 const f=buildMagazineFixture({extra:{[FEEDBACK]:markdown}});t.after(f.cleanup);const plan=planRegistration({vault:f.vault,files:f.files});fs.mkdirSync(path.join(f.data,'magazine/projects'),{recursive:true});fs.writeFileSync(path.join(f.data,'magazine/index.json'),JSON.stringify({schema:INDEX_SCHEMA,vaultRoot:f.vault,filesRoot:f.files,stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));for(const p of plan.stories)fs.writeFileSync(path.join(f.data,'magazine/projects',p.storyId+'.json'),JSON.stringify(p));
 const magazine=createMagazineVault({vaultRoot:f.vault,filesRoot:f.files,dataDir:f.data,writable,machine:'invented-paragraph'}),bridge=createWorkingDraftBridge({magazine});
 const input=()=>({storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',expectedHash:magazine.read({path:DEV}).hash,registeredFeedbackPath:FEEDBACK,expectedFeedbackHash:magazine.read({path:FEEDBACK}).hash});return {f,magazine,bridge,input};
}
test('native paragraph model uses exact donor block identities and preparation leaves canonical files/logs/receipts untouched',async t=>{
 const s=setup(t),before=treeHashes(s.f.dir),model=await s.bridge.readShareFeedbackEditModel(s.input());assert.equal(model.schema,'ar-create.magazine-share-feedback-edit-model.v1');assert.equal(model.editable,true);assert.equal(model.unavailableReason,null);
 const {parts}=splitBlocks(initial);assert.deepEqual(model.paragraphs,parts.filter((_p,k)=>k%2===0).map((raw,index)=>({index,seen:hash(raw),text:plain(raw),raw,editable:editable(raw)})));
 const paragraph=model.paragraphs.find(p=>p.text.startsWith('Hello friend'));
 const result=await human(()=>s.bridge.prepareShareFeedbackParagraph({...s.input(),block:paragraph.index,seen:paragraph.seen,text:paragraph.text.replace('Hello','Welcome')}));
 assert.ok(result.content.includes('Welcome **friend**.'));assert.ok(result.content.includes('[[term:clay|clay]]'));assert.ok(result.content.includes('==keep exactly=='));assert.ok(result.content.includes('<!-- preserve this comment -->'));
 assert.equal(splitBlocks(result.content).fm,splitBlocks(initial).fm);assert.ok(result.content.endsWith('Unrelated closing, unchanged.\n'));assert.deepEqual(treeHashes(s.f.dir),before);
 const saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:result.content,operationId:randomUUID()}));await human(()=>s.bridge.undoShareFeedback({...s.input(),undoOperationId:saved.operationId,operationId:randomUUID()}));assert.equal(fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'),initial);
});
function addMapping(s){
 const input=s.input(),markdown=fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'),headings=['## Chinese','## English'];
 const metadata={schema:'ar-create.magazine-feedback-share.v1',entries:[{recipientId:'11111111-1111-4111-8111-111111111111',target:{storyId:input.storyId,pieceId:input.pieceId,edition:'working',hash:input.expectedHash},sections:headings.map((heading,i)=>{const start=markdown.indexOf(heading),end=i?markdown.length:markdown.indexOf(headings[i+1]);return {language:i?'en':'zh',heading,hash:sha256(Buffer.from(markdown.slice(start,end)))};})}]};
 const result=updateFeedbackShare(markdown,{expectedHash:input.expectedFeedbackHash,metadata});fs.writeFileSync(path.join(s.f.vault,FEEDBACK),result.markdown);return metadata;
}
test('mapped bilingual paragraph preparation changes only its donor words and affected language section hash',async t=>{
 const s=setup(t),metadata=addMapping(s),before=treeHashes(s.f.dir),model=await s.bridge.readShareFeedbackEditModel(s.input()),paragraph=model.paragraphs.find(p=>p.text.startsWith('Hello friend'));
 const prepared=await human(()=>s.bridge.prepareShareFeedbackParagraph({...s.input(),block:paragraph.index,seen:paragraph.seen,text:paragraph.text.replace('Hello','Welcome')}));
 assert.equal(prepared.mapping.structured,true);const next=prepared.mapping.metadata;assert.equal(next.entries[0].recipientId,metadata.entries[0].recipientId);assert.deepEqual(next.entries[0].target,metadata.entries[0].target);assert.deepEqual(next.entries[0].sections[0],metadata.entries[0].sections[0]);assert.notEqual(next.entries[0].sections[1].hash,metadata.entries[0].sections[1].hash);
 const parsed=parseFeedbackShare(prepared.content);assert.equal(parsed.structured,true);assert.match(parsed.projection[0].sections[1].markdown,/Welcome \*\*friend\*\*/);assert.deepEqual(treeHashes(s.f.dir),before);
 const initialMapped=fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'),saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:prepared.content,operationId:randomUUID()}));
 assert.equal((await s.bridge.readShareFeedback(s.input())).mapping.structured,true);await human(()=>s.bridge.undoShareFeedback({...s.input(),undoOperationId:saved.operationId,operationId:randomUUID()}));assert.equal(fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'),initialMapped);
});
test('mapped heading identity and pending wording cannot be silently changed or removed',async t=>{
 const s=setup(t);addMapping(s);const model=await s.bridge.readShareFeedbackEditModel(s.input()),heading=model.paragraphs.find(p=>p.raw.trim()==='## Chinese'),pending=model.paragraphs.find(p=>p.text.startsWith('Hello friend')),before=treeHashes(s.f.dir);
 for(const [paragraph,text]of [[heading,'English'],[heading,''],[pending,pending.text.replace('keep exactly','rewritten pending words')],[pending,'']])await assert.rejects(human(()=>s.bridge.prepareShareFeedbackParagraph({...s.input(),block:paragraph.index,seen:paragraph.seen,text})),e=>e.status===409||e.status===400);
 assert.deepEqual(treeHashes(s.f.dir),before);
});
test('stale file/paragraph guards, invalid indices, conflicts and actor permissions refuse preparation without canonical writes',async t=>{
 for(const change of [q=>q.block=-1,q=>q.block=9999,q=>q.seen='a'.repeat(12),q=>q.expectedFeedbackHash='a'.repeat(64),q=>q.expectedHash='a'.repeat(64),q=>q.registeredFeedbackPath=DEV]){
  const s=setup(t),model=await s.bridge.readShareFeedbackEditModel(s.input()),p=model.paragraphs.find(p=>p.text.startsWith('Hello friend')),q={...s.input(),block:p.index,seen:p.seen,text:p.text.replace('Hello','Welcome')},before=treeHashes(s.f.dir);change(q);await assert.rejects(human(()=>s.bridge.prepareShareFeedbackParagraph(q)));assert.deepEqual(treeHashes(s.f.dir),before);
 }
 const s=setup(t),model=await s.bridge.readShareFeedbackEditModel(s.input()),p=model.paragraphs.find(p=>p.text.startsWith('Hello friend')),q={...s.input(),block:p.index,seen:p.seen,text:p.text};
 await assert.rejects(agent(()=>s.bridge.prepareShareFeedbackParagraph(q)),e=>e.status===403);await assert.rejects(s.bridge.prepareShareFeedbackParagraph(q),e=>e.status===400);
 fs.writeFileSync(path.join(s.f.vault,FEEDBACK.replace(/\.md$/,'.sync-conflict-20261027-test.md')),'Invented conflicting version.');await assert.rejects(human(()=>s.bridge.prepareShareFeedbackParagraph(q)),e=>e.status===409);
});
test('paragraph model reports configured read-only state and refuses oversized block projections',async t=>{
 const readonly=setup(t,{writable:false}),model=await readonly.bridge.readShareFeedbackEditModel(readonly.input());assert.equal(model.editable,false);assert.match(model.unavailableReason,/read-only/);
 const p=model.paragraphs.find(p=>p.editable);await assert.rejects(human(()=>readonly.bridge.prepareShareFeedbackParagraph({...readonly.input(),block:p.index,seen:p.seen,text:p.text})),e=>e.status===503);
 const huge=setup(t,{markdown:'# Invitation\n\n'+Array(5001).fill('A tiny invented paragraph.').join('\n\n')});await assert.rejects(huge.bridge.readShareFeedbackEditModel(huge.input()),e=>e.status===413);
});
test('existing donor CRLF-frontmatter limitation stays read-only rather than exposing metadata as editable prose',async t=>{
 const s=setup(t,{markdown:initial.replaceAll('\n','\r\n')}),model=await s.bridge.readShareFeedbackEditModel(s.input());assert.equal(model.editable,false);assert.match(model.unavailableReason,/frontmatter/);
 const before=treeHashes(s.f.dir),p=model.paragraphs.find(p=>p.editable);await assert.rejects(human(()=>s.bridge.prepareShareFeedbackParagraph({...s.input(),block:p.index,seen:p.seen,text:'Must not replace metadata.'})),e=>e.status===409);assert.deepEqual(treeHashes(s.f.dir),before);
});
test('mapped paragraph edit preserves another recipient and does not adopt or rewrite their bilingual sections',async t=>{
 const markdown=initial+'\n## Other Chinese\n\n另一位朋友。\n\n## Other English\n\nAnother friend.\n',s=setup(t,{markdown}),q=s.input(),headings=['## Chinese','## English','## Other Chinese','## Other English'];
 const metadata={schema:'ar-create.magazine-feedback-share.v1',entries:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].map((recipientId,i)=>({recipientId,target:{storyId:q.storyId,pieceId:q.pieceId,edition:'working',hash:q.expectedHash},sections:headings.slice(i*2,i*2+2).map((heading,j)=>{const start=markdown.indexOf(heading),next=headings.indexOf(heading)+1,end=next<headings.length?markdown.indexOf(headings[next]):markdown.length;return {language:j?'en':'zh',heading,hash:sha256(Buffer.from(markdown.slice(start,end)))};})}))};
 const saved=updateFeedbackShare(markdown,{expectedHash:q.expectedFeedbackHash,metadata});fs.writeFileSync(path.join(s.f.vault,FEEDBACK),saved.markdown);
 const view=await s.bridge.readShareFeedbackEditModel(s.input()),paragraph=view.paragraphs.find(p=>p.text.startsWith('Hello friend')),result=await human(()=>s.bridge.prepareShareFeedbackParagraph({...s.input(),block:paragraph.index,seen:paragraph.seen,text:paragraph.text.replace('Hello','Welcome')}));
 assert.deepEqual(result.mapping.metadata.entries[1],metadata.entries[1]);assert.deepEqual(result.mapping.projection[1].sections.map(section=>section.markdown),view.mapping.projection[1].sections.map(section=>section.markdown));
});
test('a current owner revision arriving during disposable preparation is refused rather than overwritten',async t=>{
 const s=setup(t),view=await s.bridge.readShareFeedbackEditModel(s.input()),paragraph=view.paragraphs.find(p=>p.text.startsWith('Hello friend')),q={...s.input(),block:paragraph.index,seen:paragraph.seen,text:paragraph.text.replace('Hello','Welcome')};
 const owner={...s.magazine,prepareFeedbackParagraph(input){const result=s.magazine.prepareFeedbackParagraph(input);fs.appendFileSync(path.join(s.f.vault,DEV),'\nConcurrent maintained revision.\n');return result;}};
 await assert.rejects(human(()=>createWorkingDraftBridge({magazine:owner}).prepareShareFeedbackParagraph(q)),e=>e.status===409);assert.equal(fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'),initial);
});
