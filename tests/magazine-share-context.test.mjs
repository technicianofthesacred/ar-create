import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
import {updateFeedbackShare} from '../runtime/services/magazine/feedback-share-codec.mjs';
import {sha256} from '../runtime/services/magazine-vault/write.mjs';
const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const FEEDBACK = 'Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
const CONTEXT = 'Workflow/1-Source/CONTEXT - Clay Teacher.md';
const RESEARCH = 'Workflow/3-Develop/RESEARCH - Clay Teacher.md';
function fixture(t) {
  const f = buildMagazineFixture({extra: {[FEEDBACK]: '# Invented invitation\n', [RESEARCH]: '# Invented learning\n'}}); t.after(f.cleanup);
  const plan = planRegistration({vault:f.vault, files:f.files});
  fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive:true});
  fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema:INDEX_SCHEMA, vaultRoot:f.vault, filesRoot:f.files, stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId+'.json'), JSON.stringify(p));
  const magazine = createMagazineVault({vaultRoot:f.vault, filesRoot:f.files, dataDir:f.data, writable:false});
  const input = {storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',expectedHash:magazine.read({path:DEV}).hash};
  return {f, magazine, input, bridge:createWorkingDraftBridge({magazine}), projectFile:path.join(f.data,'magazine/projects/mag-clay-teacher.json')};
}
test('exact registered working owner and reference hashes are read without copying words or writing', async t => {
  const s=fixture(t), before=treeHashes(s.f.dir), result=await s.bridge.shareContext(s.input);
  assert.equal(result.schema,'ar-create.magazine-share-context.v1');
  assert.equal(result.authority.storyId,s.input.storyId); assert.equal(result.authority.pieceId,s.input.pieceId); assert.equal(result.authority.path,DEV);
  assert.deepEqual(result.draft,{path:DEV,hash:s.input.expectedHash});
  for(const [key,rel] of Object.entries({feedback:FEEDBACK,context:CONTEXT,research:RESEARCH})) {
    assert.equal(result.references[key].length,1); const r=result.references[key][0];
    assert.equal(r.path,rel); assert.equal(r.state,'current'); assert.equal(r.readable,true); assert.equal(r.registeredHash,r.currentHash); assert.equal(r.changedSinceRegistration,false);
  }
  assert.equal(result.rootIdentity.fingerprint.length,64);
  assert.ok(!JSON.stringify(result).includes(s.f.vault)); assert.ok(!JSON.stringify(result).includes('Invented invitation')); assert.ok(!JSON.stringify(result).includes('I met Mira'));
  assert.deepEqual(treeHashes(s.f.dir),before);
});
test('registered references distinguish missing, changed and unreadable bytes; unregistered files stay absent', async t => {
  const s=fixture(t);
  fs.rmSync(path.join(s.f.vault,FEEDBACK));
  fs.appendFileSync(path.join(s.f.vault,CONTEXT),'\nInvented new context.\n');
  fs.writeFileSync(path.join(s.f.vault,RESEARCH),Buffer.from([0xff,0xfe]));
  fs.writeFileSync(path.join(s.f.vault,'Workflow/6-Feedback/FEEDBACK - Clay Teacher extra.md'),'Unregistered message.');
  const before=treeHashes(s.f.dir), result=await s.bridge.shareContext(s.input);
  assert.equal(result.references.feedback.length,1); assert.equal(result.references.feedback[0].state,'missing'); assert.equal(result.references.feedback[0].currentHash,null);
  assert.equal(result.references.context[0].state,'changed-since-registration'); assert.equal(result.references.context[0].readable,true);
  assert.equal(result.references.research[0].state,'unreadable'); assert.equal(result.references.research[0].readable,false);
  assert.ok(Object.values(result.references).flat().every(r=>r.changedSinceRegistration));
  assert.deepEqual(treeHashes(s.f.dir),before);
});
test('missing registered categories remain empty without guessing filenames or creating records', async t => {
  const s=fixture(t), project=JSON.parse(fs.readFileSync(s.projectFile)); delete project.vaultRecords.feedback; delete project.vaultRecords.research;
  fs.writeFileSync(s.projectFile,JSON.stringify(project)); const before=treeHashes(s.f.dir);
  const result=await s.bridge.shareContext(s.input); assert.deepEqual(result.references.feedback,[]); assert.deepEqual(result.references.research,[]); assert.deepEqual(treeHashes(s.f.dir),before);
});
test('only exact working identity and current DEV hash are accepted', async t => {
  const s=fixture(t);
  for (const input of [{...s.input,expectedHash:null},{...s.input,expectedHash:'invalid'},{...s.input,path:DEV},{...s.input,edition:'published',editionId:'invented'},{...s.input,storyId:'Clay Teacher'},{...s.input,pieceId:'other'},{...s.input,expectedHash:'a'.repeat(64)}]) await assert.rejects(s.bridge.shareContext(input));
  const before=s.input.expectedHash; fs.appendFileSync(path.join(s.f.vault,DEV),'\nNew invented manuscript.\n');
  await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
  s.input.expectedHash=s.magazine.read({path:DEV}).hash; assert.notEqual(s.input.expectedHash,before);
  assert.equal((await s.bridge.shareContext(s.input)).draft.hash,s.input.expectedHash);
  fs.rmSync(path.join(s.f.vault,DEV)); await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
});
test('draft and reference conflicts and symlinks refuse without substituting another file', async t => {
  for (const rel of [DEV,FEEDBACK,CONTEXT,RESEARCH]) {
    const s=fixture(t), file=path.join(s.f.vault,rel), conflict=file.replace(/\.md$/,'.sync-conflict-20261026-test.md');
    fs.writeFileSync(conflict,'Invented conflict.'); await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409); fs.rmSync(conflict);
    const target=file+'.invented-target'; fs.renameSync(file,target); fs.symlinkSync(target,file);
    await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===403);
  }
});
test('captured canonical root, archive and duplicate identity/ref registrations are guarded', async t => {
  const s=fixture(t), original=JSON.parse(fs.readFileSync(s.projectFile));
  for (const change of [p=>p.archived=true,p=>p.pieces.push(p.pieces[0]),p=>p.vaultRecords.feedback=[p.vaultRecords.feedback,p.vaultRecords.feedback],p=>p.vaultRecords.feedback={rel:CONTEXT,sha256:'a'.repeat(64)}]) {
    const p=structuredClone(original); change(p); fs.writeFileSync(s.projectFile,JSON.stringify(p)); await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
  }
  fs.writeFileSync(s.projectFile,JSON.stringify(original));
  const indexFile=path.join(s.f.data,'magazine/index.json'), index=JSON.parse(fs.readFileSync(indexFile)); index.vaultRoot=s.f.files; fs.writeFileSync(indexFile,JSON.stringify(index));
  await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
});
test('files or registration changed during collection refuse a mixed Share context', async t => {
  for (const target of [DEV,CONTEXT,FEEDBACK,'registration']) {
    const s=fixture(t); let changed=false;
    const owner={...s.magazine,read(input){const result=s.magazine.read(input); if(input.path===RESEARCH&&!changed){changed=true;if(target==='registration'){const p=JSON.parse(fs.readFileSync(s.projectFile));delete p.vaultRecords.feedback;fs.writeFileSync(s.projectFile,JSON.stringify(p));}else fs.appendFileSync(path.join(s.f.vault,target),'\nConcurrent invented change.\n');}return result;}};
    await assert.rejects(createWorkingDraftBridge({magazine:owner}).shareContext(s.input),e=>e.status===409);
  }
});
test('a missing registered reference with a surviving sync-conflict still refuses', async t => {
  const s=fixture(t), file=path.join(s.f.vault,FEEDBACK);
  fs.rmSync(file); fs.writeFileSync(file.replace(/\.md$/,'.sync-conflict-20261026-test.md'),'Invented surviving conflicting message.');
  await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
});
test('registered FEEDBACK read returns canonical Markdown and an honest legacy fallback without writes', async t => {
  const s=fixture(t), expectedFeedbackHash=s.magazine.read({path:FEEDBACK}).hash, before=treeHashes(s.f.dir);
  const result=await s.bridge.readShareFeedback({...s.input,registeredFeedbackPath:FEEDBACK,expectedFeedbackHash});
  assert.equal(result.schema,'ar-create.magazine-share-feedback.v1');
  assert.equal(result.authority.path,DEV);assert.equal(result.feedback.path,FEEDBACK);assert.equal(result.feedback.hash,expectedFeedbackHash);
  assert.equal(result.document.text,fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'));assert.equal(result.document.hash,expectedFeedbackHash);
  assert.equal(result.mapping.structured,false);assert.deepEqual(result.mapping.projection,[]);assert.equal(result.readOnly,true);
  assert.equal(result.rootIdentity.fingerprint,(await s.bridge.shareContext(s.input)).rootIdentity.fingerprint);
  assert.deepEqual(treeHashes(s.f.dir),before);
});

function mappedFeedback(s,alter=()=>{}) {
  const markdown='# Invented invitations\n\n## A Chinese\n\n你好，甲。\n\n## A English\n\nHello A.\n\n## B Chinese\n\n你好，乙。\n\n## B English\n\nHello B.\n';
  const headings=['## A Chinese','## A English','## B Chinese','## B English'];
  const metadata={schema:'ar-create.magazine-feedback-share.v1',entries:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].map((recipientId,i)=>({recipientId,target:{storyId:s.input.storyId,pieceId:s.input.pieceId,edition:'working',hash:s.input.expectedHash},sections:headings.slice(i*2,i*2+2).map((heading,j)=>{const start=markdown.indexOf(heading),next=markdown.indexOf('\n## ',start+1);return {language:j?'en':'zh',heading,hash:sha256(Buffer.from(markdown.slice(start,next<0?markdown.length:next+1)))};})}))};
  alter(metadata);
  const saved=updateFeedbackShare(markdown,{expectedHash:sha256(Buffer.from(markdown)),metadata});
  fs.writeFileSync(path.join(s.f.vault,FEEDBACK),saved.markdown);
  return {...s.input,registeredFeedbackPath:FEEDBACK,expectedFeedbackHash:saved.hash};
}
test('registered feedback projects both explicit recipients/languages on the exact current owner with no new files',async t=>{
 const s=fixture(t), input=mappedFeedback(s), before=treeHashes(s.f.dir), result=await s.bridge.readShareFeedback(input);
 assert.equal(result.mapping.structured,true);assert.equal(result.mapping.projection.length,2);assert.equal(result.mapping.projection[0].sections[0].language,'zh');assert.match(result.mapping.projection[1].sections[1].markdown,/Hello B/);
 assert.equal(result.feedback.changedSinceRegistration,true);assert.equal(result.draft.hash,input.expectedHash);assert.equal(result.document.hash,input.expectedFeedbackHash);
 assert.ok(!JSON.stringify(result).includes(s.f.vault));assert.deepEqual(treeHashes(s.f.dir),before);
 const restarted=createWorkingDraftBridge({magazine:createMagazineVault({vaultRoot:s.f.vault,filesRoot:s.f.files,dataDir:s.f.data,writable:false})});
 assert.deepEqual(await restarted.readShareFeedback(input),result);
});
test('foreign owner/earlier revision mappings stay full readable fallback without implicit rebinding',async t=>{
 for(const alter of [m=>m.entries[0].target.storyId='mag-foreign',m=>m.entries[0].target.pieceId='mag-clay-teacher:part-9',m=>m.entries[0].target.hash='b'.repeat(64)]){
  const s=fixture(t), input=mappedFeedback(s,alter), result=await s.bridge.readShareFeedback(input);
  assert.equal(result.mapping.structured,false);assert.deepEqual(result.mapping.projection,[]);assert.ok(result.mapping.metadata);assert.equal(result.document.text,fs.readFileSync(path.join(s.f.vault,FEEDBACK),'utf8'));
 }
});
test('malformed metadata, ambiguous headings and independently changed sections remain readable fallback',async t=>{
 for(const alter of [md=>md.replace('ar-create-share: {','ar-create-share: malformed {'),md=>md+'\n## A English\nDuplicate.\n',md=>md.replace('Hello A.','Newer A.')]){
  const s=fixture(t), input=mappedFeedback(s), file=path.join(s.f.vault,FEEDBACK), changed=alter(fs.readFileSync(file,'utf8'));fs.writeFileSync(file,changed);input.expectedFeedbackHash=s.magazine.read({path:FEEDBACK}).hash;
  const result=await s.bridge.readShareFeedback(input);assert.equal(result.document.text,changed);assert.equal(result.mapping.structured,false);assert.deepEqual(result.mapping.projection,[]);
 }
});
test('feedback selector is explicitly registered, independently hashed and never substitutes another reference',async t=>{
 const s=fixture(t), input=mappedFeedback(s), foreign='Workflow/6-Feedback/FEEDBACK - River Potter.md';fs.writeFileSync(path.join(s.f.vault,foreign),'Invented other message.');
 for(const change of [{registeredFeedbackPath:foreign},{registeredFeedbackPath:CONTEXT},{registeredFeedbackPath:'../private.md'},{expectedFeedbackHash:'a'.repeat(64)},{expectedHash:'c'.repeat(64)},{path:FEEDBACK},{expectedFeedbackHash:null},{edition:'published',editionId:'old'}])await assert.rejects(s.bridge.readShareFeedback({...input,...change}));
 const project=JSON.parse(fs.readFileSync(s.projectFile));project.vaultRecords.feedback=[project.vaultRecords.feedback,project.vaultRecords.feedback];fs.writeFileSync(s.projectFile,JSON.stringify(project));
 await assert.rejects(s.bridge.readShareFeedback(input),e=>e.status===409);
});
test('selected feedback refuses unreadable/missing/conflicting/symlinked bytes and unsupported canonical decoding',async t=>{
 for(const state of ['unreadable','missing','conflict','symlink','bom']){
  const s=fixture(t), input=mappedFeedback(s), file=path.join(s.f.vault,FEEDBACK);
  if(state==='unreadable')fs.writeFileSync(file,Buffer.from([0xff,0xfe]));
  if(state==='missing')fs.rmSync(file);
  if(state==='conflict')fs.writeFileSync(file.replace(/\.md$/,'.sync-conflict-20261027-test.md'),'Invented conflict.');
  if(state==='symlink'){fs.renameSync(file,file+'.target');fs.symlinkSync(file+'.target',file);}
  if(state==='bom')fs.writeFileSync(file,Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),fs.readFileSync(file)]));
  if(['unreadable','bom'].includes(state))input.expectedFeedbackHash=s.magazine.read({path:FEEDBACK}).hash;
  await assert.rejects(s.bridge.readShareFeedback(input));
 }
});
test('draft, feedback, registration or canonical root drift during read refuses a mixed projection',async t=>{
 for(const target of ['draft','feedback','registration','root']){
  const s=fixture(t), input=mappedFeedback(s);let changed=false;
  const owner={...s.magazine,read(q){const document=s.magazine.read(q);if(q.path===FEEDBACK&&!changed){changed=true;if(target==='draft'||target==='feedback')fs.appendFileSync(path.join(s.f.vault,target==='draft'?DEV:FEEDBACK),'\nConcurrent change.\n');if(target==='registration'){const p=JSON.parse(fs.readFileSync(s.projectFile));p.vaultRecords.feedback=[];fs.writeFileSync(s.projectFile,JSON.stringify(p));}if(target==='root'){const file=path.join(s.f.data,'magazine/index.json'),index=JSON.parse(fs.readFileSync(file));index.vaultRoot=s.f.files;fs.writeFileSync(file,JSON.stringify(index));}}return document;}};
  await assert.rejects(createWorkingDraftBridge({magazine:owner}).readShareFeedback(input),e=>e.status===409);
 }
});
test('an unrelated research conflict cannot block reading the exact chosen feedback owner',async t=>{
 const s=fixture(t),input=mappedFeedback(s);fs.writeFileSync(path.join(s.f.vault,RESEARCH.replace(/\.md$/,'.sync-conflict-20261027-test.md')),'Invented research conflict.');
 const result=await s.bridge.readShareFeedback(input);assert.equal(result.mapping.structured,true);assert.equal(result.feedback.path,FEEDBACK);
});


test('Share feedback preserves the maintained reader size limit before projecting a file',async t=>{
 const s=fixture(t),text='Invented feedback.\n'.repeat(120000);fs.writeFileSync(path.join(s.f.vault,FEEDBACK),text);
 await assert.rejects(s.bridge.readShareFeedback({...s.input,registeredFeedbackPath:FEEDBACK,expectedFeedbackHash:sha256(Buffer.from(text))}),error=>error.status===409);
});
